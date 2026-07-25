import logging
from datetime import datetime, timezone
import httpx
from sqlalchemy import select
from backend.app.db.session import async_session_maker
from backend.app.models.event import WebhookEvent
from backend.app.models.repository import Repository
from backend.app.models.rule import Rule
from backend.app.models.action_log import ActionLog
from backend.app.models.user import User
from backend.app.services.encryption import decrypt_token
from backend.app.services.github_client import GitHubClient
from backend.app.services.rule_engine import RuleEngine

logger = logging.getLogger("app.services.event_processor")

async def process_webhook_event(event_id: str) -> None:
    """Asynchronous background worker executing matching rules for an ingested webhook event."""
    async with async_session_maker() as db:
        # 1. Fetch the target event
        result = await db.execute(select(WebhookEvent).where(WebhookEvent.id == event_id))
        event = result.scalar_one_or_none()
        
        if not event:
            logger.error("Webhook event '%s' not found.", event_id)
            return

        if event.status in ("completed", "processing"):
            logger.info("Webhook event '%s' is already '%s'. Skipping.", event_id, event.status)
            return

        # Flag processing to block race conditions
        event.status = "processing"
        await db.commit()

        try:
            # 2. Retrieve connected repository configuration
            repo_result = await db.execute(
                select(Repository).where(Repository.id == event.repository_id)
            )
            repository = repo_result.scalar_one_or_none()
            if not repository:
                raise ValueError("Associated repository details not found.")

            if not repository.is_active:
                logger.warning("Repository '%s' is inactive. Skipping action execution.", repository.full_name)
                event.status = "completed"
                event.processed_at = datetime.now(timezone.utc)
                await db.commit()
                return

            # 3. Retrieve database user token credentials
            user_result = await db.execute(select(User).where(User.id == repository.user_id))
            owner_user = user_result.scalar_one_or_none()
            if not owner_user:
                raise ValueError("Repository owner credential record missing.")

            github_token = decrypt_token(owner_user.github_access_token_encrypted)

            # Prevent duplicate executions and feedback loops by only processing on 'opened' actions
            if event.action != "opened":
                logger.info("Skipping event '%s' with action '%s' to avoid duplicate/non-opened processing.", event.id, event.action)
                event.status = "completed"
                event.processed_at = datetime.now(timezone.utc)
                await db.commit()
                return

            # 4. Query active rules for repository and event type
            rules_result = await db.execute(
                select(Rule).where(
                    Rule.repository_id == repository.id,
                    Rule.event_type == event.event_type,
                    Rule.is_active == True
                )
            )
            active_rules = rules_result.scalars().all()
            payload = event.payload

            # Extract issue / PR metadata to format output values
            number = None
            title = ""
            if event.event_type == "issues":
                number = payload.get("issue", {}).get("number")
                title = payload.get("issue", {}).get("title", "")
            elif event.event_type == "pull_request":
                number = payload.get("pull_request", {}).get("number")
                title = payload.get("pull_request", {}).get("title", "")

            for rule in active_rules:
                # 5. Evaluate rule conditions
                if RuleEngine.evaluate_rule(payload, event.event_type, rule.conditions):
                    logger.info("Rule '%s' matches webhook event '%s'. Running actions.", rule.name, event.id)

                    # 6. Execute actions sequentially
                    for action in rule.actions:
                        action_type = action.get("type")
                        action_value = action.get("value")

                        # Core Requirement: Action Idempotency
                        # Prevent executing the same action type multiple times for the same event
                        duplicate_check = await db.execute(
                            select(ActionLog).where(
                                ActionLog.webhook_event_id == event.id,
                                ActionLog.action_type == action_type
                            )
                        )
                        if duplicate_check.scalar_one_or_none():
                            logger.info("Action '%s' already performed for event '%s'. Skipping.", action_type, event.id)
                            continue

                        status_str = "success"
                        details = {}

                        try:
                            # 7. Perform Action dispatches
                            if action_type == "add_label" and number:
                                res = await GitHubClient.add_label_to_issue(
                                    github_token, repository.owner, repository.name, number, action_value
                                )
                                details = {"label": action_value, "response": res}

                            elif action_type == "create_comment" and number:
                                res = await GitHubClient.add_comment_to_issue(
                                    github_token, repository.owner, repository.name, number, action_value
                                )
                                details = {"comment": action_value, "response": res}

                            elif action_type == "send_slack":
                                slack_webhook_url = decrypt_token(repository.slack_webhook_url_encrypted)
                                if not slack_webhook_url:
                                    raise ValueError("Slack Webhook URL is not configured on this repository.")

                                # Format alert message dynamically
                                formatted_message = action_value.format(
                                    number=number or "",
                                    title=title,
                                    repo=repository.full_name
                                )

                                async with httpx.AsyncClient(timeout=10.0) as client:
                                    slack_res = await client.post(slack_webhook_url, json={"text": formatted_message})
                                    if slack_res.status_code not in (200, 201, 204):
                                        raise ValueError(
                                            f"Slack API returned status {slack_res.status_code}: {slack_res.text}"
                                        )
                                    details = {"message": formatted_message, "status_code": slack_res.status_code}
                            else:
                                raise ValueError(f"Unsupported action action_type: {action_type}")

                        except Exception as action_err:
                            logger.error("Failed to perform action '%s': %s", action_type, str(action_err))
                            status_str = "failed"
                            details = {"error": str(action_err)}

                        # 8. Record audit trace
                        action_log = ActionLog(
                            webhook_event_id=event.id,
                            rule_id=rule.id,
                            action_type=action_type,
                            status=status_str,
                            details=details
                        )
                        db.add(action_log)

            # Complete Event Update
            event.status = "completed"
            event.processed_at = datetime.now(timezone.utc)
            event.error_message = None

        except Exception as err:
            logger.error("Event processing crash on event '%s': %s", event_id, str(err), exc_info=True)
            event.status = "failed"
            event.error_message = str(err)

        await db.commit()
