from fastapi import APIRouter

from app.core.database import test_connection

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    """Basic liveness + DB connectivity check used to confirm Module 1 setup works."""
    db_ok = test_connection()
    return {
        "status": "ok",
        "service": "AVSS Backend",
        "database_connected": db_ok,
    }
