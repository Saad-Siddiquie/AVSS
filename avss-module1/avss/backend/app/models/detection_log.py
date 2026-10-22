from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from app.core.database import Base


class DetectionLog(Base):
    """
    One row per person detected in one frame of a processed video.
    Stores bounding box, track ID, and both face + body embeddings.
    """
    __tablename__ = "detection_logs"

    id = Column(Integer, primary_key=True, index=True)

    job_id = Column(Integer, ForeignKey("video_jobs.id", ondelete="CASCADE"),
                    nullable=False, index=True)
    frame_index = Column(Integer, nullable=False)
    timestamp_ms = Column(Float, nullable=False)       # ms from video start
    track_id = Column(Integer, nullable=True)          # ByteTrack ID

    # Bounding box (pixel coordinates)
    x1 = Column(Float, nullable=False)
    y1 = Column(Float, nullable=False)
    x2 = Column(Float, nullable=False)
    y2 = Column(Float, nullable=False)
    detection_confidence = Column(Float, nullable=False)

    # Embeddings stored as JSON strings (512-dim float lists)
    face_embedding = Column(Text, nullable=True)       # InsightFace 512-dim
    body_embedding = Column(Text, nullable=True)       # OSNet 512-dim (future)

    # Crop snapshot filename (saved to disk for reference)
    crop_filename = Column(String(255), nullable=True)
