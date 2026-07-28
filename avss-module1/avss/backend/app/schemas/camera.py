from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator

VALID_TYPES = {"rtsp", "webcam", "file"}
VALID_STATUSES = {"active", "inactive", "error"}


class CameraCreate(BaseModel):
    """Payload for creating a new camera."""
    name: str
    url: str
    camera_type: str
    location: Optional[str] = None
    status: Optional[str] = "inactive"

    @field_validator("camera_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_TYPES:
            raise ValueError(f"camera_type must be one of: {', '.join(VALID_TYPES)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(VALID_STATUSES)}")
        return v


class CameraUpdate(BaseModel):
    """Payload for updating an existing camera. All fields are optional."""
    name: Optional[str] = None
    url: Optional[str] = None
    camera_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("camera_type", mode="before")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"camera_type must be one of: {', '.join(VALID_TYPES)}")
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(VALID_STATUSES)}")
        return v


class CameraRead(BaseModel):
    """Response schema for a camera record."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    url: str
    camera_type: str
    location: Optional[str]
    status: str
    is_active: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


class CameraListResponse(BaseModel):
    """Paginated list of cameras."""
    total: int
    cameras: list[CameraRead]
