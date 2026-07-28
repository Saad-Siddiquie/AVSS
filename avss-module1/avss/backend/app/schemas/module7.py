from pydantic import BaseModel


class Module7Feature(BaseModel):
    name: str
    description: str
    status: str


class Module7Overview(BaseModel):
    model_name: str
    task: str
    input_types: list[str]
    features: list[Module7Feature]
