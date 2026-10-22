from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class SearchQuery(Base):
    """
    A search query submitted by the user.
    Stores the uploaded query image path and the annotated output video path.
    """
    __tablename__ = "search_queries"

    id = Column(Integer, primary_key=True, index=True)

    job_id = Column(Integer, ForeignKey("video_jobs.id", ondelete="CASCADE"),
                    nullable=False, index=True)

    # Query image
    query_image_path = Column(String(500), nullable=False)
    query_embedding = Column(Text, nullable=True)      # 512-dim JSON

    # Search config
    similarity_threshold = Column(Float, default=0.50)
    top_k = Column(Integer, default=20)

    # Results
    total_matches = Column(Integer, default=0)
    output_video_path = Column(String(500), nullable=True)   # annotated MP4
    status = Column(String(20), default="pending")
    # pending → processing → completed | failed
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
