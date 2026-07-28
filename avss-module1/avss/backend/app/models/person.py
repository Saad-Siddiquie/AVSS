from sqlalchemy import Column, Integer, String
from app.core.database import Base


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    description = Column(String, nullable=True)
    photo_filename = Column(String, nullable=False)
    # embedding stored as a comma-separated float string (placeholder until FAISS in Module 10)
    embedding = Column(String, nullable=True)
