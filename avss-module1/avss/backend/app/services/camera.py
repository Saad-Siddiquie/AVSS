"""
Camera Service — business logic for camera management.
Validates rules (e.g. duplicate names) before delegating to the repository.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.camera import Camera
from app.repositories import camera as camera_repo
from app.schemas.camera import CameraCreate, CameraUpdate


def list_cameras(db: Session, skip: int = 0, limit: int = 100) -> tuple[int, list[Camera]]:
    """Return (total_count, camera_list) for the requested page."""
    total = camera_repo.count_all(db)
    cameras = camera_repo.get_all(db, skip=skip, limit=limit)
    return total, cameras


def get_camera(db: Session, camera_id: int) -> Camera:
    """Fetch a camera by ID or raise 404."""
    camera = camera_repo.get_by_id(db, camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id={camera_id} not found.",
        )
    return camera


def create_camera(db: Session, payload: CameraCreate) -> Camera:
    """
    Create a new camera.
    Raises 409 if a camera with the same name already exists.
    """
    existing = camera_repo.get_by_name(db, payload.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A camera named '{payload.name}' already exists.",
        )
    return camera_repo.create(db, payload)


def update_camera(db: Session, camera_id: int, payload: CameraUpdate) -> Camera:
    """
    Update an existing camera.
    Raises 404 if not found; 409 if the new name conflicts with another camera.
    """
    camera = get_camera(db, camera_id)

    # Check for name conflict only when the name is being changed
    if payload.name and payload.name != camera.name:
        conflicting = camera_repo.get_by_name(db, payload.name)
        if conflicting:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A camera named '{payload.name}' already exists.",
            )

    return camera_repo.update(db, camera, payload)


def delete_camera(db: Session, camera_id: int) -> None:
    """Delete a camera by ID. Raises 404 if not found."""
    camera = get_camera(db, camera_id)
    camera_repo.delete(db, camera)
