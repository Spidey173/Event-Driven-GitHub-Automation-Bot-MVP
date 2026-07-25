import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.api.deps import get_db, get_current_user
from backend.app.models.user import User
from backend.app.models.event import WebhookEvent
from backend.app.models.action_log import ActionLog
from backend.app.models.repository import Repository

logger = logging.getLogger("app.api.v1.dashboard")
router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Returns aggregated telemetry metrics for connected repositories and event operations."""
    # Retrieve repository IDs connected to user
    repos_query = await db.execute(
        select(Repository.id).where(Repository.user_id == current_user.id)
    )
    repo_ids = [r for r, in repos_query.all()]
    
    if not repo_ids:
        return {
            "total_events": 0,
            "successful_events": 0,
            "failed_events": 0,
            "total_actions": 0,
            "active_repositories": 0
        }

    # Query metrics
    total_events = await db.execute(
        select(func.count(WebhookEvent.id)).where(WebhookEvent.repository_id.in_(repo_ids))
    )
    successful_events = await db.execute(
        select(func.count(WebhookEvent.id)).where(
            WebhookEvent.repository_id.in_(repo_ids),
            WebhookEvent.status == "completed"
        )
    )
    failed_events = await db.execute(
        select(func.count(WebhookEvent.id)).where(
            WebhookEvent.repository_id.in_(repo_ids),
            WebhookEvent.status == "failed"
        )
    )

    # Resolve total action dispatches logged across events
    event_ids_query = await db.execute(
        select(WebhookEvent.id).where(WebhookEvent.repository_id.in_(repo_ids))
    )
    event_ids = [e for e, in event_ids_query.all()]
    
    total_actions = 0
    if event_ids:
        actions_count = await db.execute(
            select(func.count(ActionLog.id)).where(ActionLog.webhook_event_id.in_(event_ids))
        )
        total_actions = actions_count.scalar() or 0

    return {
        "total_events": total_events.scalar() or 0,
        "successful_events": successful_events.scalar() or 0,
        "failed_events": failed_events.scalar() or 0,
        "total_actions": total_actions,
        "active_repositories": len(repo_ids)
    }

@router.get("/events")
async def get_recent_events(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Returns a paginated log of received webhooks and action dispatches for audit trails."""
    repos_query = await db.execute(
        select(Repository.id).where(Repository.user_id == current_user.id)
    )
    repo_ids = [r for r, in repos_query.all()]

    if not repo_ids:
        return {"events": [], "total": 0}

    # Fetch total event log count
    total_query = await db.execute(
        select(func.count(WebhookEvent.id)).where(WebhookEvent.repository_id.in_(repo_ids))
    )
    total = total_query.scalar() or 0

    # Fetch paginated webhook event records
    events_query = await db.execute(
        select(WebhookEvent)
        .where(WebhookEvent.repository_id.in_(repo_ids))
        .order_by(WebhookEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    events = events_query.scalars().all()

    # Join and format event logs with corresponding rule audits
    serialized_events = []
    for event in events:
        action_logs_query = await db.execute(
            select(ActionLog).where(ActionLog.webhook_event_id == event.id)
        )
        logs = action_logs_query.scalars().all()

        serialized_events.append({
            "id": str(event.id),
            "delivery_id": str(event.delivery_id),
            "event_type": event.event_type,
            "action": event.action,
            "status": event.status,
            "retry_count": event.retry_count,
            "error_message": event.error_message,
            "created_at": event.created_at,
            "processed_at": event.processed_at,
            "actions": [
                {
                    "id": str(log.id),
                    "action_type": log.action_type,
                    "status": log.status,
                    "details": log.details,
                    "created_at": log.created_at
                } for log in logs
            ]
        })

    return {"events": serialized_events, "total": total}
