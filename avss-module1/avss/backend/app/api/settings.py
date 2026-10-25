"""
Settings API — system configuration (thresholds, fusion weights, camera streams).

GET  /api/v1/settings         → current settings
PUT  /api/v1/settings         → update settings (admin only)
GET  /api/v1/settings/status  → system status for the settings page

Settings are stored in memory (single-process dev mode).
For production, move to a Settings DB table or a JSON config file.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.api.auth import get_user_from_token, require_admin
from app.core.database import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Settings"])

# ── In-memory settings store ──────────────────────────────────────────────────
_settings: dict = {
    "system_name":       "AVSS",
    "language":          "en",
    "theme":             "dark",
    "notifications":     True,
    "auto_save_logs":    True,
    "face_threshold":    80,
    "body_threshold":    70,
    "face_weight":       60,
    "alert_unknown":     True,
    "alert_target":      True,
    "alert_sound":       False,
    "email_summary":     False,
}


class SettingsUpdate(BaseModel):
    system_name:    Optional[str]   = None
    language:       Optional[str]   = None
    theme:          Optional[str]   = None
    notifications:  Optional[bool]  = None
    auto_save_logs: Optional[bool]  = None
    face_threshold: Optional[int]   = None
    body_threshold: Optional[int]   = None
    face_weight:    Optional[int]   = None
    alert_unknown:  Optional[bool]  = None
    alert_target:   Optional[bool]  = None
    alert_sound:    Optional[bool]  = None
    email_summary:  Optional[bool]  = None


@router.get("/settings", summary="Get current system settings")
def get_settings(_user=Depends(get_user_from_token)):
    """Returns all current system settings. Available to any authenticated user."""
    return _settings


@router.put("/settings", summary="Update system settings (admin only)")
def update_settings(
    payload: SettingsUpdate,
    _admin=Depends(require_admin),
):
    """Update one or more settings. Only changed fields need to be sent."""
    data = payload.model_dump(exclude_none=True)
    _settings.update(data)
    logger.info("Settings updated: %s", list(data.keys()))
    return {"status": "saved", "settings": _settings}


@router.get("/settings/status", summary="System component status")
def system_status(_user=Depends(get_user_from_token)):
    """
    Returns live status of system components.
    Used by the Settings page and System Health card on the dashboard.
    """
    from app.core.database import test_connection
    from pathlib import Path

    db_ok = test_connection()

    # Check AI models loaded
    face_ok, arcface_ok, osnet_ok = False, False, False
    try:
        from app.ai.face import FaceDetector
        face_ok = FaceDetector._instance is not None
    except Exception:
        pass
    try:
        from app.ai.recognition import FaceRecognizer
        arcface_ok = FaceRecognizer._instance is not None
    except Exception:
        pass
    try:
        from app.ai.reid import PersonReID
        osnet_ok = PersonReID._instance is not None
    except Exception:
        pass

    # Disk space (uploads folder)
    uploads = Path("uploads")
    disk_used_mb = 0
    if uploads.exists():
        disk_used_mb = round(sum(f.stat().st_size for f in uploads.rglob("*") if f.is_file()) / 1e6, 1)

    return {
        "database":    {"status": "online" if db_ok else "error"},
        "backend_api": {"status": "online"},
        "face_detector": {
            "status": "online" if face_ok else "not_loaded",
            "model":  "yolov8n-face.pt",
        },
        "face_recognition": {
            "status": "online" if arcface_ok else "not_loaded",
            "model":  "ArcFace buffalo_l (512-dim)",
        },
        "person_reid": {
            "status": "online" if osnet_ok else "not_loaded",
            "model":  "OSNet osnet_final.pt",
        },
        "disk": {
            "uploads_used_mb": disk_used_mb,
        },
    }
