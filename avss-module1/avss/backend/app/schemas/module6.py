from pydantic import BaseModel


class Module6Feature(BaseModel):
    name: str
    description: str
    status: str


class Module6Overview(BaseModel):
    model_name: str
    task: str
    input_types: list[str]
    features: list[Module6Feature]
