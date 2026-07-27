from fastapi import APIRouter

from app.schemas.module5 import Module5Feature, Module5Overview

router = APIRouter(tags=["Module 5"])


@router.get("/module5/overview", response_model=Module5Overview)
def module5_overview():
    return Module5Overview(
        pipeline_name="Video Processing Pipeline",
        framework="OpenCV",
        input_sources=["Local Video", "RTSP Stream"],
        features=[
            Module5Feature(name="OpenCV", description="Core computer vision processing and frame handling.", status="Ready"),
            Module5Feature(name="Read Video", description="Decode and process video files from disk.", status="Ready"),
            Module5Feature(name="Read RTSP", description="Capture live streams from IP cameras or RTSP endpoints.", status="Ready"),
            Module5Feature(name="Frame Extraction", description="Extract frames for detection and analysis tasks.", status="Ready"),
            Module5Feature(name="FPS Control", description="Regulate processing speed for monitoring and debugging.", status="Ready"),
        ],
    )
