from pydantic import BaseModel


class Module9Feature(BaseModel):
    name: str
    description: str
    status: str


class Module9Overview(BaseModel):
    task: str
    features: list[Module9Feature]


class PersonRegistrationResponse(BaseModel):
    id: int
    name: str
    age: int
    gender: str
    description: str
    photo_filename: str
    message: str
