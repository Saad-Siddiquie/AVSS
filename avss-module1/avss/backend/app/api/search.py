"""
Module 10 — FAISS Similarity Search API
Search for a person by uploading a face photo.
Returns the top-k most similar registered persons.
"""
import json
import logging

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.ai.video import decode_image_bytes
from app.api.auth import get_user_from_token
from app.schemas.person import FaceSearchResponse, SearchResult

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Module 10 — Similarity Search"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post(
    "/search/face",
    response_model=FaceSearchResponse,
    summary="Search for a person by face photo",
    description=(
        "Upload a face photo and get back the top matching registered persons "
        "ranked by cosine similarity. Uses InsightFace for embedding generation "
        "and FAISS for fast nearest-neighbour search."
    ),
)
async def search_by_face(
    image: UploadFile = File(..., description="Face photo to search for"),
    top_k: int = Query(default=5, ge=1, le=20, description="Number of results to return"),
    min_similarity: float = Query(
        default=0.30, ge=0.0, le=1.0,
        description="Minimum cosine similarity to include in results",
    ),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Find the most similar registered persons for a query face.
    Input:   face image file, top_k, min_similarity
    Output:  FaceSearchResponse with ranked matches
    Errors:  400 bad image, 422 no face found, 503 models unavailable
    """
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {image.content_type}")

    data = await image.read()
    try:
        frame = decode_image_bytes(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Generate embedding for the query face
    try:
        from app.ai.recognition import FaceRecognizer
        recognizer = FaceRecognizer.load()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Face recognition model unavailable: {exc}")

    query_embedding = recognizer.get_embedding(frame)
    if query_embedding is None:
        raise HTTPException(
            status_code=422,
            detail="No face detected in the uploaded image. Upload a clear face photo.",
        )

    # Search FAISS index
    try:
        from app.ai.search import FaceSearchIndex
        index = FaceSearchIndex.load()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Search index unavailable: {exc}")

    raw_results = index.search(
        query_embedding,
        top_k=top_k,
        min_similarity=min_similarity,
    )

    results = [SearchResult(**r) for r in raw_results]

    return FaceSearchResponse(
        query_processed=True,
        total_results=len(results),
        results=results,
        index_size=index.total,
    )
