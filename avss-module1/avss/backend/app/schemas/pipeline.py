from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class JobCreateResponse(BaseModel):
    job_id: int
    status: str
    message: str


class JobStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: int
    source_type: str
    status: str
    progress: float
    total_frames: Optional[int]
    frames_processed: Optional[int] = None   # alias for total_frames during processing
    total_detections: int
    duration_seconds: Optional[float]
    duration: Optional[str] = None           # human-readable e.g. "01:30"
    error_message: Optional[str]
    source_file: Optional[str] = None        # original_filename or source_path basename
    original_filename: Optional[str] = None
    camera_id: Optional[int] = None
    created_at: Optional[datetime] = None


class TimelineEntry(BaseModel):
    frame_index: int
    timestamp_ms: float
    track_id: int
    similarity: float
    x1: float
    y1: float
    x2: float
    y2: float


class SearchResultResponse(BaseModel):
    query_id: int
    status: str
    total_matches: int
    matched_track_ids: list[int]
    output_video_url: Optional[str]
    timeline: list[TimelineEntry]
    error_message: Optional[str] = None


class CameraSearchHit(BaseModel):
    job_id: int
    camera_id: Optional[int] = None
    camera_name: str
    camera_location: Optional[str] = None
    total_matches: int
    best_similarity: float
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    output_video_url: Optional[str] = None
    timeline: list[TimelineEntry] = []


class SearchStatusResponse(BaseModel):
    query_id: int
    status: str
    total_matches: int
    output_video_url: Optional[str] = None
    error_message: Optional[str] = None
    camera_name: Optional[str] = None
    camera_location: Optional[str] = None
    camera_id: Optional[int] = None
    search_scope: str = "single"  # single | all_cameras
    hits: list[CameraSearchHit] = []
