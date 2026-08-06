from pydantic import BaseModel


class VideoSourceInfo(BaseModel):
    source: str
    native_fps: float
    width: int
    height: int
    total_frames: int
    message: str


class FrameExtractResponse(BaseModel):
    frame_index: int
    timestamp_ms: float
    width: int
    height: int
    jpeg_base64: str
