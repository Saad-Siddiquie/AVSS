"""
AVSS Core Pipeline — Face-based person search across video footage.

Stage 1: process_video(job_id, db)
  CCTV flow per analysed frame:
    YOLOv8 person (weights/wildtrack_best.pt) → ByteTrack person IDs →
    YOLOv8-Face inside each person crop → ArcFace embedding →
  stores DetectionLog (person bbox + track_id + face embedding for search).

Stage 2: search_and_track(query_id, db)
  Reads query image → generates face embedding →
  searches unique track embeddings via cached numpy index (fast) →
  loads timeline rows only for matched tracks →
  renders a short clip of matched frames only (seek-based, no full re-encode).

There is NO manual person registration.
The system embeds every face it finds in the video automatically.
"""
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai.video import VideoSource
from app.ai.face import FaceDetector
from app.ai.person import PersonDetector
from app.ai.recognition import FaceRecognizer
from app.ai.tracking import create_byte_tracker, detections_to_supervision
from app.ai.weights_config import FACE_IN_PERSON_CONF, PERSON_CONF
from app.models.detection_log import DetectionLog
from app.models.video_job import VideoJob
from app.models.search_query import SearchQuery

logger = logging.getLogger(__name__)

# ── Directories ───────────────────────────────────────────────────────────────
OUTPUT_DIR = Path("uploads/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

EMBED_DIR = Path("uploads/embeddings")
EMBED_DIR.mkdir(parents=True, exist_ok=True)

# ── Tuning constants ──────────────────────────────────────────────────────────
PIPELINE_TARGET_FPS = 10    # analyse 10 frames/sec — denser tracking, smoother box interpolation
MIN_PERSON_SIZE = 40        # Wildtrack: allow smaller distant pedestrians (px)
MIN_FACE_SIZE = 28          # minimum face size inside person crop
PERSON_DETECT_CONF = PERSON_CONF
EMBED_REFRESH_FRAMES = 120  # re-embed a track every N analysed frames (quality refresh)
# Search: only accept tracks nearly as strong as the best match (reduces wrong-person hits)
SEARCH_RELATIVE_GAP = 0.10  # track must be within 0.10 of top match — tighter filter

# Search output video — pad each hit with surrounding CCTV footage (seconds)
RENDER_PAD_SEC_BEFORE = 2.0
RENDER_PAD_SEC_AFTER = 2.5
MAX_OUTPUT_VIDEO_SEC = 60.0   # cap total encoded length


# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Process video: detect faces + store embeddings
# ─────────────────────────────────────────────────────────────────────────────

def process_video(job_id: int, db: Session) -> dict:
    """
    Process a video end-to-end:
      1. Open the video source (file path or RTSP URL)
      2. Detect persons (best.pt) and track with ByteTrack
      3. Detect face inside each tracked person (yolov8n-face.pt)
      4. ArcFace-embed the face crop; match later via query photo
      5. Persist one DetectionLog row per tracked person per frame
      6. Update VideoJob status and progress

    No manual person registration needed — the system embeds
    every face it finds automatically.
    """
    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job:
        raise ValueError(f"VideoJob id={job_id} not found.")

    job.status = "processing"
    job.progress = 0.0
    db.commit()

    try:
        person_detector = PersonDetector.load(confidence_threshold=PERSON_DETECT_CONF)
        face_detector = FaceDetector.load()
        face_recognizer = FaceRecognizer.load()

        # Load OSNet re-ID (optional — graceful if not available)
        reid_model = None
        try:
            from app.ai.reid import PersonReID, OSNET_WEIGHTS
            if OSNET_WEIGHTS.exists():
                reid_model = PersonReID.load()
                logger.info("OSNet re-ID enabled: %s", OSNET_WEIGHTS)
            else:
                logger.info("OSNet weights not found — running face-only mode.")
        except Exception as e:
            logger.warning("OSNet not available (%s) — face-only mode.", e)

        logger.info(
            "CCTV pipeline: person=%s, face=%s, reid=%s, tracker=ByteTrack",
            person_detector.model_name,
            face_detector.model_name,
            "OSNet" if reid_model else "disabled",
        )

        # ── Open video (limit FPS to avoid processing every frame on high-FPS sources) ──
        vs = VideoSource(job.source_path, fps_limit=PIPELINE_TARGET_FPS)
        total_frames = vs.total_frames
        fps = vs.native_fps or 25.0
        W, H = vs.width, vs.height

        job.total_frames = total_frames if total_frames > 0 else None
        job.fps = fps
        db.commit()

        try:
            tracker = create_byte_tracker(frame_rate=PIPELINE_TARGET_FPS)
        except ImportError:
            raise ImportError("supervision not installed. Run: pip install supervision==0.21.0")

        total_detections = 0
        frames_processed = 0
        batch: list[DetectionLog] = []
        BATCH_SIZE = 200
        track_embeddings: dict[int, list[float]] = {}
        track_embed_quality: dict[int, float] = {}
        track_last_embed_frame: dict[int, int] = {}
        track_body_embeddings: dict[int, list[float]] = {}   # OSNet body embeddings

        for frame, info in vs.frames():
            frame_idx = info.frame_index
            frames_processed += 1

            persons = person_detector.detect(frame, confidence_threshold=PERSON_DETECT_CONF)
            sv_dets = detections_to_supervision(persons)
            tracked = tracker.update_with_detections(sv_dets)

            if len(tracked) == 0:
                if total_frames and frame_idx % 120 == 0:
                    job.progress = round(min(99.0, frame_idx / total_frames * 100), 1)
                    db.commit()
                continue

            track_ids = tracked.tracker_id
            confidences = tracked.confidence

            pending: list[tuple[int, int, int, int, int, float, np.ndarray, float]] = []

            for i in range(len(tracked)):
                try:
                    bbox = tracked.xyxy[i]
                except (TypeError, IndexError):
                    continue

                tid = int(track_ids[i]) if (track_ids is not None and i < len(track_ids)) else (frame_idx * 1000 + i)
                conf = float(confidences[i]) if (confidences is not None and i < len(confidences)) else 0.5

                px1 = max(0, int(bbox[0]))
                py1 = max(0, int(bbox[1]))
                px2 = min(W, int(bbox[2]))
                py2 = min(H, int(bbox[3]))

                if px2 - px1 < MIN_PERSON_SIZE or py2 - py1 < MIN_PERSON_SIZE:
                    continue

                face_result = _face_crop_from_person(
                    frame, face_detector, px1, py1, px2, py2,
                )
                if face_result is None:
                    continue
                face_crop, face_quality = face_result

                stale = (
                    frame_idx - track_last_embed_frame.get(tid, 0) >= EMBED_REFRESH_FRAMES
                )
                better = face_quality > track_embed_quality.get(tid, 0.0)
                if tid not in track_embeddings or stale or better:
                    pending.append((tid, px1, py1, px2, py2, conf, face_crop, face_quality))

            if pending:
                crops = [p[6] for p in pending]
                embeddings = face_recognizer.get_embeddings_from_crops(crops)
                for (tid, px1, py1, px2, py2, conf, face_crop, face_quality), emb in zip(pending, embeddings):
                    if emb is None or float(np.linalg.norm(emb)) < 1e-6:
                        continue
                    if tid not in track_embeddings or face_quality >= track_embed_quality.get(tid, 0.0):
                        track_embeddings[tid] = emb.tolist()
                        track_embed_quality[tid] = face_quality
                        track_last_embed_frame[tid] = frame_idx

                    # OSNet body embedding — use full person crop
                    if reid_model is not None and tid not in track_body_embeddings:
                        try:
                            person_crop = frame[py1:py2, px1:px2]
                            body_emb = reid_model.get_embedding(person_crop)
                            if body_emb is not None:
                                track_body_embeddings[tid] = body_emb.tolist()
                        except Exception:
                            pass

            # ── Persist detections (reuse cached embedding per track) ───────
            for i in range(len(tracked)):
                try:
                    bbox = tracked.xyxy[i]
                except (TypeError, IndexError):
                    continue

                tid = int(track_ids[i]) if (track_ids is not None and i < len(track_ids)) else (frame_idx * 1000 + i)
                if tid not in track_embeddings:
                    continue

                conf = float(confidences[i]) if (confidences is not None and i < len(confidences)) else 0.5
                x1 = max(0, int(bbox[0]))
                y1 = max(0, int(bbox[1]))
                x2 = min(W, int(bbox[2]))
                y2 = min(H, int(bbox[3]))

                if x2 - x1 < MIN_PERSON_SIZE or y2 - y1 < MIN_PERSON_SIZE:
                    continue

                batch.append(DetectionLog(
                    job_id=job_id,
                    frame_index=frame_idx,
                    timestamp_ms=info.timestamp_ms,
                    track_id=tid,
                    x1=float(x1), y1=float(y1),
                    x2=float(x2), y2=float(y2),
                    detection_confidence=conf,
                    face_embedding=json.dumps(track_embeddings[tid]),
                    body_embedding=json.dumps(track_body_embeddings[tid]) if tid in track_body_embeddings else None,
                ))
                total_detections += 1

            if len(batch) >= BATCH_SIZE:
                db.bulk_save_objects(batch)
                db.commit()
                batch.clear()

            if total_frames and frame_idx % 120 == 0:
                job.progress = round(min(99.0, frame_idx / total_frames * 100), 1)
                db.commit()

        if batch:
            db.bulk_save_objects(batch)
            db.commit()

        vs.release()

        duration = total_frames / fps if total_frames and total_frames > 0 else 0
        job.status = "completed"
        job.progress = 100.0
        job.total_frames = frames_processed
        job.duration_seconds = round(duration, 2)
        job.total_detections = total_detections
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            "Job %d done — %d analysed frames, %d face logs, %d unique tracks embedded.",
            job_id, frames_processed, total_detections, len(track_embeddings),
        )
        if track_embeddings:
            _save_job_track_index(job_id, track_embeddings, track_body_embeddings)
        return {
            "job_id": job_id,
            "status": "completed",
            "frames_processed": frames_processed,
            "total_face_embeddings": total_detections,
            "unique_tracks": len(track_embeddings),
            "duration_seconds": round(duration, 2),
        }

    except Exception as exc:
        logger.exception("Pipeline failed for job %d: %s", job_id, exc)
        job.status = "failed"
        job.error_message = str(exc)
        db.commit()
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Search and render annotated video
# ─────────────────────────────────────────────────────────────────────────────

