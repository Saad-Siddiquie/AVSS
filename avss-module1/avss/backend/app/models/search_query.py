from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class SearchQuery(Base):
    """
    A search query submitted by the user.
    Stores the uploaded query image path and the annotated output video path.
    Integrates with Supabase Storage for cloud video/image hosting.
    """
    __tablename__ = "search_queries"

    id = Column(Integer, primary_key=True, index=True)

    job_id = Column(Integer, ForeignKey("video_jobs.id", ondelete="CASCADE"),
                    nullable=True, index=True)

    # Query image — local path + optional Supabase URL
    query_image_path = Column(String(500), nullable=False)
    query_image_url  = Column(String(1000), nullable=True)  # Supabase public URL
    query_embedding  = Column(Text, nullable=True)           # 512-dim JSON

    # Search config
    similarity_threshold = Column(Float, default=0.50)
    top_k = Column(Integer, default=20)

    # Results
    total_matches     = Column(Integer, default=0)
    output_video_path = Column(String(500),  nullable=True)  # local annotated MP4
    supabase_video_url = Column(String(1000), nullable=True)  # Supabase public URL
    results_json      = Column(Text, nullable=True)           # multi-camera hits JSON

    # Job / camera info for Gallery display
    source_name     = Column(String(255), nullable=True)   # e.g. camera name or filename
    camera_id_ref   = Column(Integer, nullable=True)       # camera used (for display)
    search_ref_id   = Column(String(50),  nullable=True)   # e.g. "AVSS-SEARCH-001"

    status        = Column(String(20), default="pending")
    error_message = Column(Text, nullable=True)

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
