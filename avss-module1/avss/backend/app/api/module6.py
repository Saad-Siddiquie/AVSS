from fastapi import APIRouter

from app.schemas.module6 import Module6Feature, Module6Overview

router = APIRouter(tags=["Module 6"])


@router.get("/module6/overview", response_model=Module6Overview)
def module6_overview():
    return Module6Overview(
        model_name="YOLOv8",
        task="Person Detection",
        input_types=["Image", "Video", "RTSP Stream"],
        features=[
            Module6Feature(name="Detect Person", description="Locate people in frames with object detection.", status="Ready"),
            Module6Feature(name="Bounding Boxes", description="Draw bounding boxes around detected persons.", status="Ready"),
            Module6Feature(name="Confidence Score", description="Estimate the confidence for each detection.", status="Ready"),
        ],
    )