def search_and_track(query_id: int, db: Session) -> dict:
    """
    Find a person in a processed video using their face photo.

    Fast path:
      1. Compare query against one embedding per ByteTrack ID (not every frame)
      2. Load timeline rows only for matched tracks
      3. Render a short clip of matched frames (seek-based)
    """
    query = db.query(SearchQuery).filter(SearchQuery.id == query_id).first()
    if not query:
        raise ValueError(f"SearchQuery id={query_id} not found.")

    job = db.query(VideoJob).filter(VideoJob.id == query.job_id).first()
    if not job or job.status != "completed":
        raise ValueError(f"VideoJob id={query.job_id} is not ready.")

    query.status = "processing"
    db.commit()

    try:
        face_recognizer = FaceRecognizer.load()

        query_img = cv2.imread(query.query_image_path)
        if query_img is None:
            raise ValueError(f"Cannot read query image: {query.query_image_path}")

        query_emb = face_recognizer.get_embedding(query_img)
        if query_emb is None:
            raise ValueError(
                "No face detected in the query image. "
                "Upload a clear, well-lit face photo."
            )

        query.query_embedding = json.dumps(query_emb.tolist())
        db.commit()

        threshold = query.similarity_threshold

        track_ids, emb_matrix = _load_job_track_index(job.id, db)
        if len(track_ids) == 0:
            _finalize_empty_search(query, db)
            return {"query_id": query_id, "total_matches": 0}

        # ── Face similarity (primary signal — ArcFace) ────────────────────────
        sims = emb_matrix @ query_emb

        # ── OSNet body similarity (secondary signal) ──────────────────────────
        body_sims: dict[int, float] = {}
        try:
            from app.ai.reid import PersonReID, OSNET_WEIGHTS
            npy_path, _ = _job_index_paths(job.id)
            body_npy = Path(str(npy_path).replace("_tracks.npy", "_tracks_body.npy"))
            body_ids_json = Path(str(npy_path).replace("_tracks.npy", "_tracks_body.json"))

            if OSNET_WEIGHTS.exists() and body_npy.exists() and body_ids_json.exists():
                reid_model = PersonReID.load()
                query_body_emb = reid_model.get_embedding(query_img)
                if query_body_emb is not None:
                    body_matrix = np.load(str(body_npy))
                    body_track_ids = json.loads(body_ids_json.read_text())
                    body_scores = body_matrix @ query_body_emb
                    body_sims = {int(tid): float(s) for tid, s in zip(body_track_ids, body_scores)}
                    logger.info("OSNet body scoring: %d tracks", len(body_sims))
        except Exception as exc:
            logger.warning("OSNet body scoring skipped: %s", exc)

        # ── Combined score: 0.7 × face + 0.3 × body (or face only) ───────────
        combined_sims: dict[int, float] = {}
        for idx, tid in enumerate(track_ids):
            face_s = float(sims[idx])
            body_s = body_sims.get(int(tid))
            combined_sims[int(tid)] = (0.7 * face_s + 0.3 * body_s) if body_s is not None else face_s

        sorted_tracks = sorted(combined_sims.items(), key=lambda x: x[1], reverse=True)

        # Log top 5 for tuning
        logger.info("Top combined scores (threshold=%.2f):", threshold)
        for tid, score in sorted_tracks[:5]:
            face_s = combined_sims[tid]
            body_s = body_sims.get(tid)
            logger.info(
                "  track_id=%d  combined=%.4f  face=%.4f  body=%s  %s",
                tid, score, face_s,
                f"{body_s:.4f}" if body_s is not None else "N/A",
                "✓" if score >= threshold else "✗",
            )

        best_tid, best_score = sorted_tracks[0] if sorted_tracks else (None, 0.0)

        if best_score < threshold:
            logger.info("No match: best=%.4f below threshold=%.2f", best_score, threshold)
            _finalize_empty_search(query, db)
            return {"query_id": query_id, "total_matches": 0}

        # Only accept tracks close to the best match (avoids false positives)
        adaptive_cutoff = max(threshold, best_score - SEARCH_RELATIVE_GAP)
        matched_track_ids = {
            tid for tid, score in combined_sims.items()
            if score >= adaptive_cutoff
        }
        logger.info(
            "Match filter: best=%.4f cutoff=%.4f → %d track(s) matched",
            best_score, adaptive_cutoff, len(matched_track_ids),
        )

        if not matched_track_ids:
            _finalize_empty_search(query, db)
            return {"query_id": query_id, "total_matches": 0}

        match_rows = (
            db.query(DetectionLog)
            .filter(
                DetectionLog.job_id == job.id,
                DetectionLog.track_id.in_(matched_track_ids),
            )
            .order_by(DetectionLog.timestamp_ms)
            .all()
        )

        track_best_sim = {tid: combined_sims[tid] for tid in matched_track_ids}

        camera_name = "Uploaded Video"
        camera_location = "—"
        if job.camera_id:
            from app.models.camera import Camera
            cam = db.query(Camera).filter(Camera.id == job.camera_id).first()
            if cam:
                camera_name = cam.name
                camera_location = cam.location or "—"
        elif job.original_filename:
            camera_name = job.original_filename

        timeline = [
            {
                "frame_index": log.frame_index,
                "timestamp_ms": log.timestamp_ms,
                "timestamp_str": _ms_to_str(log.timestamp_ms),
                "track_id": log.track_id,
                "similarity": round(track_best_sim.get(log.track_id, 0.0), 4),
                "x1": log.x1, "y1": log.y1,
                "x2": log.x2, "y2": log.y2,
                "camera_id": job.camera_id,
                "camera_name": camera_name,
                "camera_location": camera_location,
            }
            for log in match_rows
        ]

        logger.info(
            "Query %d: %d matches, %d unique track IDs — camera: %s",
            query_id, len(timeline), len(matched_track_ids), camera_name,
        )

        # Update DB so frontend knows rendering has started (not stuck)
        query.total_matches = len(timeline)
        db.commit()

        output_path = OUTPUT_DIR / f"search_{query_id}.mp4"
        logger.info("Query %d: rendering annotated clip (~%d frames)...", query_id, len(match_rows))
        _render_matched_clip(
            source_path=job.source_path,
            match_rows=match_rows,
            match_sims=track_best_sim,
            output_path=output_path,
            fps=PIPELINE_TARGET_FPS,
            camera_name=camera_name,
            camera_location=camera_location,
        )
        logger.info("Query %d: render complete → %s", query_id, output_path)

        query.status = "completed"
        query.total_matches = len(timeline)
        query.output_video_path = str(output_path)
        query.completed_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "query_id": query_id,
            "total_matches": len(timeline),
            "matched_track_ids": list(matched_track_ids),
            "camera_name": camera_name,
            "camera_location": camera_location,
            "camera_id": job.camera_id,
            "output_video_path": str(output_path),
            "timeline": timeline[:100],
        }

    except Exception as exc:
        logger.exception("Search failed for query %d: %s", query_id, exc)
        query.status = "failed"
        query.error_message = str(exc)
        db.commit()
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Search index helpers
# ─────────────────────────────────────────────────────────────────────────────

