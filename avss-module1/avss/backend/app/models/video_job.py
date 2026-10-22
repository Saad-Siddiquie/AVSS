from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class VideoJob(Base):
    """
    Represents a video processing job.
    Created when user submits a video (uploaded file or registered camera RTSP URL).
    """
    __tablename__ = "video_jobs"

    id = Column(Integer, primary_key=True, index=True)

    # Source info
    source_type = Column(String(20), nullable=False)   # "upload" | "camera"
    source_path = Column(String(500), nullable=False)  # file path or RTSP URL
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    original_filename = Column(String(255), nullable=True)

    # Job status
    status = Column(String(20), nullable=False, default="pending")
    # pending → processing → completed | failed
    progress = Column(Float, default=0.0)              # 0.0 – 100.0
    error_message = Column(Text, nullable=True)

    # Video metadata (filled after processing)
    total_frames = Column(Integer, nullable=True)
    fps = Column(Float, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    total_detections = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
