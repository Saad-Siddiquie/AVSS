from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class Camera(Base):
    """
    Represents a camera source in the surveillance system.
    Supports RTSP streams, webcams, USB cameras, and uploaded video files.
    """
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    url = Column(String(500), nullable=False)          # RTSP URL, device path, or file path
    camera_type = Column(String(20), nullable=False)   # rtsp | webcam | file
    location = Column(String(200), nullable=True)      # Physical location description
    status = Column(String(20), nullable=False, default="inactive")  # active | inactive | error
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Camera id={self.id} name={self.name!r} type={self.camera_type}>"