def _job_index_paths(job_id: int) -> tuple[Path, Path]:
    return (
        EMBED_DIR / f"job_{job_id}_tracks.npy",
        EMBED_DIR / f"job_{job_id}_track_ids.json",
    )


def _save_job_track_index(
    job_id: int,
    track_embeddings: dict[int, list[float]],
    track_body_embeddings: dict[int, list[float]] | None = None,
) -> None:
    """Persist face (and optionally body) embeddings per ByteTrack ID for fast search."""
    track_ids = sorted(track_embeddings.keys())
    face_matrix = np.array([track_embeddings[tid] for tid in track_ids], dtype=np.float32)
    npy_path, ids_path = _job_index_paths(job_id)
    np.save(npy_path, face_matrix)
    ids_path.write_text(json.dumps(track_ids))

    # Save body embeddings if available
    if track_body_embeddings:
        body_npy = npy_path.with_stem(npy_path.stem + "_body")
        body_ids = [tid for tid in track_ids if tid in track_body_embeddings]
        if body_ids:
            body_matrix = np.array([track_body_embeddings[tid] for tid in body_ids], dtype=np.float32)
            np.save(body_npy, body_matrix)
            body_npy.with_suffix(".json").write_text(json.dumps(body_ids))
            logger.info("Saved body index for job %d — %d tracks.", job_id, len(body_ids))

    logger.info("Saved track index for job %d — %d tracks.", job_id, len(track_ids))


