from typing import Optional
from pydantic import BaseModel, ConfigDict


class JobCreateResponse(BaseModel):
    job_id: int
    status: str
    message: str


class JobStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: int
    status: str
    progress: float
    total_frames: Optional[int]
    total_detections: int
    duration_seconds: Optional[float]
    error_message: Optional[str]


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


class SearchStatusResponse(BaseModel):
    query_id: int
    status: str
    total_matches: int
    output_video_url: Optional[str]
    error_message: Optional[str]
    camera_name: Optional[str] = None
    camera_location: Optional[str] = None
    camera_id: Optional[int] = None
