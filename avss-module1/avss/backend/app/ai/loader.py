"""
AI Model Loader
Loads all AI models once at application startup.
Called from main.py lifespan handler so models are warm before the first request.
"""
import logging

logger = logging.getLogger(__name__)


def load_all_models() -> None:
    """
    Initialise all AI singletons.
    Each module's model is loaded here so startup errors surface immediately
    rather than on the first API call.
    """
    logger.info("=== Loading AI models ===")

    try:
        from app.ai.detection import PersonDetector
        PersonDetector.load()
        logger.info("[✓] Module 6 — YOLOv8 PersonDetector loaded.")
    except Exception as exc:
        logger.error("[✗] Module 6 — PersonDetector failed to load: %s", exc)

    try:
        from app.ai.face import FaceDetector
        FaceDetector.load()
        logger.info("[✓] Module 7 — OpenCV DNN FaceDetector loaded.")
    except Exception as exc:
        logger.error("[✗] Module 7 — FaceDetector failed to load: %s", exc)

    try:
        from app.ai.recognition import FaceRecognizer
        FaceRecognizer.load()
        logger.info("[✓] Module 8 — InsightFace FaceRecognizer loaded.")
    except Exception as exc:
        logger.error("[✗] Module 8 — FaceRecognizer failed to load: %s", exc)

    try:
        from app.ai.search import FaceSearchIndex
        FaceSearchIndex.load()
        logger.info("[✓] Module 10 — FAISS FaceSearchIndex loaded.")
    except Exception as exc:
        logger.error("[✗] Module 10 — FaceSearchIndex failed to load: %s", exc)

    logger.info("=== AI model loading complete ===")
