from fastapi import APIRouter

from app.schemas.module4 import Module4Alert, Module4Overview

router = APIRouter(tags=["Module 4"])


@router.get("/module4/overview", response_model=Module4Overview)
def module4_overview():
    return Module4Overview(
        workflow_status="Operational",
        queue_size=24,
        active_alerts=6,
        resolved_today=18,
        alerts=[
            Module4Alert(
                id=1,
                title="Crowd detected near entrance",
                zone="Front Entrance",
                severity="High",
                description="Multiple subjects detected in the monitored perimeter.",
                status="Open",
            ),
            Module4Alert(
                id=2,
                title="Vehicle stopped in restricted zone",
                zone="Parking Lot",
                severity="Medium",
                description="A vehicle remained stationary beyond the allowed interval.",
                status="Reviewing",
            ),
            Module4Alert(
                id=3,
                title="Low-confidence detection resolved",
                zone="Loading Bay",
                severity="Low",
                description="The event was reviewed and closed automatically.",
                status="Resolved",
            ),
        ],
    )
