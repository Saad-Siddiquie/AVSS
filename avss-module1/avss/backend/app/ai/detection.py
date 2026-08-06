"""
Module 6 — Person Detection
Uses YOLOv8n (nano) to detect persons in image frames.
Model is loaded once at startup and reused for all requests.
"""
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# COCO class index for "person"
PERSON_CLASS_ID = 0

# Path to store the downloaded weights
WEIGHTS_DIR = Path("weights")
WEIGHTS_DIR.mkdir(exist_ok=True)
YOLO_WEIGHTS = WEIGHTS_DIR / "yolov8n.pt"


@dataclass
class DetectionResult:
    """A single detected person bounding box."""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    label: str = "person"

    @property
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1

    @property
    def area(self) -> float:
        return self.width * self.height

    def to_dict(self) -> dict:
        return {
            "x1": round(self.x1, 2),
            "y1": round(self.y1, 2),
            "x2": round(self.x2, 2),
            "y2": round(self.y2, 2),
            "confidence": round(self.confidence, 4),
            "label": self.label,
            "width": round(self.width, 2),
            "height": round(self.height, 2),
        }


class PersonDetector:
    """
    Singleton-style wrapper around YOLOv8n.
    Load once with PersonDetector.load(), then call detect().
    """

    _instance: Optional["PersonDetector"] = None

    def __init__(self, confidence_threshold: float = 0.40):
        # Import here so the rest of the app doesn't crash if ultralytics
        # isn't installed yet (graceful degradation during early setup)
        from ultralytics import YOLO

        logger.info("Loading YOLOv8n weights from %s ...", YOLO_WEIGHTS)
        self._model = YOLO(str(YOLO_WEIGHTS) if YOLO_WEIGHTS.exists() else "yolov8n.pt")
        self._conf = confidence_threshold
        logger.info("YOLOv8n loaded. Confidence threshold=%.2f", confidence_threshold)

    @classmethod
    def load(cls, confidence_threshold: float = 0.40) -> "PersonDetector":
        """Return the singleton, creating it on first call."""
        if cls._instance is None:
            cls._instance = cls(confidence_threshold)
        return cls._instance

    def detect(
        self,
        frame: np.ndarray,
        confidence_threshold: Optional[float] = None,
    ) -> list[DetectionResult]:
        """
        Run person detection on a BGR numpy frame.

        Args:
            frame: H×W×3 BGR image (as returned by OpenCV).
            confidence_threshold: Override the default threshold for this call.

        Returns:
            List of DetectionResult, one per detected person.
        """
        conf = confidence_threshold or self._conf
        results = self._model.predict(
            source=frame,
            conf=conf,
            classes=[PERSON_CLASS_ID],
            verbose=False,
        )

        detections: list[DetectionResult] = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                detections.append(
                    DetectionResult(
                        x1=x1, y1=y1, x2=x2, y2=y2,
                        confidence=confidence,
                    )
                )

        logger.debug("Detected %d persons (conf>=%.2f)", len(detections), conf)
        return detections
