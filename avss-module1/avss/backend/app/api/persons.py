"""
Module 9 — Person Registration API
Register a person with photo + metadata.
Automatically generates a face embedding (Module 8) and indexes it in FAISS (Module 10).
"""
import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.ai.video import decode_image_bytes
from app.api.auth import get_user_from_token
from app.core.database import get_db
from app.models.person import Person
from app.schemas.person import PersonRead, PersonRegistrationResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Module 9 — Person Registration"])

UPLOAD_DIR = Path("uploads/persons")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 5


@router.post(
    "/persons/register",
    response_model=PersonRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new person",
    description=(
        "Upload a photo and personal details. The system will: "
        "1) save the photo to disk, "
        "2) generate a 512-dim face embedding via InsightFace, "
        "3) store the person record in the database, "
        "4) add the embedding to the FAISS search index."
    ),
)
async def register_person(
    name: str = Form(...),
    age: int = Form(..., ge=1, le=120),
    gender: str = Form(...),
    description: str = Form(""),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Register a new person with photo and generate face embedding.
    Input:   multipart form (name, age, gender, description, photo)
    Output:  PersonRegistrationResponse
    Errors:  400 for bad photo, 422 if no face detected
    """
    # ── Validate photo ───────────────────────────────────────────────────────
    if photo.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{photo.content_type}'. Use JPEG, PNG, or WebP.",
        )
    contents = await photo.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Photo must be under {MAX_SIZE_MB} MB.")

    # ── Decode image ─────────────────────────────────────────────────────────
    try:
        frame = decode_image_bytes(contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # ── Generate embedding (Module 8) ─────────────────────────────────────────
    embedding_json: str | None = None
    try:
        from app.ai.recognition import FaceRecognizer
        recognizer = FaceRecognizer.load()
        embedding = recognizer.get_embedding(frame)
        if embedding is None:
            raise HTTPException(
                status_code=422,
                detail="No face detected in the uploaded photo. Please upload a clear face photo.",
            )
        embedding_json = json.dumps(embedding.tolist())
    except HTTPException:
        raise
    except Exception as exc:
        # Model not loaded — register without embedding (will be generated later)
        logger.warning("FaceRecognizer unavailable during registration: %s", exc)

    # ── Save photo to disk ───────────────────────────────────────────────────
    ext = Path(photo.filename).suffix.lower() if photo.filename else ".jpg"
    safe_name = f"{name.replace(' ', '_')}_{os.urandom(4).hex()}{ext}"
    dest = UPLOAD_DIR / safe_name
    dest.write_bytes(contents)
    logger.info("Saved photo: %s", dest)

    # ── Persist person record ─────────────────────────────────────────────────
    person = Person(
        name=name,
        age=age,
        gender=gender,
        description=description,
        photo_filename=safe_name,
        embedding=embedding_json,
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    logger.info("Registered person: id=%d name=%s", person.id, person.name)

    # ── Add to FAISS index (Module 10) ────────────────────────────────────────
    if embedding_json:
        try:
            import numpy as np
            from app.ai.search import FaceSearchIndex
            index = FaceSearchIndex.load()
            emb_array = np.array(json.loads(embedding_json), dtype="float32")
            index.add(emb_array, person_id=person.id, person_name=person.name)
            logger.info("Added person id=%d to FAISS index.", person.id)
        except Exception as exc:
            logger.error("Failed to add embedding to FAISS index: %s", exc)

    return PersonRegistrationResponse(
        id=person.id,
        name=person.name,
        age=person.age,
        gender=person.gender,
        description=person.description or "",
        photo_filename=person.photo_filename,
        has_embedding=person.has_embedding,
        message=f"Person '{person.name}' registered successfully.",
    )


@router.get(
    "/persons",
    response_model=list[PersonRead],
    summary="List all registered persons",
)
def list_persons(
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """Return all registered persons."""
    persons = db.query(Person).order_by(Person.id).all()
    return [
        PersonRead(
            id=p.id,
            name=p.name,
            age=p.age,
            gender=p.gender,
            description=p.description,
            photo_filename=p.photo_filename,
            has_embedding=p.has_embedding,
        )
        for p in persons
    ]


@router.get(
    "/persons/{person_id}",
    response_model=PersonRead,
    summary="Get a registered person by ID",
)
def get_person(
    person_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail=f"Person id={person_id} not found.")
    return PersonRead(
        id=person.id,
        name=person.name,
        age=person.age,
        gender=person.gender,
        description=person.description,
        photo_filename=person.photo_filename,
        has_embedding=person.has_embedding,
    )
