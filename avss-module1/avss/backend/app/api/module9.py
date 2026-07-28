import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.person import Person
from app.schemas.module9 import Module9Feature, Module9Overview, PersonRegistrationResponse

router = APIRouter(tags=["Module 9"])

# Directory where uploaded photos are stored
UPLOAD_DIR = Path("uploads/persons")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_MB = 5


@router.get("/module9/overview", response_model=Module9Overview)
def module9_overview():
    return Module9Overview(
        task="Person Registration",
        features=[
            Module9Feature(name="Upload Person Photo", description="Accept a photo of the person to register.", status="Ready"),
            Module9Feature(name="Name", description="Store the person's name for identification.", status="Ready"),
            Module9Feature(name="Age", description="Save the person's age as profile metadata.", status="Ready"),
            Module9Feature(name="Gender", description="Store the person's gender label.", status="Ready"),
            Module9Feature(name="Description", description="Add a free-text description for context.", status="Ready"),
            Module9Feature(name="Store Embeddings", description="Persist the generated face embedding for matching.", status="Ready"),
        ],
    )


@router.post("/module9/register", response_model=PersonRegistrationResponse, status_code=201)
async def register_person(
    name: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    description: str = Form(""),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Validate file type
    if photo.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{photo.content_type}'. Allowed: JPEG, PNG, WebP.",
        )

    # Read file and check size
    contents = await photo.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Photo must be under {MAX_FILE_SIZE_MB} MB.")

    # Save photo to disk with a safe filename
    ext = Path(photo.filename).suffix.lower() if photo.filename else ".jpg"
    safe_name = f"{name.replace(' ', '_')}_{os.urandom(4).hex()}{ext}"
    dest = UPLOAD_DIR / safe_name
    with open(dest, "wb") as f:
        f.write(contents)

    # Persist person record
    person = Person(
        name=name,
        age=age,
        gender=gender,
        description=description,
        photo_filename=safe_name,
        embedding=None,  # populated in Module 10 (FAISS / InsightFace)
    )
    db.add(person)
    db.commit()
    db.refresh(person)

    return PersonRegistrationResponse(
        id=person.id,
        name=person.name,
        age=person.age,
        gender=person.gender,
        description=person.description or "",
        photo_filename=person.photo_filename,
        message=f"Person '{person.name}' registered successfully.",
    )
