"""
Module 5 — Video Processing
Handles opening video sources (file, webcam, RTSP) and extracting frames.
Uses OpenCV as the backbone. Loaded once and reused across requests.
"""
import logging
from dataclasses import dataclass
from typing import Generator, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class FrameInfo:
    """Metadata attached to every extracted frame."""
    frame_index: int
    timestamp_ms: float
    width: int
    height: int


class VideoSource:
    """
    Opens a single video source and provides frame-by-frame iteration.

    Supports:
      - Local video files:  /path/to/video.mp4
      - Webcam / USB cam:   0  (device index as int or string)
      - RTSP streams:       rtsp://user:pass@192.168.1.100/stream1
    """

    def __init__(self, source: str, fps_limit: Optional[int] = None):
        """
        Args:
            source:    File path, device index, or RTSP URL.
            fps_limit: If set, only yield every Nth frame to hit this target FPS.
        """
        # cv2.VideoCapture accepts int for webcam index
        _src = int(source) if source.isdigit() else source
        self._cap = cv2.VideoCapture(_src)
        if not self._cap.isOpened():
            raise ValueError(f"Cannot open video source: {source!r}")

        self._source = source
        self._fps_limit = fps_limit
        self._native_fps: float = self._cap.get(cv2.CAP_PROP_FPS) or 25.0
        logger.info(
            "VideoSource opened: source=%r native_fps=%.1f",
            source,
            self._native_fps,
        )

    # ── Properties ──────────────────────────────────────────────────────────

    @property
    def native_fps(self) -> float:
        return self._native_fps

    @property
    def width(self) -> int:
        return int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))

    @property
    def height(self) -> int:
        return int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    @property
    def total_frames(self) -> int:
        """Returns -1 for live streams (RTSP / webcam)."""
        return int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # ── Frame extraction ────────────────────────────────────────────────────

    def frames(self) -> Generator[tuple[np.ndarray, FrameInfo], None, None]:
        """
        Yield (frame_bgr, FrameInfo) tuples.
        Respects fps_limit by skipping frames when needed.
        """
        step = max(1, round(self._native_fps / self._fps_limit)) if self._fps_limit else 1
        frame_index = 0

        while True:
            ret, frame = self._cap.read()
            if not ret:
                break

            if frame_index % step == 0:
                info = FrameInfo(
                    frame_index=frame_index,
                    timestamp_ms=self._cap.get(cv2.CAP_PROP_POS_MSEC),
                    width=frame.shape[1],
                    height=frame.shape[0],
                )
                yield frame, info

            frame_index += 1

    def read_one(self) -> Optional[np.ndarray]:
        """Read a single frame, return None on failure."""
        ret, frame = self._cap.read()
        return frame if ret else None

    def release(self) -> None:
        self._cap.release()
        logger.info("VideoSource released: %r", self._source)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.release()


def decode_image_bytes(data: bytes) -> np.ndarray:
    """
    Decode raw image bytes (JPEG/PNG) into a BGR numpy array.
    Used by API endpoints that accept uploaded images.
    """
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image bytes — unsupported format or corrupted data.")
    return img


def encode_image_to_jpeg(frame: np.ndarray, quality: int = 85) -> bytes:
    """Encode a BGR numpy frame to JPEG bytes."""
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("Failed to encode frame to JPEG.")
    return buf.tobytes()
