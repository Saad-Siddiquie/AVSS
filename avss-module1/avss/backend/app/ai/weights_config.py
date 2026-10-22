"""
Central YOLO weight paths and inference settings for AVSS.

Wildtrack person model (wildtrack_best.pt):
  - Trained imgsz=640, single class 'person'
  - Use the same imgsz at inference; tune conf/iou via env for your CCTV scene.
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
WEIGHTS_DIR = BACKEND_ROOT / "weights"
WEIGHTS_DIR.mkdir(exist_ok=True)

WILDTRACK_BEST_PT = WEIGHTS_DIR / "wildtrack_best.pt"
BEST_PT = WEIGHTS_DIR / "best.pt"
YOLO_FACE_PT = WEIGHTS_DIR / "yolov8n-face.pt"
YOLO_PERSON_PT = BACKEND_ROOT / "yolov8n.pt"

# Repo-root copy (optional sync source)
_REPO_WILDTRACK = BACKEND_ROOT.parent.parent.parent / "AVSS_YOLOv8_Wildtrack_best.pt"

# ── Person detector (Wildtrack) — match training imgsz ────────────────────────
PERSON_IMGSZ = int(os.environ.get("AVSS_PERSON_IMGSZ", "640"))
PERSON_CONF = float(os.environ.get("AVSS_PERSON_CONF", "0.35"))
PERSON_IOU = float(os.environ.get("AVSS_PERSON_IOU", "0.50"))
PERSON_MAX_DET = int(os.environ.get("AVSS_PERSON_MAX_DET", "100"))

# ── Face detector (YOLOv8-Face) ───────────────────────────────────────────────
FACE_IMGSZ = int(os.environ.get("AVSS_FACE_IMGSZ", "640"))
FACE_CONF = float(os.environ.get("AVSS_FACE_CONF", "0.40"))
FACE_IOU = float(os.environ.get("AVSS_FACE_IOU", "0.45"))
FACE_IN_PERSON_CONF = float(os.environ.get("AVSS_FACE_IN_PERSON_CONF", "0.30"))


def ensure_wildtrack_weights() -> Path:
    """
    Ensure weights/wildtrack_best.pt exists.
    Copies from AVSS_YOLOv8_Wildtrack_best.pt at repo root if missing.
    """
    if WILDTRACK_BEST_PT.exists():
        return WILDTRACK_BEST_PT
    if _REPO_WILDTRACK.exists():
        import shutil
        shutil.copy2(_REPO_WILDTRACK, WILDTRACK_BEST_PT)
        logger.info("Installed wildtrack_best.pt from repo root → %s", WILDTRACK_BEST_PT)
        return WILDTRACK_BEST_PT
    return WILDTRACK_BEST_PT


def resolve_person_weights_path() -> Path:
    """Return the .pt file PersonDetector should load."""
    ensure_wildtrack_weights()

    override = os.environ.get("AVSS_PERSON_WEIGHTS", "").strip()
    if override:
        p = Path(override)
        if not p.is_absolute():
            p = BACKEND_ROOT / p
        if p.exists():
            return p
        raise FileNotFoundError(f"AVSS_PERSON_WEIGHTS not found: {p}")

    if WILDTRACK_BEST_PT.exists():
        return WILDTRACK_BEST_PT
    if BEST_PT.exists():
        logger.warning("wildtrack_best.pt missing — using legacy best.pt")
        return BEST_PT

    return YOLO_PERSON_PT


def person_predict_kwargs(confidence: float | None = None) -> dict:
    """Ultralytics predict() kwargs aligned with Wildtrack training."""
    return {
        "conf": confidence if confidence is not None else PERSON_CONF,
        "iou": PERSON_IOU,
        "imgsz": PERSON_IMGSZ,
        "max_det": PERSON_MAX_DET,
        "verbose": False,
    }


def face_predict_kwargs(confidence: float | None = None) -> dict:
    return {
        "conf": confidence if confidence is not None else FACE_CONF,
        "iou": FACE_IOU,
        "imgsz": FACE_IMGSZ,
        "max_det": 50,
        "verbose": False,
    }


def log_inference_config() -> None:
    path = resolve_person_weights_path()
    logger.info(
        "Inference config — person=%s conf=%.2f iou=%.2f imgsz=%d | "
        "face=%s conf=%.2f iou=%.2f imgsz=%d",
        path.name,
        PERSON_CONF,
        PERSON_IOU,
        PERSON_IMGSZ,
        YOLO_FACE_PT.name if YOLO_FACE_PT.exists() else "missing",
        FACE_CONF,
        FACE_IOU,
        FACE_IMGSZ,
    )
