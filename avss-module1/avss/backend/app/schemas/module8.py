from pydantic import BaseModel


class Module8Feature(BaseModel):
    name: str
    description: str
    status: str


class Module8Overview(BaseModel):
    model_name: str
    task: str
    input_types: list[str]
    features: list[Module8Feature]
