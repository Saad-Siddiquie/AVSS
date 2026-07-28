from fastapi import APIRouter

from app.schemas.module7 import Module7Feature, Module7Overview

router = APIRouter(tags=["Module 7"])


@router.get("/module7/overview", response_model=Module7Overview)
def module7_overview():
    return Module7Overview(
        model_name="YOLOv8-Face",
        task="Face Detection",
        input_types=["Image", "Video", "RTSP Stream"],
        features=[
            Module7Feature(name="Detect Face", description="Locate faces in image or video frames.", status="Ready"),
            Module7Feature(name="Crop Face", description="Extract detected face regions for downstream processing.", status="Ready"),
            Module7Feature(name="Save Face", description="Persist cropped faces for recognition or review workflows.", status="Ready"),
        ],
    )
