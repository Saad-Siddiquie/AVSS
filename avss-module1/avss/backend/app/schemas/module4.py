from pydantic import BaseModel


class Module4Alert(BaseModel):
    id: int
    title: str
    zone: str
    severity: str
    description: str
    status: str


class Module4Overview(BaseModel):
    workflow_status: str
    queue_size: int
    active_alerts: int
    resolved_today: int
    alerts: list[Module4Alert]
