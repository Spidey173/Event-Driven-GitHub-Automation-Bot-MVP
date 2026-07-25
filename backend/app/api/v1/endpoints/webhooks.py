import json
import logging
from fastapi import APIRouter, Request, Header, HTTPException, status, BackgroundTasks, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.api.deps import get_db
from backend.app.models.repository import Repository
from backend.app.models.event import WebhookEvent
from backend.app.utils.signature import verify_signature
from backend.app.services.encryption import decrypt_token
from backend.app.services.event_processor import process_webhook_event

logger = logging.getLogger("app.api.v1.webhooks")
router = APIRouter()

@router.post("/github", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook_receiver(
    request: Request,
    background_tasks: BackgroundTasks,
    response: Response,
    x_github_event: str = Header(...),
    x_github_delivery: str = Header(...),
    x_hub_signature_256: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Incoming GitHub webhook gateway verifying signature, checking idempotency, and enqueuing background tasks."""
    # 1. Parse raw request body
    body = await request.body()
    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed JSON payload.")

    # 2. Extract repository identity (Supports multi-repo dynamic lookup)
    repo_name = payload.get("repository", {}).get("full_name")
    if not repo_name:
        logger.warning("Received webhook event '%s' missing repository metadata.", x_github_delivery)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Missing repository metadata in payload."
        )

    # 3. Retrieve connected repository credentials from database
    result = await db.execute(
        select(Repository).where(Repository.full_name == repo_name)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        logger.warning("Received event for unconnected repository '%s'.", repo_name)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Repository not connected to database."
        )

    # 4. Decrypt webhook secret key and verify HMAC signature
    webhook_secret = decrypt_token(repo.webhook_secret_encrypted)
    if not verify_signature(body, x_hub_signature_256, webhook_secret):
        logger.warning("Webhook signature verification failed for repo: %s", repo_name)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="HMAC signature verification failed."
        )

    # 5. Core Requirement: Deduplication (Idempotency check)
    evt_check = await db.execute(
        select(WebhookEvent).where(WebhookEvent.delivery_id == x_github_delivery)
    )
    existing_event = evt_check.scalar_one_or_none()
    if existing_event:
        logger.info("Webhook delivery ID '%s' already ingested. Skipping duplicate.", x_github_delivery)
        response.status_code = status.HTTP_200_OK
        return {"detail": "Webhook event delivery duplicate, skipped processing."}

    action = payload.get("action")

    # 6. Commit Event records to postgres
    new_event = WebhookEvent(
        repository_id=repo.id,
        delivery_id=x_github_delivery,
        event_type=x_github_event,
        action=action,
        payload=payload,
        status="pending",
        retry_count=0
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    # 7. Asynchronously trigger matching automation tasks in the background
    if x_github_event in ("issues", "pull_request"):
        background_tasks.add_task(process_webhook_event, str(new_event.id))
        return {
            "detail": "Webhook event accepted and queued for processing.",
            "event_id": str(new_event.id)
        }
    else:
        # Swallow and mark completed for setup ping checks or other alerts (e.g. release, star)
        new_event.status = "completed"
        await db.commit()
        return {"detail": f"Webhook event type '{x_github_event}' ingested. No rule actions executed."}
