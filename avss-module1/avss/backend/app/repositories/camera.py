"""
Camera Repository — all database access for the Camera model lives here.
The service layer calls this; API routes never touch the DB directly.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.camera import Camera
from app.schemas.camera import CameraCreate, CameraUpdate


def get_all(db: Session, skip: int = 0, limit: int = 100) -> list[Camera]:
    """Return a paginated list of all cameras ordered by creation date (newest first)."""
    return (
        db.query(Camera)
        .order_by(Camera.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def count_all(db: Session) -> int:
    """Return the total number of cameras."""
    return db.query(Camera).count()


def get_by_id(db: Session, camera_id: int) -> Optional[Camera]:
    """Return a single camera by primary key, or None if not found."""
    return db.query(Camera).filter(Camera.id == camera_id).first()


def get_by_name(db: Session, name: str) -> Optional[Camera]:
    """Return a camera matching the given name, or None."""
    return db.query(Camera).filter(Camera.name == name).first()


def create(db: Session, payload: CameraCreate) -> Camera:
    """Insert a new camera record and return it."""
    camera = Camera(
        name=payload.name,
        url=payload.url,
        camera_type=payload.camera_type,
        location=payload.location,
        status=payload.status or "inactive",
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


def update(db: Session, camera: Camera, payload: CameraUpdate) -> Camera:
    """Apply partial updates to an existing camera record."""
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camera, field, value)
    db.commit()
    db.refresh(camera)
    return camera


def delete(db: Session, camera: Camera) -> None:
    """Permanently delete a camera record."""
    db.delete(camera)
    db.commit()
