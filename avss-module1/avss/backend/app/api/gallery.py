"""
Gallery API — search result cards stored in the DB + Supabase Storage.

Each card shows:
  - Thumbnail (query face photo)
  - Search ID (AVSS-SEARCH-0001)
  - Source camera / video file
  - Date
  - Number of matches
  - Play Video button (Supabase URL or local proxy)
  - Download button

GET  /api/v1/gallery              → list all completed searches (newest first)
GET  /api/v1/gallery/{query_id}   → single search result detail
DELETE /api/v1/gallery/{query_id} → delete a search result (admin only)
"""
import json
import logging
from datetime import timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.auth import get_user_from_token, require_admin
from app.core.database import get_db
from app.models.search_query import SearchQuery
from app.models.video_job import VideoJob
from app.models.camera import Camera

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Gallery"])

BACKEND_BASE = "http://localhost:8002"   # local fallback for video serving


def _video_url(sq: SearchQuery) -> Optional[str]:
    """
    Returns the best available video URL:
    1. Supabase public URL (cloud, shareable)
    2. Local backend proxy URL (works on same machine)
    """
    if sq.supabase_video_url:
        return sq.supabase_video_url
    if sq.output_video_path:
        name = Path(sq.output_video_path).name
        return f"/api/v1/pipeline/video/{name}"
    return None


def _query_image_url(sq: SearchQuery) -> Optional[str]:
    """Returns the best available query image URL."""
    if sq.query_image_url:
        return sq.query_image_url
    if sq.query_image_path:
        # Return relative path — frontend will prepend BACKEND_URL
        return f"/api/v1/gallery/{sq.id}/query-image"
    return None


def _build_card(sq: SearchQuery, db: Session) -> dict:
    """Build a gallery card dict from a SearchQuery row."""
    # Source name — camera or filename
    source_name = sq.source_name
    if not source_name:
        job = db.query(VideoJob).filter(VideoJob.id == sq.job_id).first() if sq.job_id else None
        if job:
            source_name = job.original_filename or Path(job.source_path).name if job.source_path else f"Job {job.id}"
        else:
            source_name = "Unknown source"

    # Camera location
    location = None
    if sq.camera_id_ref:
        cam = db.query(Camera).filter(Camera.id == sq.camera_id_ref).first()
        if cam:
            location = cam.location or cam.name

    # Parse hits for confidence / best match
    hits = []
    try:
        if sq.results_json:
            hits = json.loads(sq.results_json)
    except Exception:
        pass

    best_similarity = max((h.get("best_similarity", 0) for h in hits), default=0)

    created_str = ""
    if sq.created_at:
        dt = sq.created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        created_str = dt.strftime("%d %b %Y, %H:%M")

    return {
        "query_id":        sq.id,
        "search_ref_id":   sq.search_ref_id or f"AVSS-SEARCH-{sq.id:04d}",
        "status":          sq.status,
        "total_matches":   sq.total_matches or 0,
        "source_name":     source_name,
        "location":        location,
        "created_at":      created_str,
        "created_raw":     sq.created_at.isoformat() if sq.created_at else None,
        "threshold":       sq.similarity_threshold,
        "best_similarity": round(best_similarity * 100, 1),
        "video_url":       _video_url(sq),
        "query_image_url": _query_image_url(sq),
        "supabase_video_url": sq.supabase_video_url,
        "has_supabase":    bool(sq.supabase_video_url),
    }


@router.get("/gallery", summary="List all search result cards")
def list_gallery(
    status:   Optional[str] = Query(default=None, description="Filter: completed|failed|processing"),
    limit:    int            = Query(default=50, ge=1, le=200),
    skip:     int            = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    """
    Returns completed search results as gallery cards.
    Each card contains the video URL, query image, match count, and metadata.
    """
    q = db.query(SearchQuery).order_by(SearchQuery.id.desc())
    if status:
        q = q.filter(SearchQuery.status == status)
    else:
        # Default: only show completed searches in the gallery
        q = q.filter(SearchQuery.status.in_(["completed", "failed"]))

    total = q.count()
    rows  = q.offset(skip).limit(limit).all()

    return {
        "total": total,
        "results": [_build_card(r, db) for r in rows],
    }


@router.get("/gallery/{query_id}", summary="Get one search result detail")
def get_gallery_item(
    query_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    sq = db.query(SearchQuery).filter(SearchQuery.id == query_id).first()
    if not sq:
        raise HTTPException(status_code=404, detail=f"Search id={query_id} not found.")

    card = _build_card(sq, db)

    # Include full timeline if available
    hits = []
    try:
        if sq.results_json:
            hits = json.loads(sq.results_json)
    except Exception:
        pass

    card["hits"] = hits
    return card


@router.get("/gallery/{query_id}/query-image", summary="Serve the query face photo")
def serve_query_image(
    query_id: int,
    db: Session = Depends(get_db),
):
    """Returns the query face photo as JPEG — used when Supabase is not configured."""
    from fastapi.responses import FileResponse
    sq = db.query(SearchQuery).filter(SearchQuery.id == query_id).first()
    if not sq or not sq.query_image_path:
        raise HTTPException(status_code=404, detail="Query image not found.")
    p = Path(sq.query_image_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Query image file missing.")
    return FileResponse(str(p), media_type="image/jpeg")


@router.delete("/gallery/{query_id}", summary="Delete a search result (admin)")
def delete_gallery_item(
    query_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Deletes the search record from the DB.
    Also deletes from Supabase Storage if the video was uploaded there.
    """
    sq = db.query(SearchQuery).filter(SearchQuery.id == query_id).first()
    if not sq:
        raise HTTPException(status_code=404, detail=f"Search id={query_id} not found.")

    # Delete from Supabase if applicable
    if sq.supabase_video_url:
        try:
            from app.services.supabase_storage import delete_video
            # Extract path from URL
            parts = sq.supabase_video_url.split("/object/public/avss-videos/")
            if len(parts) == 2:
                delete_video(parts[1])
        except Exception as e:
            logger.warning("Could not delete from Supabase: %s", e)

    db.delete(sq)
    db.commit()
    return {"status": "deleted", "query_id": query_id}


@router.get("/gallery/stats/summary", summary="Gallery statistics")
def gallery_stats(
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    """Quick stats for the gallery header."""
    from sqlalchemy import func
    total      = db.query(func.count(SearchQuery.id)).scalar() or 0
    completed  = db.query(func.count(SearchQuery.id)).filter(SearchQuery.status == "completed").scalar() or 0
    in_supabase= db.query(func.count(SearchQuery.id)).filter(SearchQuery.supabase_video_url.isnot(None)).scalar() or 0
    total_hits = db.query(func.sum(SearchQuery.total_matches)).scalar() or 0
    return {
        "total_searches":   total,
        "completed":        completed,
        "in_supabase":      in_supabase,
        "total_matches":    int(total_hits),
    }
