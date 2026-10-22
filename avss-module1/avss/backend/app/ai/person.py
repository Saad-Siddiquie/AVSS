"""
Module 6 — Person Detection (CCTV / Wildtrack)
Uses weights/wildtrack_best.pt (640px, class person) + ByteTrack.
"""
import logging
from pathlib import Path
from typing import Optional

import numpy as np

from app.ai.face import FaceDetectionResult
from app.ai.weights_config import (
    PERSON_CONF,
    YOLO_PERSON_PT,
    person_predict_kwargs,
    resolve_person_weights_path,
)

logger = logging.getLogger(__name__)


class PersonDetector:
    """Singleton YOLOv8 person detector for Wildtrack / CCTV footage."""

    _instance: Optional["PersonDetector"] = None
    _loaded_path: Optional[Path] = None

    def __init__(self, confidence_threshold: float = PERSON_CONF):
        self._conf = confidence_threshold
        weights_path = resolve_person_weights_path()
        self._model, self._model_name, self._filter_classes = self._load_model(weights_path)
        PersonDetector._loaded_path = weights_path

    def _load_model(self, weights_path: Path):
        from ultralytics import YOLO

        if weights_path.name == "yolov8n.pt" and not weights_path.exists():
            weights_path = YOLO_PERSON_PT

        if weights_path == YOLO_PERSON_PT or weights_path.name == "yolov8n.pt":
            logger.info("PersonDetector: yolov8n.pt (COCO class 0 = person)")
            model = YOLO(str(weights_path))
            return model, "yolov8n.pt", [0]

        try:
            model = YOLO(str(weights_path))
            names = model.names
            display = weights_path.name
            logger.info("PersonDetector: loaded %s — classes %s", display, names)
            if len(names) == 1:
                return model, display, None
            person_cls = [k for k, v in names.items() if v.lower() == "person"]
            filter_cls = person_cls if person_cls else [0]
            return model, display, filter_cls
        except Exception as exc:
            logger.warning("%s failed (%s), falling back to yolov8n.pt", weights_path.name, exc)
            model = YOLO(str(YOLO_PERSON_PT))
            return model, "yolov8n.pt", [0]

    @classmethod
    def load(cls, confidence_threshold: float = PERSON_CONF) -> "PersonDetector":
        wanted = resolve_person_weights_path()
        if cls._instance is not None and cls._loaded_path == wanted:
            return cls._instance
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
        """Detect persons in a BGR frame."""
        predict_kwargs = person_predict_kwargs(confidence_threshold or self._conf)
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
                detections.append(
                    FaceDetectionResult(
                        x1=x1, y1=y1, x2=x2, y2=y2,
                        confidence=float(box.conf[0]),
                    )
                )
        detections.sort(key=lambda d: d.confidence, reverse=True)
        return detections
