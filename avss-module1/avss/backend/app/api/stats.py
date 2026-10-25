"""
Stats API — dashboard summary numbers for both user and admin dashboards.
GET /api/v1/stats  →  totals: detections, cameras, jobs, searches, success_rate
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.auth import get_user_from_token
from app.core.database import get_db
from app.models.camera import Camera
from app.models.video_job import VideoJob
from app.models.detection_log import DetectionLog
from app.models.search_query import SearchQuery

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Stats"])


@router.get("/stats", summary="Dashboard statistics")
def get_stats(
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    """
    Returns aggregate numbers used by the dashboard stat cards.
    All values come directly from the database — no AI inference required.
    """
    total_cameras   = db.query(func.count(Camera.id)).scalar() or 0
    active_cameras  = db.query(func.count(Camera.id)).filter(Camera.status == "active").scalar() or 0

    total_jobs      = db.query(func.count(VideoJob.id)).scalar() or 0
    completed_jobs  = db.query(func.count(VideoJob.id)).filter(VideoJob.status == "completed").scalar() or 0
    processing_jobs = db.query(func.count(VideoJob.id)).filter(VideoJob.status == "processing").scalar() or 0
    failed_jobs     = db.query(func.count(VideoJob.id)).filter(VideoJob.status == "failed").scalar() or 0

    total_detections = db.query(func.sum(VideoJob.total_detections)).scalar() or 0

    total_searches   = db.query(func.count(SearchQuery.id)).scalar() or 0
    completed_searches = db.query(func.count(SearchQuery.id)).filter(SearchQuery.status == "completed").scalar() or 0

    avg_duration = (
        db.query(func.avg(VideoJob.duration_seconds))
          .filter(VideoJob.duration_seconds.isnot(None), VideoJob.status == "completed")
          .scalar()
    )

    success_rate = round((completed_jobs / total_jobs * 100) if total_jobs > 0 else 0.0, 1)

    return {
        "cameras": {
            "total":  total_cameras,
            "online": active_cameras,
            "offline": total_cameras - active_cameras,
        },
        "jobs": {
            "total":      total_jobs,
            "completed":  completed_jobs,
            "processing": processing_jobs,
            "failed":     failed_jobs,
        },
        "detections": {
            "total": int(total_detections),
        },
        "searches": {
            "total":     total_searches,
            "completed": completed_searches,
        },
        "performance": {
            "success_rate":       success_rate,
            "avg_duration_sec":   round(float(avg_duration), 1) if avg_duration else None,
        },
    }
