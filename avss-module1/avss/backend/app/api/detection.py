"""
Module 6 & 7 — Person Detection and Face Detection API
Accepts uploaded images, runs detection, returns bounding boxes.
"""
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.ai.video import decode_image_bytes
from app.api.auth import get_user_from_token
from app.schemas.detection import BoundingBox, FaceDetectionResponse, PersonDetectionResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Module 6 & 7 — Detection"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _validate_image(upload: UploadFile) -> bytes:
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type: {upload.content_type}. Use JPEG, PNG, or WebP.",
        )
    return None  # reading happens async below


@router.post(
    "/detect/persons",
    response_model=PersonDetectionResponse,
    summary="Detect persons in an image",
    description=(
        "Upload a JPEG/PNG image. Returns bounding boxes and confidence scores "
        "for all persons detected using YOLOv8n."
    ),
)
async def detect_persons(
    image: UploadFile = File(..., description="JPEG/PNG/WebP image"),
    confidence: float = Query(default=0.40, ge=0.01, le=1.0, description="Detection confidence threshold"),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Detect people in an uploaded image frame.
    Input:   image file (multipart), optional confidence threshold
    Output:  PersonDetectionResponse with bounding boxes
    Errors:  400 for bad image, 503 if model not loaded
    """
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {image.content_type}")

    data = await image.read()
    try:
        frame = decode_image_bytes(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        from app.ai.detection import PersonDetector
        detector = PersonDetector.load()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Person detection model not available: {exc}")

    detections = detector.detect(frame, confidence_threshold=confidence)

    return PersonDetectionResponse(
        person_count=len(detections),
        detections=[BoundingBox(**d.to_dict()) for d in detections],
        image_width=frame.shape[1],
        image_height=frame.shape[0],
    )


@router.post(
    "/detect/faces",
    response_model=FaceDetectionResponse,
    summary="Detect faces in an image",
    description=(
        "Upload a JPEG/PNG image. Returns bounding boxes for all faces detected "
        "using OpenCV DNN (ResNet-SSD)."
    ),
)
async def detect_faces(
    image: UploadFile = File(..., description="JPEG/PNG/WebP image"),
    confidence: float = Query(default=0.50, ge=0.01, le=1.0, description="Detection confidence threshold"),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Detect faces in an uploaded image.
    Input:   image file (multipart), optional confidence threshold
    Output:  FaceDetectionResponse with bounding boxes
    Errors:  400 for bad image, 503 if model not loaded
    """
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {image.content_type}")

    data = await image.read()
    try:
        frame = decode_image_bytes(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        from app.ai.face import FaceDetector
        detector = FaceDetector.load()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Face detection model not available: {exc}")

    detections = detector.detect(frame, confidence_threshold=confidence)

    return FaceDetectionResponse(
        face_count=len(detections),
        detections=[
            BoundingBox(
                x1=float(d.x1), y1=float(d.y1),
                x2=float(d.x2), y2=float(d.y2),
                confidence=d.confidence,
                label="face",
                width=float(d.width),
                height=float(d.height),
            )
            for d in detections
        ],
        image_width=frame.shape[1],
        image_height=frame.shape[0],
    )
