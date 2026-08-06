from sqlalchemy import Column, Integer, String, Text
from app.core.database import Base


class Person(Base):
    """
    Registered person in the surveillance system.
    photo_filename: saved under uploads/persons/
    embedding:      JSON-serialised 512-dim float list from InsightFace (nullable until Module 8 runs)
    """
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    description = Column(String, nullable=True)
    photo_filename = Column(String, nullable=False)
    # Stored as JSON string: "[0.123, -0.456, ...]" (512 floats)
    embedding = Column(Text, nullable=True)

    @property
    def has_embedding(self) -> bool:
        return self.embedding is not None
