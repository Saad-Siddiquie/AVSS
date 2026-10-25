"""
Central AI model weight paths and inference settings for AVSS.

Available weights:
  weights/wildtrack_best.pt   — YOLOv8 person detector (Wildtrack-trained, best for CCTV)
  weights/best.pt             — YOLOv8 custom model (backup)
  weights/yolov8n-face.pt     — YOLOv8-Face detector (ArcFace crops)
  weights/osnet_final.pt      — OSNet re-ID (clothing/body matching)

InsightFace buffalo_l is downloaded automatically to ~/.insightface on first use (~500 MB).
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_ROOT = Path(__file__).resolve().parents[2]
WEIGHTS_DIR  = BACKEND_ROOT / "weights"
WEIGHTS_DIR.mkdir(exist_ok=True)

WILDTRACK_BEST_PT = WEIGHTS_DIR / "wildtrack_best.pt"   # person CCTV detector ← primary
BEST_PT           = WEIGHTS_DIR / "best.pt"              # backup person detector
YOLO_FACE_PT      = WEIGHTS_DIR / "yolov8n-face.pt"     # face detector
OSNET_PT          = WEIGHTS_DIR / "osnet_final.pt"      # person re-ID
YOLO_PERSON_PT    = BACKEND_ROOT / "yolov8n.pt"         # last-resort COCO detector

# Legacy repo-root copy
_REPO_WILDTRACK = BACKEND_ROOT.parent.parent.parent / "AVSS_YOLOv8_Wildtrack_best.pt"

# ── Person Detector (wildtrack_best.pt) — tuned for CCTV ─────────────────────
# These defaults are good for real CCTV footage. Fine-tune via env vars.
PERSON_IMGSZ   = int(os.environ.get("AVSS_PERSON_IMGSZ",   "640"))
PERSON_CONF    = float(os.environ.get("AVSS_PERSON_CONF",   "0.30"))  # lower = more recall
PERSON_IOU     = float(os.environ.get("AVSS_PERSON_IOU",    "0.45"))
PERSON_MAX_DET = int(os.environ.get("AVSS_PERSON_MAX_DET", "100"))

# ── Face Detector (yolov8n-face.pt) ──────────────────────────────────────────
FACE_IMGSZ          = int(os.environ.get("AVSS_FACE_IMGSZ",          "640"))
FACE_CONF           = float(os.environ.get("AVSS_FACE_CONF",           "0.40"))
FACE_IOU            = float(os.environ.get("AVSS_FACE_IOU",            "0.45"))
FACE_IN_PERSON_CONF = float(os.environ.get("AVSS_FACE_IN_PERSON_CONF", "0.25"))  # inside person crop

# ── ArcFace (InsightFace buffalo_l) ──────────────────────────────────────────
# 512-dim face embeddings. Cosine similarity: 1.0 = identical, 0.0 = unrelated.
ARCFACE_SIMILARITY_THRESHOLD = float(os.environ.get("AVSS_ARCFACE_THRESHOLD", "0.45"))

# ── OSNet Re-ID ───────────────────────────────────────────────────────────────
# Body/clothing embeddings. Fused with face for multi-modal matching.
REID_FACE_WEIGHT = float(os.environ.get("AVSS_REID_FACE_WEIGHT", "0.70"))  # 70% face + 30% body
REID_BODY_WEIGHT = 1.0 - REID_FACE_WEIGHT

# ── Search tuning ─────────────────────────────────────────────────────────────
SEARCH_RELATIVE_GAP = float(os.environ.get("AVSS_SEARCH_RELATIVE_GAP", "0.10"))
PIPELINE_TARGET_FPS = int(os.environ.get("AVSS_PIPELINE_TARGET_FPS", "10"))


# ── Weight resolution helpers ─────────────────────────────────────────────────

def ensure_wildtrack_weights() -> Path:
    """Copy wildtrack_best.pt from repo root if not in weights/ yet."""
    if WILDTRACK_BEST_PT.exists():
        return WILDTRACK_BEST_PT
    if _REPO_WILDTRACK.exists():
        import shutil
        shutil.copy2(_REPO_WILDTRACK, WILDTRACK_BEST_PT)
        logger.info("Installed wildtrack_best.pt from repo root → %s", WILDTRACK_BEST_PT)
    return WILDTRACK_BEST_PT


def resolve_person_weights_path() -> Path:
    """
    Priority order for person detector:
      1. AVSS_PERSON_WEIGHTS env override
      2. weights/wildtrack_best.pt  ← best for CCTV
      3. weights/best.pt            ← backup
      4. yolov8n.pt                 ← last resort (COCO, not CCTV-optimised)
    """
    ensure_wildtrack_weights()

    override = os.environ.get("AVSS_PERSON_WEIGHTS", "").strip()
    if override:
        p = Path(override) if Path(override).is_absolute() else BACKEND_ROOT / override
        if p.exists():
            logger.info("Using override person weights: %s", p)
            return p
        raise FileNotFoundError(f"AVSS_PERSON_WEIGHTS not found: {p}")

    if WILDTRACK_BEST_PT.exists():
        return WILDTRACK_BEST_PT

    if BEST_PT.exists():
        logger.warning("wildtrack_best.pt missing — falling back to best.pt")
        return BEST_PT

    logger.warning("No custom person weights found — using yolov8n.pt (COCO, not CCTV-optimised)")
    return YOLO_PERSON_PT


def person_predict_kwargs(confidence: float | None = None) -> dict:
    return {
        "conf":    confidence if confidence is not None else PERSON_CONF,
        "iou":     PERSON_IOU,
        "imgsz":   PERSON_IMGSZ,
        "max_det": PERSON_MAX_DET,
        "verbose": False,
    }


def face_predict_kwargs(confidence: float | None = None) -> dict:
    return {
        "conf":    confidence if confidence is not None else FACE_CONF,
        "iou":     FACE_IOU,
        "imgsz":   FACE_IMGSZ,
        "max_det": 50,
        "verbose": False,
    }


def log_inference_config() -> None:
    person_path = resolve_person_weights_path()
    logger.info("=" * 60)
    logger.info("AVSS AI Weight Configuration")
    logger.info("  Person detector : %s (conf=%.2f, iou=%.2f, imgsz=%d)",
                person_path.name, PERSON_CONF, PERSON_IOU, PERSON_IMGSZ)
    logger.info("  Face detector   : %s (conf=%.2f)",
                YOLO_FACE_PT.name if YOLO_FACE_PT.exists() else "MISSING",
                FACE_IN_PERSON_CONF)
    logger.info("  Face recognizer : InsightFace ArcFace buffalo_l (512-dim)")
    logger.info("  Person re-ID    : %s",
                OSNET_PT.name if OSNET_PT.exists() else "NOT AVAILABLE")
    logger.info("  Fusion weights  : face=%.0f%%, body=%.0f%%",
                REID_FACE_WEIGHT * 100, REID_BODY_WEIGHT * 100)
    logger.info("  Similarity thr  : %.2f (gap=%.2f)",
                ARCFACE_SIMILARITY_THRESHOLD, SEARCH_RELATIVE_GAP)
    logger.info("  Pipeline FPS    : %d", PIPELINE_TARGET_FPS)
    logger.info("=" * 60)
