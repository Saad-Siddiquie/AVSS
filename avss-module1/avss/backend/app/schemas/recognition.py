from typing import Optional
from pydantic import BaseModel


class EmbeddingResponse(BaseModel):
    embedding: list[float]      # 512-dim vector
    embedding_dim: int
    message: str


class FaceCompareResponse(BaseModel):
    similarity: float           # cosine similarity [0..1]
    distance: float             # 1 - similarity
    match: bool                 # True if similarity >= threshold
    threshold: float
