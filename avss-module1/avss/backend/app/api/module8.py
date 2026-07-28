from fastapi import APIRouter

from app.schemas.module8 import Module8Feature, Module8Overview

router = APIRouter(tags=["Module 8"])


@router.get("/module8/overview", response_model=Module8Overview)
def module8_overview():
    return Module8Overview(
        model_name="InsightFace",
        task="Face Recognition",
        input_types=["Image", "Video", "RTSP Stream"],
        features=[
            Module8Feature(name="Generate Face Embeddings", description="Create vector embeddings for detected faces.", status="Ready"),
            Module8Feature(name="Register Person", description="Store a known face embedding for later matching.", status="Ready"),
            Module8Feature(name="Compare Faces", description="Compare a probe face to registered identities.", status="Ready"),
        ],
    )
