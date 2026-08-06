from typing import Optional
from pydantic import BaseModel, ConfigDict


class PersonCreate(BaseModel):
    name: str
    age: int
    gender: str
    description: Optional[str] = ""


class PersonRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    age: int
    gender: str
    description: Optional[str]
    photo_filename: str
    has_embedding: bool


class PersonRegistrationResponse(BaseModel):
    id: int
    name: str
    age: int
    gender: str
    description: str
    photo_filename: str
    has_embedding: bool
    message: str


class SearchResult(BaseModel):
    rank: int
    person_id: int
    person_name: str
    similarity: float
    distance: float


class FaceSearchResponse(BaseModel):
    query_processed: bool
    total_results: int
    results: list[SearchResult]
    index_size: int