def _load_job_track_index(job_id: int, db: Session) -> tuple[list[int], np.ndarray]:
    """
    Load cached track embedding matrix. Rebuilds from DB once if missing
    (for jobs processed before the index was introduced).
    """
    npy_path, ids_path = _job_index_paths(job_id)
    if npy_path.exists() and ids_path.exists():
        track_ids = json.loads(ids_path.read_text())
        return track_ids, np.load(npy_path)

    rows = (
        db.query(DetectionLog.track_id, func.min(DetectionLog.id).label("min_id"))
        .filter(
            DetectionLog.job_id == job_id,
            DetectionLog.face_embedding.isnot(None),
            DetectionLog.track_id.isnot(None),
        )
        .group_by(DetectionLog.track_id)
        .all()
    )
    if not rows:
        return [], np.empty((0, 512), dtype=np.float32)

    rep_ids = [r.min_id for r in rows]
    rep_logs = db.query(DetectionLog).filter(DetectionLog.id.in_(rep_ids)).all()
    track_embeddings = {
        log.track_id: json.loads(log.face_embedding)
        for log in rep_logs
        if log.track_id is not None and log.face_embedding
    }
    _save_job_track_index(job_id, track_embeddings)
    track_ids = sorted(track_embeddings.keys())
    matrix = np.array([track_embeddings[tid] for tid in track_ids], dtype=np.float32)
    return track_ids, matrix


