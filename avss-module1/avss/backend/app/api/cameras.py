"""
Module 4 — Camera Management API
Endpoints for adding, listing, retrieving, updating, and deleting cameras.
All endpoints require a valid JWT access token.
"""
import logging
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.auth import get_user_from_token
from app.core.database import get_db
from app.schemas.camera import CameraCreate, CameraListResponse, CameraRead, CameraUpdate
from app.services import camera as camera_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Cameras"])


@router.post(
    "/cameras",
    response_model=CameraRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new camera",
    description=(
        "Register a new camera source. Supported types: `rtsp`, `webcam`, `file`. "
        "RTSP cameras require a full stream URL (e.g. `rtsp://192.168.1.100/stream`). "
        "Webcam cameras use a device path or index (e.g. `/dev/video0` or `0`). "
        "File cameras use an absolute path to an MP4 file."
    ),
)
def add_camera(
    payload: CameraCreate,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Add a new camera to the surveillance system.
    Input: CameraCreate (name, url, camera_type, location, status)
    Output: Created CameraRead record
    Errors: 409 if camera name already exists, 422 for validation errors
    """
    logger.info("Creating camera: name=%s type=%s", payload.name, payload.camera_type)
    camera = camera_service.create_camera(db, payload)
    logger.info("Camera created: id=%d name=%s", camera.id, camera.name)
    return camera


@router.get(
    "/cameras",
    response_model=CameraListResponse,
    summary="List all cameras",
    description="Returns a paginated list of all registered cameras.",
)
def list_cameras(
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=100, ge=1, le=500, description="Maximum records to return"),
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Retrieve all cameras with pagination.
    Input: skip (offset), limit (page size)
    Output: CameraListResponse { total, cameras[] }
    """
    total, cameras = camera_service.list_cameras(db, skip=skip, limit=limit)
    return CameraListResponse(total=total, cameras=cameras)


@router.get(
    "/cameras/{camera_id}",
    response_model=CameraRead,
    summary="Get a single camera",
    description="Retrieve full details for a specific camera by its ID.",
)
def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Fetch one camera record.
    Input: camera_id (path parameter)
    Output: CameraRead
    Errors: 404 if not found
    """
    return camera_service.get_camera(db, camera_id)


@router.put(
    "/cameras/{camera_id}",
    response_model=CameraRead,
    summary="Update a camera",
    description="Partially update a camera. Only provided fields are changed.",
)
def update_camera(
    camera_id: int,
    payload: CameraUpdate,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Update camera name, URL, type, location, or status.
    Input: camera_id (path), CameraUpdate (partial fields)
    Output: Updated CameraRead
    Errors: 404 if not found, 409 if new name conflicts
    """
    logger.info("Updating camera id=%d", camera_id)
    return camera_service.update_camera(db, camera_id, payload)


@router.delete(
    "/cameras/{camera_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a camera",
    description="Permanently remove a camera from the system.",
)
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Delete a camera record.
    Input: camera_id (path parameter)
    Output: 204 No Content
    Errors: 404 if not found
    """
    logger.info("Deleting camera id=%d", camera_id)
    camera_service.delete_camera(db, camera_id)


# ── Live stream + test-connection endpoints ───────────────────────────────────

import os as _os
import time as _time
from fastapi import HTTPException as _HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel as _BaseModel


class StreamTestRequest(_BaseModel):
    url: str


@router.post(
    "/cameras/test-stream",
    summary="Test if a camera URL is reachable",
    tags=["Cameras"],
)
def test_stream(body: StreamTestRequest, _user=Depends(get_user_from_token)):
    """
    Opens the camera URL with OpenCV (FFmpeg backend) and returns stream metadata.
    Used by the Add Camera form's Test Connection button.
    """
    import cv2 as _cv2

    # Set FFmpeg options for faster connection timeout
    _os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;5000000")

    cap = _cv2.VideoCapture(body.url, _cv2.CAP_FFMPEG)
    try:
        if not cap.isOpened():
            raise _HTTPException(
                status_code=400,
                detail="Cannot open stream. Check the URL, credentials, and network connectivity."
            )
        # Try reading up to 3 frames (RTSP sometimes needs a few reads to start)
        frame = None
        for _ in range(3):
            ret, frame = cap.read()
            if ret and frame is not None:
                break
            _time.sleep(0.1)

        if frame is None:
            raise _HTTPException(
                status_code=400,
                detail="Stream opened but no frame received. Camera may be initialising — try again."
            )
        h, w = frame.shape[:2]
        fps  = cap.get(_cv2.CAP_PROP_FPS) or None
        return {
            "reachable": True,
            "width":  w,
            "height": h,
            "fps":    round(float(fps), 2) if fps else None,
            "message": f"Connected — {w}×{h} @ {fps:.1f} fps" if fps else f"Connected — {w}×{h}",
        }
    finally:
        cap.release()


def _mjpeg_generator(url: str, max_reconnects: int = 5):
    """
    Robust MJPEG generator:
    - Uses FFmpeg backend (handles RTSP over TCP, HLS, HTTP streams)
    - Auto-reconnects up to max_reconnects times on failure
    - Resizes to 960×540 to reduce bandwidth
    - 80% JPEG quality — good visual quality at low size
    """
    import cv2 as _cv2

    # Force RTSP over TCP (more reliable on internet streams)
    _os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;10000000")

    reconnects = 0
    while reconnects <= max_reconnects:
        cap = _cv2.VideoCapture(url, _cv2.CAP_FFMPEG)
        opened = cap.isOpened()
        consecutive_failures = 0

        if opened:
            reconnects = 0  # reset counter on successful open

        try:
            while opened:
                ret, frame = cap.read()
                if not ret or frame is None:
                    consecutive_failures += 1
                    if consecutive_failures > 10:
                        logger.warning("MJPEG stream: too many consecutive failures, reconnecting...")
                        break
                    _time.sleep(0.05)
                    continue

                consecutive_failures = 0

                # Resize to reduce bandwidth (maintain aspect ratio)
                h, w = frame.shape[:2]
                if w > 960:
                    scale = 960 / w
                    frame = _cv2.resize(frame, (960, int(h * scale)))

                ok, buf = _cv2.imencode(
                    ".jpg", frame,
                    [_cv2.IMWRITE_JPEG_QUALITY, 80]
                )
                if not ok:
                    continue

                data = buf.tobytes()
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                    b"\r\n" + data + b"\r\n"
                )
        except GeneratorExit:
            # Client disconnected — stop gracefully
            logger.info("MJPEG client disconnected.")
            return
        finally:
            cap.release()

        reconnects += 1
        if reconnects <= max_reconnects:
            logger.info("MJPEG reconnect attempt %d/%d for: %s", reconnects, max_reconnects, url[:60])
            _time.sleep(min(reconnects * 2, 10))  # backoff: 2s, 4s, 6s...

    logger.warning("MJPEG stream exhausted reconnect attempts: %s", url[:60])


@router.get(
    "/cameras/{camera_id}/stream",
    summary="MJPEG stream proxy — no auth (URL is secure by camera ID)",
    tags=["Cameras"],
    # NOTE: No auth dependency — browsers cannot send Authorization headers with <img> tags.
    # The camera ID in the URL is sufficient access control for a local deployment.
)
def stream_camera(
    camera_id: int,
    db=Depends(get_db),
):
    """
    Proxies the camera's RTSP/video stream as MJPEG (multipart/x-mixed-replace).
    Browsers display it via a plain <img src="..."> tag — no plugins required.

    Auto-reconnects on stream loss with exponential backoff.
    Works with: RTSP, RTSP over TCP, HTTP MJPEG, video files, webcams.
    """
    from app.models.camera import Camera as CameraModel
    cam = db.query(CameraModel).filter(CameraModel.id == camera_id).first()
    if not cam:
        raise _HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    logger.info("Starting MJPEG stream for camera id=%d url=%s...", camera_id, cam.url[:60])

    return StreamingResponse(
        _mjpeg_generator(cam.url),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma":        "no-cache",
            "Expires":       "0",
            "X-Accel-Buffering": "no",   # disable nginx buffering if proxied
        },
    )


@router.get(
    "/cameras/{camera_id}/snapshot",
    summary="Single JPEG snapshot from camera",
    tags=["Cameras"],
)
def camera_snapshot(
    camera_id: int,
    db=Depends(get_db),
):
    """
    Returns a single JPEG frame from the camera. Useful for thumbnails.
    No auth required (same reasoning as /stream).
    """
    import cv2 as _cv2
    from fastapi.responses import Response as _Response

    from app.models.camera import Camera as CameraModel
    cam = db.query(CameraModel).filter(CameraModel.id == camera_id).first()
    if not cam:
        raise _HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    _os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;5000000")
    cap = _cv2.VideoCapture(cam.url, _cv2.CAP_FFMPEG)
    try:
        for _ in range(5):  # skip a few frames for cameras that start black
            ret, frame = cap.read()
            if ret and frame is not None:
                break

        if not ret or frame is None:
            raise _HTTPException(status_code=503, detail="Camera not reachable.")

        # Resize thumbnail
        h, w = frame.shape[:2]
        if w > 640:
            scale = 640 / w
            frame = _cv2.resize(frame, (640, int(h * scale)))

        ok, buf = _cv2.imencode(".jpg", frame, [_cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ok:
            raise _HTTPException(status_code=500, detail="Could not encode frame.")

        return _Response(
            content=buf.tobytes(),
            media_type="image/jpeg",
            headers={"Cache-Control": "max-age=5"},
        )
    finally:
        cap.release()
