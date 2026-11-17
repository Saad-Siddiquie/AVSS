"""
Central AI model weight paths and optimally-tuned inference settings for AVSS.

Available weights:
  weights/wildtrack_best.pt   — YOLOv8 person detector (Wildtrack-trained, best for CCTV)
  weights/best.pt             — YOLOv8 custom model (backup)
  weights/yolov8n-face.pt     — YOLOv8-Face detector (ArcFace crops)
  weights/osnet_final.pt      — OSNet re-ID (clothing/body matching)

InsightFace buffalo_l is auto-downloaded to ~/.insightface on first use (~500 MB).

── Threshold Reference ────────────────────────────────────────────────────────
ArcFace cosine similarity (same person, well-lit):      0.60–0.85
ArcFace cosine similarity (same person, CCTV, angle):   0.45–0.65
ArcFace cosine similarity (different person):           0.10–0.40
ArcFace cosine similarity (random pair):                ~0.20

YOLOv8 person confidence:
  0.25–0.35  high recall, some false positives (good for pipeline batch processing)
  0.45–0.55  balanced (good for live display)
  0.60+      high precision, may miss distant/occluded persons

──────────────────────────────────────────────────────────────────────────────
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_ROOT = Path(__file__).resolve().parents[2]
WEIGHTS_DIR  = BACKEND_ROOT / "weights"
WEIGHTS_DIR.mkdir(exist_ok=True)

WILDTRACK_BEST_PT = WEIGHTS_DIR / "wildtrack_best.pt"
BEST_PT           = WEIGHTS_DIR / "best.pt"
YOLO_FACE_PT      = WEIGHTS_DIR / "yolov8n-face.pt"
OSNET_PT          = WEIGHTS_DIR / "osnet_final.pt"
YOLO_PERSON_PT    = BACKEND_ROOT / "yolov8n.pt"

_REPO_WILDTRACK = BACKEND_ROOT.parent.parent.parent / "AVSS_YOLOv8_Wildtrack_best.pt"

# ── Person Detector (wildtrack_best.pt) ───────────────────────────────────────
# PIPELINE (batch processing): lower conf for higher recall — we filter later by ArcFace
PERSON_IMGSZ   = int(os.environ.get("AVSS_PERSON_IMGSZ",   "640"))
PERSON_CONF    = float(os.environ.get("AVSS_PERSON_CONF",   "0.35"))  # was 0.30 — slightly stricter
PERSON_IOU     = float(os.environ.get("AVSS_PERSON_IOU",    "0.45"))
PERSON_MAX_DET = int(os.environ.get("AVSS_PERSON_MAX_DET", "50"))     # was 100 — cap to avoid clutter

# LIVE DISPLAY: stricter — fewer false positives in live view
LIVE_PERSON_CONF    = float(os.environ.get("AVSS_LIVE_PERSON_CONF",   "0.60"))  # stop hands/partial bodies
LIVE_MIN_PERSON_PX  = int(os.environ.get("AVSS_LIVE_MIN_PERSON_PX",  "60"))    # keep standard — 90 was too strict
LIVE_MIN_AREA_PCT   = float(os.environ.get("AVSS_LIVE_MIN_AREA_PCT",  "0.008")) # 0.8% — balanced
LIVE_MIN_BRIGHTNESS = float(os.environ.get("AVSS_LIVE_MIN_BRIGHT",    "35.0"))  # skip dark frames

# ── Face Detector (yolov8n-face.pt) ──────────────────────────────────────────
FACE_IMGSZ          = int(os.environ.get("AVSS_FACE_IMGSZ",          "640"))
FACE_CONF           = float(os.environ.get("AVSS_FACE_CONF",           "0.40"))
FACE_IOU            = float(os.environ.get("AVSS_FACE_IOU",            "0.45"))
# Inside person crop: slightly more sensitive (face is already localised)
FACE_IN_PERSON_CONF = float(os.environ.get("AVSS_FACE_IN_PERSON_CONF", "0.30"))  # was 0.25

# ── ArcFace face recognition thresholds ──────────────────────────────────────
#
# Research-backed values for InsightFace buffalo_l (ArcFace R100):
#   Same person, good photo quality:     ~0.65–0.80
#   Same person, CCTV (angle/lighting):  ~0.45–0.65
#   Different person (hard negative):    ~0.25–0.40
#
# DEFAULT (pipeline search): 0.50 — good balance for CCTV footage
# You can tighten to 0.55–0.60 if getting wrong-person matches,
# or loosen to 0.40–0.45 if missing the correct person.
#
ARCFACE_SIMILARITY_THRESHOLD = float(os.environ.get("AVSS_ARCFACE_THRESHOLD", "0.50"))

# Live person-search mode: balanced — 0.50 catches real matches without false positives
LIVE_FACE_THRESHOLD = float(os.environ.get("AVSS_LIVE_FACE_THRESHOLD", "0.50"))

# ── OSNet Re-ID (body/clothing matching) ──────────────────────────────────────
# NOTE: osnet_final.pt uses a ResNet50 fallback with 265 missing keys — its
# embeddings are unreliable for live search (returns sim≈0.999 for all inputs).
# OSNet is kept for the batch pipeline only. Live search uses ArcFace face-only.
#
# Fused score = REID_FACE_WEIGHT × face_sim + REID_BODY_WEIGHT × body_sim
# Body weight is set low (0.10) to minimise OSNet false-match influence in pipeline.
REID_FACE_WEIGHT = float(os.environ.get("AVSS_REID_FACE_WEIGHT", "0.90"))
REID_BODY_WEIGHT = 1.0 - REID_FACE_WEIGHT

# ── Search pipeline tuning ────────────────────────────────────────────────────
# Adaptive cutoff: accept tracks within GAP of the best match
# Smaller gap = stricter (fewer false matches), larger = more recall
SEARCH_RELATIVE_GAP = float(os.environ.get("AVSS_SEARCH_RELATIVE_GAP", "0.08"))  # was 0.10

# Number of analysed frames per second during video processing
PIPELINE_TARGET_FPS = int(os.environ.get("AVSS_PIPELINE_TARGET_FPS", "10"))

# Minimum quality score for a face to be embedded (0.0–1.0, higher = sharper face)
MIN_FACE_QUALITY    = float(os.environ.get("AVSS_MIN_FACE_QUALITY",  "0.0"))   # disabled by default
MIN_FACE_SIZE       = int(os.environ.get("AVSS_MIN_FACE_SIZE",        "28"))    # pixels
EMBED_REFRESH_FRAMES = int(os.environ.get("AVSS_EMBED_REFRESH_FRAMES","120"))   # re-embed every N frames


# ── Weight resolution helpers ─────────────────────────────────────────────────

def ensure_wildtrack_weights() -> Path:
    if WILDTRACK_BEST_PT.exists():
        return WILDTRACK_BEST_PT
    if _REPO_WILDTRACK.exists():
        import shutil
        shutil.copy2(_REPO_WILDTRACK, WILDTRACK_BEST_PT)
        logger.info("Installed wildtrack_best.pt → %s", WILDTRACK_BEST_PT)
    return WILDTRACK_BEST_PT


def resolve_person_weights_path() -> Path:
    """
    Priority:
      1. AVSS_PERSON_WEIGHTS env override
      2. weights/wildtrack_best.pt  ← primary (CCTV-trained)
      3. weights/best.pt            ← backup
      4. yolov8n.pt                 ← last resort
    """
    ensure_wildtrack_weights()

    override = os.environ.get("AVSS_PERSON_WEIGHTS", "").strip()
    if override:
        p = Path(override) if Path(override).is_absolute() else BACKEND_ROOT / override
        if p.exists():
            return p
        raise FileNotFoundError(f"AVSS_PERSON_WEIGHTS not found: {p}")

    if WILDTRACK_BEST_PT.exists():
        return WILDTRACK_BEST_PT
    if BEST_PT.exists():
        logger.warning("wildtrack_best.pt missing — using best.pt")
        return BEST_PT

    logger.warning("No CCTV weights found — using yolov8n.pt (COCO, not optimised for CCTV)")
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
    logger.info("=" * 65)
    logger.info("AVSS Inference Configuration")
    logger.info("  Person detector  : %s", person_path.name)
    logger.info("    pipeline conf  : %.2f  iou=%.2f  imgsz=%d  max_det=%d",
                PERSON_CONF, PERSON_IOU, PERSON_IMGSZ, PERSON_MAX_DET)
    logger.info("    live conf      : %.2f  min_px=%d  min_brightness=%.0f",
                LIVE_PERSON_CONF, LIVE_MIN_PERSON_PX, LIVE_MIN_BRIGHTNESS)
    logger.info("  Face detector    : %s (in-crop conf=%.2f)",
                YOLO_FACE_PT.name if YOLO_FACE_PT.exists() else "MISSING",
                FACE_IN_PERSON_CONF)
    logger.info("  ArcFace          : buffalo_l 512-dim")
    logger.info("    search thresh  : %.2f  (same-person CCTV ~0.45–0.65)",
                ARCFACE_SIMILARITY_THRESHOLD)
    logger.info("    live thresh    : %.2f", LIVE_FACE_THRESHOLD)
    logger.info("    search gap     : %.2f  (adaptive cutoff = best - gap)",
                SEARCH_RELATIVE_GAP)
    logger.info("  OSNet Re-ID      : %s",
                OSNET_PT.name if OSNET_PT.exists() else "not available")
    logger.info("    fusion         : face=%.0f%%  body=%.0f%%",
                REID_FACE_WEIGHT * 100, REID_BODY_WEIGHT * 100)
    logger.info("  Pipeline FPS     : %d", PIPELINE_TARGET_FPS)
    logger.info("=" * 65)
