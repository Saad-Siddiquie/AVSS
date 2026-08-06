from pydantic import BaseModel


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    label: str
    width: float
    height: float


class PersonDetectionResponse(BaseModel):
    person_count: int
    detections: list[BoundingBox]
    image_width: int
    image_height: int


class FaceDetectionResponse(BaseModel):
    face_count: int
    detections: list[BoundingBox]
    image_width: int
    image_height: int
