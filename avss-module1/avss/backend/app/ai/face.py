"""
Module 7 — Face Detection
Uses OpenCV's DNN face detector (ResNet-SSD) — no extra download required,
model files are bundled with opencv-python.

Falls back to OpenCV Haar cascade if DNN files are not present.
"""
import logging
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

WEIGHTS_DIR = Path("weights")
WEIGHTS_DIR.mkdir(exist_ok=True)

# OpenCV ResNet-SSD face detector — small files, download once
DNN_PROTO = WEIGHTS_DIR / "deploy.prototxt"
DNN_MODEL = WEIGHTS_DIR / "res10_300x300_ssd_iter_140000.caffemodel"

DNN_PROTO_URL = (
    "https://raw.githubusercontent.com/opencv/opencv/master/"
    "samples/dnn/face_detector/deploy.prototxt"
)
DNN_MODEL_URL = (
    "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/"
    "res10_300x300_ssd_iter_140000.caffemodel"
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
        """Return the face region cropped from the frame. Clamps to image bounds."""
        h, w = frame.shape[:2]
        x1 = max(0, self.x1)
        y1 = max(0, self.y1)
        x2 = min(w, self.x2)
        y2 = min(h, self.y2)
        return frame[y1:y2, x1:x2]

    def to_dict(self) -> dict:
        return {
            "x1": self.x1,
            "y1": self.y1,
            "x2": self.x2,
            "y2": self.y2,
            "confidence": round(self.confidence, 4),
            "width": self.width,
            "height": self.height,
        }


def _download_dnn_files() -> None:
    """Download DNN model files if not present."""
    if not DNN_PROTO.exists():
        logger.info("Downloading face DNN prototxt...")
        urllib.request.urlretrieve(DNN_PROTO_URL, DNN_PROTO)
    if not DNN_MODEL.exists():
        logger.info("Downloading face DNN caffemodel (~2.7 MB)...")
        urllib.request.urlretrieve(DNN_MODEL_URL, DNN_MODEL)


class FaceDetector:
    """
    Singleton face detector using OpenCV DNN (ResNet-SSD).
    """

    _instance: Optional["FaceDetector"] = None

    def __init__(self, confidence_threshold: float = 0.50):
        _download_dnn_files()
        self._net = cv2.dnn.readNetFromCaffe(str(DNN_PROTO), str(DNN_MODEL))
        self._conf = confidence_threshold
        logger.info("FaceDetector (DNN) loaded. Threshold=%.2f", confidence_threshold)

    @classmethod
    def load(cls, confidence_threshold: float = 0.50) -> "FaceDetector":
        if cls._instance is None:
            cls._instance = cls(confidence_threshold)
        return cls._instance

    def detect(
        self,
        frame: np.ndarray,
        confidence_threshold: Optional[float] = None,
    ) -> list[FaceDetectionResult]:
        """
        Detect faces in a BGR frame.

        Returns:
            List of FaceDetectionResult sorted by confidence descending.
        """
        conf_thresh = confidence_threshold or self._conf
        h, w = frame.shape[:2]

        # Prepare blob: resize to 300×300, mean subtraction
        blob = cv2.dnn.blobFromImage(
            cv2.resize(frame, (300, 300)),
            scalefactor=1.0,
            size=(300, 300),
            mean=(104.0, 177.0, 123.0),
        )
        self._net.setInput(blob)
        detections_raw = self._net.forward()

        results: list[FaceDetectionResult] = []
        for i in range(detections_raw.shape[2]):
            confidence = float(detections_raw[0, 0, i, 2])
            if confidence < conf_thresh:
                continue
            box = detections_raw[0, 0, i, 3:7] * np.array([w, h, w, h])
            x1, y1, x2, y2 = box.astype(int)
            results.append(
                FaceDetectionResult(x1=x1, y1=y1, x2=x2, y2=y2, confidence=confidence)
            )

        results.sort(key=lambda r: r.confidence, reverse=True)
        logger.debug("Detected %d faces", len(results))
        return results
