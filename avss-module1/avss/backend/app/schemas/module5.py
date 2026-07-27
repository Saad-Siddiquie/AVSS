from pydantic import BaseModel


class Module5Feature(BaseModel):
    name: str
    description: str
    status: str


class Module5Overview(BaseModel):
    pipeline_name: str
    framework: str
    input_sources: list[str]
    features: list[Module5Feature]
