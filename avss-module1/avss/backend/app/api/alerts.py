"""
Alerts API — system-generated alerts from job failures and AI pipeline events.

GET  /api/v1/alerts           → list all alerts (newest first)
POST /api/v1/alerts/{id}/read → mark one alert as read
POST /api/v1/alerts/read-all  → mark all alerts as read

Alerts are derived from:
  - Failed video jobs (severity: high)
  - Completed searches with 0 matches (severity: medium — "no person found")
  - Completed searches with matches found (severity: info)
  - System events (low)
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.auth import get_user_from_token
from app.core.database import get_db
from app.models.video_job import VideoJob
from app.models.search_query import SearchQuery
from app.models.camera import Camera

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Alerts"])

# In-memory read-state (per process).
# For production replace with an Alert DB table.
_read_ids: set[str] = set()


def _fmt_time(dt: Optional[datetime]) -> str:
    if not dt:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%H:%M:%S")


def _build_alerts(db: Session) -> list[dict]:
    alerts = []

    # ── Failed jobs → high severity ────────────────────────────────────────
    failed_jobs = (
        db.query(VideoJob)
          .filter(VideoJob.status == "failed")
          .order_by(VideoJob.id.desc())
          .limit(20)
          .all()
    )
    for j in failed_jobs:
        src = j.original_filename or f"Job {j.id}"
        cam_id = f"cam-{j.camera_id}" if j.camera_id else "upload"
        alerts.append({
            "id":       f"job-fail-{j.id}",
            "kind":     "system",
            "severity": "high",
            "title":    f"Processing Failed — {src}",
            "text":     j.error_message or "Unknown error during video processing.",
            "cameraId": cam_id,
            "time":     _fmt_time(j.completed_at or j.created_at),
            "read":     f"job-fail-{j.id}" in _read_ids,
        })

    # ── Searches with 0 matches → medium severity ──────────────────────────
    zero_searches = (
        db.query(SearchQuery)
          .filter(SearchQuery.status == "completed", SearchQuery.total_matches == 0)
          .order_by(SearchQuery.id.desc())
          .limit(10)
          .all()
    )
    for sq in zero_searches:
        job = db.query(VideoJob).filter(VideoJob.id == sq.job_id).first()
        src = job.original_filename if job else f"Job {sq.job_id}"
        cam_id = f"cam-{job.camera_id}" if (job and job.camera_id) else "upload"
        alerts.append({
            "id":       f"search-nomatch-{sq.id}",
            "kind":     "lowconf",
            "severity": "medium",
            "title":    "Person Not Found",
            "text":     f"Search on '{src}' returned 0 matches. Try a lower threshold.",
            "cameraId": cam_id,
            "time":     _fmt_time(sq.completed_at or sq.created_at),
            "read":     f"search-nomatch-{sq.id}" in _read_ids,
        })

    # ── Successful searches → info ─────────────────────────────────────────
    matched_searches = (
        db.query(SearchQuery)
          .filter(SearchQuery.status == "completed", SearchQuery.total_matches > 0)
          .order_by(SearchQuery.id.desc())
          .limit(10)
          .all()
    )
    for sq in matched_searches:
        job = db.query(VideoJob).filter(VideoJob.id == sq.job_id).first()
        src = job.original_filename if job else f"Job {sq.job_id}"
        cam_id = f"cam-{job.camera_id}" if (job and job.camera_id) else "upload"

        # Camera name
        cam_name = cam_id
        if job and job.camera_id:
            cam = db.query(Camera).filter(Camera.id == job.camera_id).first()
            if cam:
                cam_name = cam.name

        alerts.append({
            "id":       f"search-match-{sq.id}",
            "kind":     "match",
            "severity": "info",
            "title":    f"Person Found — {sq.total_matches} match(es)",
            "text":     f"Search on '{src}' matched in {sq.total_matches} frame(s). Camera: {cam_name}.",
            "cameraId": cam_id,
            "personId": f"search-{sq.id}",
            "time":     _fmt_time(sq.completed_at or sq.created_at),
            "read":     f"search-match-{sq.id}" in _read_ids,
        })

    # Sort newest first (rough — based on list order which is already newest first per query)
    return alerts


@router.get("/alerts", summary="List system alerts")
def list_alerts(
    unread_only: bool = Query(default=False, description="Return only unread alerts"),
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    alerts = _build_alerts(db)
    if unread_only:
        alerts = [a for a in alerts if not a["read"]]
    unread = sum(1 for a in alerts if not a["read"])
    return {
        "total":  len(alerts),
        "unread": unread,
        "alerts": alerts,
    }


@router.post("/alerts/{alert_id}/read", summary="Mark one alert as read")
def mark_read(
    alert_id: str,
    _user=Depends(get_user_from_token),
):
    _read_ids.add(alert_id)
    return {"status": "ok", "alert_id": alert_id}


@router.post("/alerts/read-all", summary="Mark all alerts as read")
def mark_all_read(
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    alerts = _build_alerts(db)
    for a in alerts:
        _read_ids.add(a["id"])
    return {"status": "ok", "marked": len(alerts)}
