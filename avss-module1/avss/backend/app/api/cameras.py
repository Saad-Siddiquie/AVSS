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
