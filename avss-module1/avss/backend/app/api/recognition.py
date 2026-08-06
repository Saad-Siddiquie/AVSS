"""
Module 8 — Face Recognition API
Generate face embeddings and compare two face images.
"""
import logging

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.ai.video import decode_image_bytes
from app.api.auth import get_user_from_token
from app.schemas.recognition import EmbeddingResponse, FaceCompareResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Module 8 — Face Recognition"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
DEFAULT_MATCH_THRESHOLD = 0.40


@router.post(
    "/recognize/embed",
    response_model=EmbeddingResponse,
    summary="Generate face embedding",
    description=(
        "Upload a face image. Returns a 512-dimensional InsightFace embedding "
        "that can be stored and used for similarity search."
    ),
)
async def generate_embedding(
    image: UploadFile = File(..., description="Face image (JPEG/PNG/WebP)"),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Generate a 512-dim face embedding from an uploaded face image.
    Input:   image file (multipart)
    Output:  EmbeddingResponse with 512-float list
    Errors:  400 if no face found, 503 if model unavailable
    """
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {image.content_type}")

    data = await image.read()
    try:
        frame = decode_image_bytes(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        from app.ai.recognition import FaceRecognizer
        recognizer = FaceRecognizer.load()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Face recognition model not available: {exc}")

    embedding = recognizer.get_embedding(frame)
    if embedding is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No face detected in the uploaded image. Please upload a clear face photo.",
        )

    return EmbeddingResponse(
        embedding=embedding.tolist(),
        embedding_dim=len(embedding),
        message="Face embedding generated successfully.",
    )


@router.post(
    "/recognize/compare",
    response_model=FaceCompareResponse,
    summary="Compare two face images",
    description=(
        "Upload two face images. Returns cosine similarity score and whether "
        "they are considered the same person."
    ),
)
async def compare_faces(
    image1: UploadFile = File(..., description="First face image"),
    image2: UploadFile = File(..., description="Second face image"),
    threshold: float = Query(
        default=DEFAULT_MATCH_THRESHOLD,
        ge=0.0, le=1.0,
        description="Similarity threshold for a positive match",
    ),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Compare two faces and return similarity score.
    Input:   two image files, optional threshold
    Output:  FaceCompareResponse with similarity, distance, match bool
    Errors:  400/422 if images are bad or faces not found
    """
    for img in (image1, image2):
        if img.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported image type: {img.content_type}")

    try:
        from app.ai.recognition import FaceRecognizer
        recognizer = FaceRecognizer.load()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Face recognition model not available: {exc}")

    embeddings = []
    for img in (image1, image2):
        data = await img.read()
        try:
            frame = decode_image_bytes(data)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        emb = recognizer.get_embedding(frame)
        if emb is None:
            raise HTTPException(
                status_code=422,
                detail=f"No face detected in '{img.filename}'. Upload a clear face photo.",
            )
        embeddings.append(emb)

    similarity = FaceRecognizer.cosine_similarity(embeddings[0], embeddings[1])
    distance = round(1.0 - similarity, 4)

    return FaceCompareResponse(
        similarity=round(similarity, 4),
        distance=distance,
        match=similarity >= threshold,
        threshold=threshold,
    )
