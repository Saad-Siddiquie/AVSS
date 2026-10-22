"""
Module 7 — Face Detection
Uses your custom-trained YOLOv8 model (best.pt) as the primary face detector.

Model priority:
  1. weights/yolov8n-face.pt ← YOLOv8-Face (primary for ArcFace crops)
  2. weights/best.pt         ← only if class names include "face"
  3. yolov8n.pt              ← last resort (not recommended for face match)

Person detection for CCTV uses weights/wildtrack_best.pt via app/ai/person.py + ByteTrack.
"""
import logging
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

from app.ai.weights_config import (
    BEST_PT,
    FACE_CONF,
    YOLO_FACE_PT,
    face_predict_kwargs,
)

# ── Weight file paths (face only — person uses wildtrack_best.pt via person.py) ─
YOLO_FACE_URL    = (
    "https://huggingface.co/arnabdhar/YOLOv8-Face-Detection/resolve/main/model.pt"
)


@dataclass
class FaceDetectionResult:
    """A single detected face bounding box."""
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float

    @property
    def width(self) -> int:
        return self.x2 - self.x1

    @property
    def height(self) -> int:
        return self.y2 - self.y1

    def crop(self, frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape[:2]
        return frame[max(0, self.y1):min(h, self.y2), max(0, self.x1):min(w, self.x2)]

    def to_dict(self) -> dict:
        return {
            "x1": self.x1, "y1": self.y1,
            "x2": self.x2, "y2": self.y2,
            "confidence": round(self.confidence, 4),
            "width": self.width, "height": self.height,
        }


class FaceDetector:
    """
    Singleton face detector backed by YOLOv8.

    Uses weights/yolov8n-face.pt for face crops (query photo + inside person boxes).
    Person detection for CCTV is PersonDetector (weights/best.pt).
    """

    _instance: Optional["FaceDetector"] = None

    def __init__(self, confidence_threshold: float = FACE_CONF):
        self._conf = confidence_threshold
        self._model, self._model_name, self._filter_classes = self._load_model()

    @staticmethod
    def _names_include_face(names: dict) -> bool:
        if len(names) == 1:
            return "face" in list(names.values())[0].lower()
        return any("face" in v.lower() for v in names.values())

    def _load_model(self):
        """
        Load a YOLO face model (never a person-only checkpoint).
        Returns (model, model_name, class_filter).
        """
        from ultralytics import YOLO

        # ── Priority 1: YOLOv8-Face ─────────────────────────────────────────
        if not YOLO_FACE_PT.exists():
            logger.info("Downloading yolov8n-face.pt (~6 MB)...")
            try:
                urllib.request.urlretrieve(YOLO_FACE_URL, YOLO_FACE_PT)
                logger.info("yolov8n-face.pt downloaded.")
            except Exception as e:
                logger.warning("Download failed (%s). Using yolov8n fallback.", e)

        if YOLO_FACE_PT.exists():
            try:
                model = YOLO(str(YOLO_FACE_PT))
                logger.info("FaceDetector: yolov8n-face.pt (class FACE)")
                return model, "yolov8n-face.pt", None
            except Exception as e:
                logger.warning("yolov8n-face.pt failed (%s).", e)

        # ── Priority 2: best.pt only when it is a face model ────────────────
        if BEST_PT.exists():
            try:
                model = YOLO(str(BEST_PT))
                names = model.names
                if self._names_include_face(names):
                    logger.info("FaceDetector: best.pt (face classes %s)", names)
                    face_cls = [k for k, v in names.items() if "face" in v.lower()]
                    return model, "best.pt", face_cls or None
                logger.info(
                    "FaceDetector: skipping best.pt (person model — use PersonDetector)"
                )
            except Exception as e:
                logger.warning("best.pt face load failed (%s).", e)

        logger.warning("FaceDetector: falling back to yolov8n.pt (poor for face match).")
        model = YOLO("yolov8n.pt")
        return model, "yolov8n.pt", [0]

    def detect_in_crop(
        self,
        crop_bgr: np.ndarray,
        offset_x: int = 0,
        offset_y: int = 0,
        confidence_threshold: Optional[float] = None,
    ) -> list[FaceDetectionResult]:
        """
        Detect faces inside a person crop; bbox coords are mapped to full-frame space.
        """
        local = self.detect(crop_bgr, confidence_threshold=confidence_threshold)
        if offset_x == 0 and offset_y == 0:
            return local
        return [
            FaceDetectionResult(
                x1=f.x1 + offset_x,
                y1=f.y1 + offset_y,
                x2=f.x2 + offset_x,
                y2=f.y2 + offset_y,
                confidence=f.confidence,
            )
            for f in local
        ]

    @classmethod
    def load(cls, confidence_threshold: float = FACE_CONF) -> "FaceDetector":
        if cls._instance is None:
            cls._instance = cls(confidence_threshold)
        return cls._instance

    @property
    def model_name(self) -> str:
        return self._model_name

    def detect(
        self,
        frame: np.ndarray,
        confidence_threshold: Optional[float] = None,
    ) -> list[FaceDetectionResult]:
        """
        Detect all faces in a BGR numpy frame.

        Args:
            frame:                H×W×3 BGR numpy array from OpenCV.
            confidence_threshold: Override instance threshold for this call.

        Returns:
            List of FaceDetectionResult sorted by confidence descending.
        """
        predict_kwargs = face_predict_kwargs(
            confidence_threshold if confidence_threshold is not None else self._conf
        )
        predict_kwargs["source"] = frame
        if self._filter_classes is not None:
            predict_kwargs["classes"] = self._filter_classes

        results = self._model.predict(**predict_kwargs)

        detections: list[FaceDetectionResult] = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                confidence = float(box.conf[0])
                detections.append(
                    FaceDetectionResult(x1=x1, y1=y1, x2=x2, y2=y2, confidence=confidence)
                )

        detections.sort(key=lambda d: d.confidence, reverse=True)
        logger.debug(
            "[%s] Detected %d faces/persons (conf>=%.2f)",
            self._model_name,
            len(detections),
            predict_kwargs["conf"],
        )
        return detections
