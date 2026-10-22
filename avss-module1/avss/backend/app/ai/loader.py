"""
AI Model Loader — loads all models at startup.
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

WEIGHTS_DIR = Path("weights")


def load_all_models() -> None:
    logger.info("=== Loading AI Models ===")

    # ── Face Detector (best.pt → yolov8n-face.pt → fallback) ─────────────────
    try:
        from app.ai.face import FaceDetector, BEST_PT, YOLO_FACE_PT
        detector = FaceDetector.load()
        logger.info("[✓] Face Detector: %s", detector.model_name)
    except Exception as exc:
        logger.error("[✗] Face Detector failed: %s", exc)

    # ── Face Recognizer (InsightFace ArcFace buffalo_l) ───────────────────────
    try:
        from app.ai.recognition import FaceRecognizer
        FaceRecognizer.load()
        logger.info("[✓] Face Recognizer: InsightFace ArcFace buffalo_l (512-dim)")
    except Exception as exc:
        logger.error("[✗] Face Recognizer failed: %s", exc)

    # ── Person Re-ID (OSNet — osnet_final.pt) ─────────────────────────────────
    try:
        from app.ai.reid import PersonReID, OSNET_WEIGHTS
        if OSNET_WEIGHTS.exists():
            PersonReID.load()
            logger.info("[✓] Person Re-ID: OSNet (weights/osnet_final.pt)")
        else:
            logger.warning("[!] OSNet weights not found at %s — re-ID disabled.", OSNET_WEIGHTS)
    except Exception as exc:
        logger.error("[✗] OSNet Re-ID failed to load: %s", exc)

    logger.info("=== AI Models Ready ===")
    logger.info("Pipeline: YOLOv8 → ArcFace + OSNet → FAISS → ByteTrack")
