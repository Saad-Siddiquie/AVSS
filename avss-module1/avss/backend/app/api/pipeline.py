"""
AVSS Pipeline API — Modules 5–12 end-to-end
Endpoints:
  POST /pipeline/process/upload   — upload a video file and start processing
  POST /pipeline/process/camera   — process a registered camera (RTSP/file)
  GET  /pipeline/jobs/{job_id}    — poll job status + progress
  POST /pipeline/search           — upload query image → search + render output
  GET  /pipeline/search/{id}      — poll search status
  GET  /pipeline/video/{filename} — stream/download annotated output video
"""
import logging
import os
import threading
from pathlib import Path

from fastapi import (
    APIRouter, Depends, File, Form,
    HTTPException, Query, UploadFile, status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.auth import get_user_from_token
from app.core.database import get_db
from app.models.camera import Camera
from app.models.video_job import VideoJob
from app.models.search_query import SearchQuery
from app.schemas.pipeline import (
    JobCreateResponse, JobStatusResponse,
    SearchResultResponse, SearchStatusResponse, TimelineEntry,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Pipeline — Video Processing & Search"])

UPLOAD_DIR = Path("uploads/videos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_DIR = Path("uploads/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

QUERY_DIR = Path("uploads/queries")
QUERY_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_VIDEO_TYPES = {
    "video/mp4", "video/avi", "video/x-msvideo",
    "video/quicktime", "video/x-matroska", "video/webm",
}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


# ── Helper: run pipeline in a background thread ───────────────────────────────

def _run_pipeline(job_id: int) -> None:
    """Runs process_video in a separate thread with its own DB session."""
    from app.core.database import SessionLocal
    from app.ai.pipeline import process_video
    db = SessionLocal()
    try:
        process_video(job_id, db)
    except Exception as exc:
        logger.error("Background pipeline failed for job %d: %s", job_id, exc)
    finally:
        db.close()


def _run_search(query_id: int) -> None:
    """Runs search_and_track in a separate thread with its own DB session."""
    from app.core.database import SessionLocal
    from app.ai.pipeline import search_and_track
    db = SessionLocal()
    try:
        search_and_track(query_id, db)
    except Exception as exc:
        logger.error("Background search failed for query %d: %s", query_id, exc)
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Process: Upload video file
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/pipeline/process/upload",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload video file and start processing",
    description=(
        "Upload an MP4/AVI/MOV file. The system will extract frames, "
        "Detect persons (wildtrack_best.pt), ByteTrack, embed faces (yolov8n-face + ArcFace). "
        "Returns a job_id — poll /pipeline/jobs/{job_id} for progress."
    ),
)
async def process_uploaded_video(
    video: UploadFile = File(..., description="MP4/AVI/MOV/MKV video file"),
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    if video.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type: {video.content_type}. Use MP4, AVI, MOV, or MKV.",
        )

    # Save video to disk
    ext = Path(video.filename).suffix.lower() if video.filename else ".mp4"
    safe_name = f"upload_{os.urandom(6).hex()}{ext}"
    dest = UPLOAD_DIR / safe_name

    content = await video.read()
    dest.write_bytes(content)
    logger.info("Saved uploaded video: %s (%d bytes)", dest, len(content))

    # Create job record
    job = VideoJob(
        source_type="upload",
        source_path=str(dest),
        original_filename=video.filename,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Launch processing in background thread
    thread = threading.Thread(target=_run_pipeline, args=(job.id,), daemon=True)
    thread.start()
    logger.info("Started processing thread for job %d", job.id)

    return JobCreateResponse(
        job_id=job.id,
        status="pending",
        message=f"Video '{video.filename}' uploaded. Processing started in background.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Process: Use registered camera
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/pipeline/process/camera",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Process a registered camera source",
    description=(
        "Start processing a camera that is already registered in the system "
        "(from Module 4 — Camera Management). Supports RTSP streams, webcams, "
        "and video file cameras."
    ),
)
def process_camera_source(
    camera_id: int = Form(..., description="ID of a registered camera"),
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    job = VideoJob(
        source_type="camera",
        source_path=camera.url,
        camera_id=camera.id,
        original_filename=f"{camera.name} ({camera.camera_type})",
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    thread = threading.Thread(target=_run_pipeline, args=(job.id,), daemon=True)
    thread.start()
    logger.info("Started processing thread for job %d (camera %d)", job.id, camera_id)

    return JobCreateResponse(
        job_id=job.id,
        status="pending",
        message=f"Processing started for camera '{camera.name}'.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Poll job status
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/pipeline/jobs/{job_id}",
    response_model=JobStatusResponse,
    summary="Get video processing job status",
)
def get_job_status(
    job_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job id={job_id} not found.")
    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        progress=job.progress or 0.0,
        total_frames=job.total_frames,
        total_detections=job.total_detections or 0,
        duration_seconds=job.duration_seconds,
        error_message=job.error_message,
    )


@router.get(
    "/pipeline/jobs",
    response_model=list[JobStatusResponse],
    summary="List all video processing jobs",
)
def list_jobs(
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    jobs = db.query(VideoJob).order_by(VideoJob.id.desc()).limit(50).all()
    return [
        JobStatusResponse(
            job_id=j.id,
            status=j.status,
            progress=j.progress or 0.0,
            total_frames=j.total_frames,
            total_detections=j.total_detections or 0,
            duration_seconds=j.duration_seconds,
            error_message=j.error_message,
        )
        for j in jobs
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Search: Upload query image → find + annotate
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/pipeline/search",
    response_model=SearchStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Search for a person in a processed video",
    description=(
        "Upload a face photo of the target person and specify a completed job ID. "
        "The system will search all stored embeddings, find matching persons, "
        "and render an annotated video with the person tracked in a bounding box."
    ),
)
async def search_person(
    query_image: UploadFile = File(..., description="Face photo of the person to find"),
    job_id: int = Form(..., description="ID of the completed processing job"),
    similarity_threshold: float = Form(
        default=0.50, ge=0.1, le=0.9,
        description="Minimum cosine similarity (0.50 recommended for CCTV)",
    ),
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    if query_image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {query_image.content_type}")

    # Verify the job is completed
    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job id={job_id} not found.")
    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job id={job_id} is '{job.status}'. Wait for it to complete before searching.",
        )

    # Save query image
    ext = Path(query_image.filename).suffix.lower() if query_image.filename else ".jpg"
    qname = f"query_{os.urandom(6).hex()}{ext}"
    qdest = QUERY_DIR / qname
    qdest.write_bytes(await query_image.read())

    # Create search query record
    sq = SearchQuery(
        job_id=job_id,
        query_image_path=str(qdest),
        similarity_threshold=similarity_threshold,
        status="pending",
    )
    db.add(sq)
    db.commit()
    db.refresh(sq)

    # Launch search in background thread
    thread = threading.Thread(target=_run_search, args=(sq.id,), daemon=True)
    thread.start()
    logger.info("Started search thread for query %d (job %d)", sq.id, job_id)

    return SearchStatusResponse(
        query_id=sq.id,
        status="pending",
        total_matches=0,
        output_video_url=None,
        error_message=None,
    )


@router.get(
    "/pipeline/search/{query_id}",
    response_model=SearchStatusResponse,
    summary="Poll search status",
)
def get_search_status(
    query_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    sq = db.query(SearchQuery).filter(SearchQuery.id == query_id).first()
    if not sq:
        raise HTTPException(status_code=404, detail=f"Search query id={query_id} not found.")

    video_url = None
    if sq.output_video_path and Path(sq.output_video_path).exists():
        filename = Path(sq.output_video_path).name
        video_url = f"/api/v1/pipeline/video/{filename}"

    # Resolve camera info from the parent job
    camera_name = None
    camera_location = None
    camera_id = None
    job = db.query(VideoJob).filter(VideoJob.id == sq.job_id).first()
    if job:
        camera_id = job.camera_id
        camera_name = job.original_filename or "Uploaded Video"
        if job.camera_id:
            cam = db.query(Camera).filter(Camera.id == job.camera_id).first()
            if cam:
                camera_name = cam.name
                camera_location = cam.location

    return SearchStatusResponse(
        query_id=sq.id,
        status=sq.status,
        total_matches=sq.total_matches or 0,
        output_video_url=video_url,
        error_message=sq.error_message,
        camera_name=camera_name,
        camera_location=camera_location,
        camera_id=camera_id,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Serve annotated output video
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/pipeline/video/{filename}",
    summary="Stream or download annotated output video",
    description="Returns the annotated MP4 for browser playback. No auth required (filename is a secure random hash).",
)
def serve_output_video(
    filename: str,
    download: bool = Query(default=False, description="Set true to force file download"),
):
    # Security: strip path separators — only allow bare filename
    safe_filename = Path(filename).name
    video_path = OUTPUT_DIR / safe_filename

    if not video_path.exists():
        raise HTTPException(status_code=404, detail=f"Video '{safe_filename}' not found.")

    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=safe_filename,
        content_disposition_type="attachment" if download else "inline",
    )