# ─────────────────────────────────────────────────────────────────────────────
# Render helper
# ─────────────────────────────────────────────────────────────────────────────

def _merge_frame_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Merge overlapping [start, end] frame ranges."""
    if not intervals:
        return []
    sorted_iv = sorted(intervals, key=lambda t: t[0])
    merged: list[tuple[int, int]] = [sorted_iv[0]]
    for start, end in sorted_iv[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end + 1:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


def _build_render_intervals(
    match_frame_indices: list[int],
    native_fps: float,
    total_frames: int,
) -> list[tuple[int, int]]:
    """Expand each match with before/after context so the clip is easy to watch."""
    pad_before = max(1, int(RENDER_PAD_SEC_BEFORE * native_fps))
    pad_after = max(1, int(RENDER_PAD_SEC_AFTER * native_fps))
    cap_end = max(0, total_frames - 1) if total_frames > 0 else 10**9

    intervals = []
    for f in match_frame_indices:
        start = max(0, f - pad_before)
        end = min(cap_end, f + pad_after)
        intervals.append((start, end))
    return _merge_frame_intervals(intervals)


def _nearest_match_logs(
    frame_idx: int,
    sorted_match_frames: list[int],
    frame_lookup: dict[int, list],
    native_fps: float = 25.0,
) -> list:
    """
    Return interpolated bounding box position for context/padding frames.
    Linearly interpolates between the two nearest sampled frames so the
    box tracks the person smoothly instead of jumping/freezing.
    """
    if frame_idx in frame_lookup:
        return frame_lookup[frame_idx]
    if not sorted_match_frames:
        return []

    # Find surrounding sampled frames
    prev_frame = None
    next_frame = None
    for f in sorted_match_frames:
        if f <= frame_idx:
            prev_frame = f
        if f > frame_idx and next_frame is None:
            next_frame = f

    if prev_frame is None:
        return frame_lookup.get(next_frame, [])
    if next_frame is None:
        return frame_lookup.get(prev_frame, [])

    # Linear interpolation between prev and next bbox
    prev_logs = frame_lookup[prev_frame]
    next_logs = frame_lookup[next_frame]

    # Match by track_id
    prev_by_tid = {log.track_id: log for log in prev_logs}
    next_by_tid = {log.track_id: log for log in next_logs}
    common_tids = set(prev_by_tid) & set(next_by_tid)

    if not common_tids:
        # No overlapping track — use nearest frame as-is
        dist_prev = abs(frame_idx - prev_frame)
        dist_next = abs(frame_idx - next_frame)
        return frame_lookup[prev_frame if dist_prev <= dist_next else next_frame]

    # Create interpolated log objects
    total = next_frame - prev_frame
    alpha = (frame_idx - prev_frame) / total  # 0.0 at prev, 1.0 at next

    class InterpLog:
        """Lightweight bbox-only log for drawing during interpolation."""
        def __init__(self, track_id, x1, y1, x2, y2, sim):
            self.track_id = track_id
            self.x1 = x1; self.y1 = y1; self.x2 = x2; self.y2 = y2
            self.timestamp_ms = None
            self._sim = sim

    interp_logs = []
    for tid in common_tids:
        p = prev_by_tid[tid]
        n = next_by_tid[tid]
        interp_logs.append(InterpLog(
            track_id=tid,
            x1=p.x1 + (n.x1 - p.x1) * alpha,
            y1=p.y1 + (n.y1 - p.y1) * alpha,
            x2=p.x2 + (n.x2 - p.x2) * alpha,
            y2=p.y2 + (n.y2 - p.y2) * alpha,
            sim=getattr(p, '_sim', 0.0),
        ))

    return interp_logs


def _render_matched_clip(
    source_path: str,
    match_rows: list,
    match_sims: dict[int, float],
    output_path: Path,
    fps: float,
    camera_name: str,
    camera_location: str,
) -> None:
    """
    Render merged segments around each match (lead-in + follow-through).
    Green box shown on match frames; nearest box carried on padded context frames.
    """
    frame_lookup: dict[int, list] = {}
    for log in match_rows:
        frame_lookup.setdefault(log.frame_index, []).append(log)

    if not frame_lookup:
        logger.warning("No matched frames to render.")
        return

    match_frames = sorted(frame_lookup.keys())

    cap = cv2.VideoCapture(source_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video for rendering: {source_path!r}")

    native_fps = cap.get(cv2.CAP_PROP_FPS) or fps or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if W == 0 or H == 0:
        cap.release()
        raise ValueError(f"Video has zero dimensions — cannot render: {source_path!r}")

    intervals = _build_render_intervals(match_frames, native_fps, total_frames)
    max_frames_out = int(MAX_OUTPUT_VIDEO_SEC * native_fps)

    output_str = str(output_path)
    writer = None
    for fourcc_code in ["avc1", "mp4v", "XVID"]:
        fourcc = cv2.VideoWriter_fourcc(*fourcc_code)
        writer = cv2.VideoWriter(output_str, fourcc, native_fps, (W, H))
        if writer.isOpened():
            logger.info("VideoWriter opened with codec: %s (fps=%.2f)", fourcc_code, native_fps)
            break
        writer.release()
        writer = None

    if writer is None or not writer.isOpened():
        cap.release()
        raise ValueError("Cannot open VideoWriter — no supported codec found.")

    MATCH_COLOR = (0, 255, 0)
    CONTEXT_COLOR = (0, 200, 0)
    FONT = cv2.FONT_HERSHEY_SIMPLEX
    FONT_SCALE = 0.55
    MODEL_LABEL = "wildtrack_best.pt + yolov8n-face + ArcFace + ByteTrack"

    rendered = 0
    for seg_start, seg_end in intervals:
        if rendered >= max_frames_out:
            break
        seg_end = min(seg_end, seg_start + (max_frames_out - rendered) - 1)

        cap.set(cv2.CAP_PROP_POS_FRAMES, seg_start)
        for frame_idx in range(seg_start, seg_end + 1):
            if rendered >= max_frames_out:
                break
            ret, frame = cap.read()
            if not ret:
                logger.warning("cap.read() failed at frame %d", frame_idx)
                break

            is_exact_match = frame_idx in frame_lookup
            logs = frame_lookup[frame_idx] if is_exact_match else _nearest_match_logs(
                frame_idx, match_frames, frame_lookup, native_fps,
            )
            annotated = frame.copy()
            box_color = MATCH_COLOR if is_exact_match else CONTEXT_COLOR
            thickness = 3 if is_exact_match else 2

            cv2.putText(
                annotated,
                f"Camera: {camera_name}  |  {camera_location}",
                (10, 22), FONT, 0.5, (255, 255, 255), 2, cv2.LINE_AA,
            )

            ts_ms = (frame_idx / native_fps) * 1000  # use actual video position always
            cv2.putText(
                annotated, _ms_to_str(ts_ms),
                (10, H - 10), FONT, 0.5, (255, 255, 255), 1, cv2.LINE_AA,
            )

            for log in logs:
                x1 = max(0, int(log.x1))
                y1 = max(0, int(log.y1))
                x2 = min(W, int(log.x2))
                y2 = min(H, int(log.y2))
                cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, thickness)
                if is_exact_match:
                    sim = match_sims.get(log.track_id, 0.0)
                    label = f"FOUND  ID:{log.track_id}  {sim*100:.0f}%"
                    lbl_y = max(y1 - 8, 14)
                    (tw, th), _ = cv2.getTextSize(label, FONT, FONT_SCALE, 2)
                    cv2.rectangle(
                        annotated, (x1, lbl_y - th - 4), (x1 + tw + 6, lbl_y + 2),
                        MATCH_COLOR, -1,
                    )
                    cv2.putText(
                        annotated, label, (x1 + 3, lbl_y), FONT, FONT_SCALE,
                        (0, 0, 0), 2, cv2.LINE_AA,
                    )

            (mw, _), _ = cv2.getTextSize(MODEL_LABEL, FONT, 0.38, 1)
            cv2.putText(
                annotated, MODEL_LABEL,
                (W - mw - 8, H - 8), FONT, 0.38, (180, 180, 180), 1, cv2.LINE_AA,
            )

            writer.write(annotated)
            rendered += 1

    writer.release()
    cap.release()

    duration_sec = rendered / native_fps if native_fps > 0 else 0
    out_size = output_path.stat().st_size if output_path.exists() else 0
    logger.info(
        "Render complete: %s | %d frames | %.1f s | %.1f KB",
        output_path.name, rendered, duration_sec, out_size / 1024,
    )

    if out_size < 1024:
        logger.error("Output too small (%d bytes) — trying imageio re-encode.", out_size)

    # Re-encode to H.264 using imageio (bundled with ultralytics, always available)
    _reencode_with_imageio(output_path)


def _reencode_with_imageio(video_path: Path) -> None:
    """
    Re-encode video to H.264 using imageio+ffmpeg for browser compatibility.
    imageio ships its own ffmpeg binary so this works even without system ffmpeg.
    """
    import shutil
    import subprocess

    # Try system ffmpeg first
    system_ffmpeg = shutil.which("ffmpeg")

    # Try imageio's bundled ffmpeg
    imageio_ffmpeg = None
    try:
        import imageio_ffmpeg
        imageio_ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        imageio_ffmpeg_path = None

    ffmpeg_exe = system_ffmpeg or imageio_ffmpeg_path

    if not ffmpeg_exe:
        logger.warning("No ffmpeg found — video may not play in browser.")
        return

    tmp = video_path.with_suffix(".tmp.mp4")
    cmd = [
        ffmpeg_exe, "-y",
        "-i", str(video_path),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(tmp),
    ]

    try:
        result = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300,
        )
        if result.returncode == 0 and tmp.exists() and tmp.stat().st_size > 1024:
            tmp.replace(video_path)
            logger.info("H.264 re-encode OK (%s) → %s",
                ffmpeg_exe, video_path.name)
        else:
            err = result.stderr.decode()[-300:] if result.stderr else "unknown"
            logger.error("ffmpeg re-encode failed (rc=%d): %s", result.returncode, err)
            tmp.unlink(missing_ok=True)
    except Exception as exc:
        logger.error("ffmpeg error: %s", exc)
        tmp.unlink(missing_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def _face_crop_from_person(
    frame: np.ndarray,
    face_detector: FaceDetector,
    px1: int,
    py1: int,
    px2: int,
    py2: int,
) -> Optional[tuple[np.ndarray, float]]:
    """
    Run YOLOv8-Face inside a ByteTrack person box; return (face crop, quality score).
    Slight padding on the person crop improves face recall on Wildtrack boxes.
    """
    h, w = frame.shape[:2]
    pad_x = int((px2 - px1) * 0.05)
    pad_y = int((py2 - py1) * 0.05)
    px1p = max(0, px1 - pad_x)
    py1p = max(0, py1 - pad_y)
    px2p = min(w, px2 + pad_x)
    py2p = min(h, py2 + pad_y)

    person_crop = frame[py1p:py2p, px1p:px2p]
    if person_crop is None or person_crop.size == 0:
        return None

    faces = face_detector.detect(person_crop, confidence_threshold=FACE_IN_PERSON_CONF)
    if not faces:
        return None

    crop_h, crop_w = person_crop.shape[:2]
    head_x, head_y = crop_w * 0.5, crop_h * 0.28

    def _face_score(f):
        if f.width < MIN_FACE_SIZE or f.height < MIN_FACE_SIZE:
            return -1.0
        cx = (f.x1 + f.x2) / 2
        cy = (f.y1 + f.y2) / 2
        dist = ((cx - head_x) / max(crop_w, 1)) ** 2 + ((cy - head_y) / max(crop_h, 1)) ** 2
        area = f.width * f.height
        return f.confidence + 0.35 * (area / max(crop_w * crop_h, 1)) - 0.5 * dist

    best = max(faces, key=_face_score)
    if best.width < MIN_FACE_SIZE or best.height < MIN_FACE_SIZE:
        return None

    crop = best.crop(person_crop)
    if crop is None or crop.size == 0:
        return None

    quality = _face_score(best)
    return crop, quality


def _ms_to_str(ms: float) -> str:
    """Convert milliseconds to MM:SS.d timestamp string."""
    total_s = ms / 1000
    minutes = int(total_s // 60)
    seconds = int(total_s % 60)
    tenths = int((total_s % 1) * 10)
    return f"{minutes:02d}:{seconds:02d}.{tenths}"


def _finalize_empty_search(query: SearchQuery, db: Session) -> None:
    query.status = "completed"
    query.total_matches = 0
    query.completed_at = datetime.now(timezone.utc)
    db.commit()
