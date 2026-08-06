"""
Module 5 — Video Processing API
Endpoints to probe a video source and extract a sample frame.
"""
import base64
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.ai.video import VideoSource, decode_image_bytes, encode_image_to_jpeg
from app.api.auth import get_user_from_token
from app.schemas.video import FrameExtractResponse, VideoSourceInfo

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Module 5 — Video Processing"])


@router.get(
    "/video/probe",
    response_model=VideoSourceInfo,
    summary="Probe a video source",
    description=(
        "Open a video source and return its metadata (resolution, FPS, frame count). "
        "Pass the camera URL, device index (0 for webcam), or absolute file path as `source`."
    ),
)
def probe_video_source(
    source: str = Query(..., description="RTSP URL, webcam index (0), or file path"),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Verify a video source is reachable and return its properties.
    Input:   source (query param)
    Output:  VideoSourceInfo
    Errors:  400 if source cannot be opened
    """
    try:
        vs = VideoSource(source)
        info = VideoSourceInfo(
            source=source,
            native_fps=vs.native_fps,
            width=vs.width,
            height=vs.height,
            total_frames=vs.total_frames,
            message="Video source opened successfully.",
        )
        vs.release()
        return info
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/video/frame",
    response_model=FrameExtractResponse,
    summary="Extract a single frame",
    description="Read one frame from a video source and return it as a base64-encoded JPEG.",
)
def extract_frame(
    source: str = Query(..., description="RTSP URL, webcam index (0), or file path"),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Grab one frame for preview or pipeline testing.
    Input:   source (query param)
    Output:  FrameExtractResponse with base64 JPEG
    Errors:  400 if source cannot be opened or frame cannot be read
    """
    try:
        vs = VideoSource(source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        frame = vs.read_one()
        if frame is None:
            raise HTTPException(status_code=400, detail="Could not read a frame from the source.")

        jpeg_bytes = encode_image_to_jpeg(frame)
        info = FrameExtractResponse(
            frame_index=0,
            timestamp_ms=0.0,
            width=frame.shape[1],
            height=frame.shape[0],
            jpeg_base64=base64.b64encode(jpeg_bytes).decode(),
        )
        return info
    finally:
        vs.release()
