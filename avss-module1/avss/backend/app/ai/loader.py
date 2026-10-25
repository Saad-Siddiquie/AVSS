"""
AI Model Loader — loads and verifies all models at startup.
Logs a clear summary of what loaded and what's missing.
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def load_all_models() -> None:
    from app.ai.weights_config import (
        WILDTRACK_BEST_PT, BEST_PT, YOLO_FACE_PT, OSNET_PT,
        log_inference_config, resolve_person_weights_path,
    )

    log_inference_config()
    errors = []

    # ── 1. Person Detector (wildtrack_best.pt) ────────────────────────────────
    try:
        from app.ai.person import PersonDetector
        det = PersonDetector.load()
        logger.info("[✓] Person Detector: %s", det.model_name)
    except Exception as exc:
        errors.append(f"Person Detector: {exc}")
        logger.error("[✗] Person Detector failed: %s", exc)

    # ── 2. Face Detector (yolov8n-face.pt) ────────────────────────────────────
    try:
        from app.ai.face import FaceDetector
        fd = FaceDetector.load()
        logger.info("[✓] Face Detector: %s", fd.model_name)
        if not YOLO_FACE_PT.exists():
            logger.warning("    yolov8n-face.pt missing — face detector may use fallback")
    except Exception as exc:
        errors.append(f"Face Detector: {exc}")
        logger.error("[✗] Face Detector failed: %s", exc)

    # ── 3. Face Recognizer (InsightFace ArcFace buffalo_l) ────────────────────
    try:
        from app.ai.recognition import FaceRecognizer
        FaceRecognizer.load()
        logger.info("[✓] Face Recognizer: ArcFace buffalo_l 512-dim")
    except Exception as exc:
        errors.append(f"ArcFace: {exc}")
        logger.error("[✗] Face Recognizer failed: %s", exc)

    # ── 4. Person Re-ID (OSNet osnet_final.pt) ────────────────────────────────
    try:
        from app.ai.reid import PersonReID, OSNET_WEIGHTS
        if OSNET_WEIGHTS.exists():
            PersonReID.load()
            logger.info("[✓] Person Re-ID: OSNet (%s)", OSNET_WEIGHTS.name)
        else:
            logger.warning("[!] OSNet weights not found at %s — body re-ID disabled (face-only mode)", OSNET_WEIGHTS)
    except Exception as exc:
        logger.warning("[!] OSNet Re-ID not loaded (%s) — face-only mode active", exc)

    # ── Summary ───────────────────────────────────────────────────────────────
    if errors:
        logger.warning("=== AI Models loaded with %d error(s) ===", len(errors))
        for e in errors:
            logger.warning("  - %s", e)
    else:
        logger.info("=== All AI Models Ready ===")
        logger.info("Pipeline: wildtrack_best.pt → yolov8n-face.pt → ArcFace + OSNet → ByteTrack")

    # ── Verify weight files ───────────────────────────────────────────────────
    weights = {
        "wildtrack_best.pt": WILDTRACK_BEST_PT,
        "yolov8n-face.pt":   YOLO_FACE_PT,
        "osnet_final.pt":    OSNET_PT,
        "best.pt (backup)":  BEST_PT,
    }
    logger.info("Weight file status:")
    for name, path in weights.items():
        status = "✓" if path.exists() else "✗ MISSING"
        size   = f"({path.stat().st_size / 1e6:.1f} MB)" if path.exists() else ""
        logger.info("  [%s] %s %s", status, name, size)
