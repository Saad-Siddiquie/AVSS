"""
Module 12 — ByteTrack (supervision)
Tracks persons across CCTV frames using detections from PersonDetector.
"""
import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

# Crowded Wildtrack scenes: longer buffer, slightly looser association
LOST_TRACK_BUFFER = int(os.environ.get("AVSS_TRACK_BUFFER", "45"))
TRACK_MATCH_THRESH = float(os.environ.get("AVSS_TRACK_MATCH_THRESH", "0.75"))
TRACK_ACTIVATION = float(os.environ.get("AVSS_TRACK_ACTIVATION", "0.20"))


def create_byte_tracker(frame_rate: float = 5.0):
    """
    Create a ByteTrack instance tuned for subsampled CCTV processing.

    frame_rate should match PIPELINE_TARGET_FPS (analysed frames per second).
    """
    import supervision as sv

    tracker = sv.ByteTrack(
        track_activation_threshold=TRACK_ACTIVATION,
        lost_track_buffer=LOST_TRACK_BUFFER,
        minimum_matching_threshold=TRACK_MATCH_THRESH,
        frame_rate=max(1, int(frame_rate)),
    )
    logger.info(
        "ByteTrack ready (fps=%d buffer=%d match=%.2f)",
        max(1, int(frame_rate)),
        LOST_TRACK_BUFFER,
        TRACK_MATCH_THRESH,
    )
    return tracker


def detections_to_supervision(persons: list, class_id: int = 0):
    """Convert person/face detection results to supervision Detections."""
    import supervision as sv

    if not persons:
        return sv.Detections.empty()

    xyxy = np.array([[p.x1, p.y1, p.x2, p.y2] for p in persons], dtype=np.float32)
    confs = np.array([p.confidence for p in persons], dtype=np.float32)
    class_ids = np.full(len(persons), class_id, dtype=int)
    return sv.Detections(xyxy=xyxy, confidence=confs, class_id=class_ids)
