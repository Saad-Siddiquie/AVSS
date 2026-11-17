"""
AVSS Live Camera Module — USB/V4L2 camera input via scrcpy (Pixel 7).

Reads frames from a V4L2 virtual camera device (default /dev/video9) using
OpenCV's V4L2 backend.  Capture runs in a dedicated background thread that
pushes frames into a bounded queue, so slow model inference never blocks
frame acquisition.

Reuses existing AVSS models (PersonDetector, FaceDetector, FaceRecognizer,
PersonReID / OSNet, ByteTrack) — no duplicate models are loaded.

Standalone test:
    cd backend
    python -m app.ai.live_camera

Programmatic use:
    from app.ai.live_camera import AVSSLiveCamera, run_live_pipeline
    cam = AVSSLiveCamera(device="/dev/video9", camera_id="pixel7_usb_cam_01")
    cam.start()
    run_live_pipeline(cam, query_embedding=emb, on_match=print)
    cam.stop()
"""
import cv2
import logging
import numpy as np
import queue
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Optional

logger = logging.getLogger(__name__)

# ── AVSS camera configuration ──────────────────────────────────────────────
CAMERA_DEVICE    = "/dev/video9"
CAMERA_ID        = "pixel7_usb_cam_01"
WIDTH            = 1280
HEIGHT           = 720
FPS              = 30
RECONNECT_DELAY  = 2          # seconds between reconnect attempts
MAX_FAILED_READS = 10         # consecutive read failures before reconnect
QUEUE_MAXSIZE    = 4          # bounded — drops old frames when inference is slow


# ─────────────────────────────────────────────────────────────────────────────
# LiveFrame — metadata attached to every frame from the live camera
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class LiveFrame:
    """A single frame from the live camera with preserved metadata."""
    frame: np.ndarray
    camera_id: str
    timestamp: datetime
    frame_index: int
    width: int
    height: int


# ─────────────────────────────────────────────────────────────────────────────
# AVSSLiveCamera — V4L2 capture with reconnection and bounded queue
# ─────────────────────────────────────────────────────────────────────────────

class AVSSLiveCamera:
    """
    Reusable live camera reader for V4L2 devices (scrcpy → /dev/video9).

    A dedicated capture thread reads frames into a bounded queue.  The
    inference / display side reads from the queue independently, so heavy
    OSNet / ArcFace inference does not block frame acquisition.

    Handles failed reads and temporary disconnections automatically —
    after ``max_failed_reads`` consecutive failures it releases the device
    and reconnects after ``reconnect_delay`` seconds.
    """

    def __init__(
        self,
        device: str = CAMERA_DEVICE,
        camera_id: str = CAMERA_ID,
        width: int = WIDTH,
        height: int = HEIGHT,
        fps: int = FPS,
        reconnect_delay: float = RECONNECT_DELAY,
        max_failed_reads: int = MAX_FAILED_READS,
        queue_maxsize: int = QUEUE_MAXSIZE,
    ):
        self.device = device
        self.camera_id = camera_id
        self.width = width
        self.height = height
        self.fps = fps
        self.reconnect_delay = reconnect_delay
        self.max_failed_reads = max_failed_reads

        self._cap: Optional[cv2.VideoCapture] = None
        self._queue: queue.Queue = queue.Queue(maxsize=queue_maxsize)
        self._running = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._frame_index = 0

    # ── Connection ──────────────────────────────────────────────────────────

    def connect(self) -> bool:
        """Open the V4L2 device and set resolution / FPS / buffer size."""
        self._cap = cv2.VideoCapture(self.device, cv2.CAP_V4L2)
        if not self._cap.isOpened():
            logger.error("Cannot open V4L2 device: %s", self.device)
            self._cap = None
            return False

        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self._cap.set(cv2.CAP_PROP_FPS, self.fps)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # low-latency live capture

        actual_w   = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h   = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = self._cap.get(cv2.CAP_PROP_FPS)
        logger.info(
            "LiveCamera connected: device=%s camera_id=%s %dx%d @ %.1f fps",
            self.device, self.camera_id, actual_w, actual_h, actual_fps,
        )
        return True

    def disconnect(self) -> None:
        """Release the capture device."""
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    # ── Capture thread ──────────────────────────────────────────────────────

    def _capture_loop(self) -> None:
        """Background thread: read frames, push to bounded queue, reconnect."""
        while self._running.is_set():
            if self._cap is None or not self._cap.isOpened():
                logger.info("LiveCamera: connecting to %s ...", self.device)
                if not self.connect():
                    logger.warning(
                        "LiveCamera: connect failed, retrying in %ds",
                        int(self.reconnect_delay),
                    )
                    time.sleep(self.reconnect_delay)
                    continue

            failed = 0
            while self._running.is_set():
                ret, frame = self._cap.read()
                if not ret or frame is None:
                    failed += 1
                    if failed >= self.max_failed_reads:
                        logger.warning(
                            "LiveCamera: %d consecutive read failures, reconnecting...",
                            failed,
                        )
                        self.disconnect()
                        time.sleep(self.reconnect_delay)
                        break
                    time.sleep(0.05)
                    continue

                failed = 0
                self._frame_index += 1
                live_frame = LiveFrame(
                    frame=frame,
                    camera_id=self.camera_id,
                    timestamp=datetime.now(timezone.utc),
                    frame_index=self._frame_index,
                    width=frame.shape[1],
                    height=frame.shape[0],
                )

                # Bounded queue — drop oldest frame if full (keeps latency low)
                try:
                    self._queue.put_nowait(live_frame)
                except queue.Full:
                    try:
                        self._queue.get_nowait()
                    except queue.Empty:
                        pass
                    try:
                        self._queue.put_nowait(live_frame)
                    except queue.Full:
                        pass

        self.disconnect()
        logger.info("LiveCamera capture thread stopped.")

    # ── Public API ──────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the capture thread."""
        if self._running.is_set():
            return
        self._running.set()
        self._thread = threading.Thread(
            target=self._capture_loop,
            name=f"live-camera-{self.camera_id}",
            daemon=True,
        )
        self._thread.start()
        logger.info("LiveCamera started: camera_id=%s device=%s", self.camera_id, self.device)

    def stop(self) -> None:
        """Stop the capture thread and release the device."""
        self._running.clear()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        self.disconnect()
        logger.info("LiveCamera stopped: camera_id=%s", self.camera_id)

    def get_frame(self, timeout: float = 1.0) -> Optional[LiveFrame]:
        """Get the next frame from the queue (blocks up to *timeout* seconds)."""
        try:
            return self._queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def get_latest_frame(self, timeout: float = 1.0) -> Optional[LiveFrame]:
        """
        Get the most recent frame, discarding any older queued frames.
        Best for live display where only the latest frame matters.
        """
        frame = None
        while True:
            try:
                frame = self._queue.get_nowait()
            except queue.Empty:
                break
        if frame is None:
            try:
                frame = self._queue.get(timeout=timeout)
            except queue.Empty:
                pass
        return frame

    def is_running(self) -> bool:
        return self._running.is_set()

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *_):
        self.stop()


# ─────────────────────────────────────────────────────────────────────────────
# run_live_pipeline — pass live frames through the EXISTING AVSS pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_live_pipeline(
    camera: AVSSLiveCamera,
    query_embedding: Optional[np.ndarray] = None,
    similarity_threshold: float = 0.50,
    person_conf: float = 0.55,
    on_match: Optional[Callable[[dict], None]] = None,
    on_frame: Optional[Callable[[np.ndarray, LiveFrame], None]] = None,
) -> None:
    """
    Run the existing AVSS detection / tracking / Re-ID pipeline on live
    camera frames.

    Reuses (no duplicates):
      - PersonDetector      (wildtrack_best.pt)
      - FaceDetector        (yolov8n-face.pt)
      - FaceRecognizer      (InsightFace ArcFace buffalo_l)
      - PersonReID / OSNet  (osnet_final.pt — optional, graceful if absent)
      - ByteTrack           (supervision)

    Does NOT write a database row per frame — match events go to the
    ``on_match`` callback.  Each event dict contains:
        camera_id, timestamp, track_id, similarity, bbox, frame_index, thumbnail

    Args:
        camera:               A started AVSSLiveCamera instance.
        query_embedding:       ArcFace 512-dim embedding of the target person.
                               If None, runs detection + tracking only.
        similarity_threshold:  Minimum cosine similarity for a face match.
        person_conf:           YOLOv8 person confidence for live display.
        on_match:              Callback(match_event_dict) when a person matches.
        on_frame:              Callback(annotated_frame, live_frame) per processed frame.
    """
    # Lazy imports — reuse existing singletons, do NOT load new models
    from app.ai.person import PersonDetector
    from app.ai.face import FaceDetector
    from app.ai.recognition import FaceRecognizer
    from app.ai.tracking import create_byte_tracker, detections_to_supervision
    from app.ai.weights_config import (
        FACE_IN_PERSON_CONF,
        LIVE_MIN_PERSON_PX,
        LIVE_MIN_BRIGHTNESS,
    )

    # Load models (singletons — loaded once, reused across all frames)
    person_detector = PersonDetector.load(confidence_threshold=person_conf)
    face_detector = FaceDetector.load()
    face_recognizer = FaceRecognizer.load()
    tracker = create_byte_tracker(frame_rate=10)

    # OSNet re-ID (optional — graceful if weights absent)
    reid_model = None
    try:
        from app.ai.reid import PersonReID, OSNET_WEIGHTS
        if OSNET_WEIGHTS.exists():
            reid_model = PersonReID.load()
            logger.info("Live pipeline: OSNet re-ID enabled")
    except Exception as exc:
        logger.info("Live pipeline: OSNet not available (%s) — face-only mode", exc)

    logger.info(
        "Live pipeline ready: person=%s face=%s reid=%s tracker=ByteTrack",
        person_detector.model_name,
        face_detector.model_name,
        "OSNet" if reid_model else "disabled",
    )

    matched_tids: set[int] = set()
    track_face_embeddings: dict[int, np.ndarray] = {}
    track_body_embeddings: dict[int, np.ndarray] = {}

    while camera.is_running():
        lf = camera.get_latest_frame(timeout=1.0)
        if lf is None:
            continue

        frame = lf.frame
        h, w = frame.shape[:2]
        annotated = frame.copy()

        # Brightness check — skip detection on very dark frames
        gray = cv2.resize(frame, (80, 60))
        gray = cv2.cvtColor(gray, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))

        if brightness > LIVE_MIN_BRIGHTNESS:
            persons = person_detector.detect(frame, confidence_threshold=person_conf)
            sv_dets = detections_to_supervision(persons)
            tracked = tracker.update_with_detections(sv_dets)

            if tracked is not None and len(tracked) > 0:
                track_ids = tracked.tracker_id
                for i in range(len(tracked)):
                    try:
                        bbox = tracked.xyxy[i]
                    except (TypeError, IndexError):
                        continue

                    tid = int(track_ids[i]) if track_ids is not None and i < len(track_ids) else i
                    x1 = max(0, int(bbox[0]))
                    y1 = max(0, int(bbox[1]))
                    x2 = min(w, int(bbox[2]))
                    y2 = min(h, int(bbox[3]))

                    if x2 - x1 < LIVE_MIN_PERSON_PX:
                        continue

                    # Draw box — green for matched, grey for others
                    is_match = tid in matched_tids
                    color = (0, 255, 0) if is_match else (80, 80, 80)
                    thickness = 3 if is_match else 1
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)
                    label = f"ID:{tid}" + (" MATCH" if is_match else "")
                    cv2.putText(
                        annotated, label, (x1 + 3, max(y1 - 6, 16)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2, cv2.LINE_AA,
                    )

                    person_crop = frame[y1:y2, x1:x2]

                    # OSNet body embedding — once per track (reuses existing model)
                    if reid_model is not None and tid not in track_body_embeddings:
                        body_emb = reid_model.get_embedding(person_crop)
                        if body_emb is not None:
                            track_body_embeddings[tid] = body_emb

                    # Face matching against query embedding
                    if query_embedding is not None and tid not in matched_tids:
                        faces = face_detector.detect_in_crop(
                            person_crop,
                            confidence_threshold=FACE_IN_PERSON_CONF,
                        )
                        if faces:
                            best_face = max(faces, key=lambda f: f.confidence)
                            if best_face.width >= 24 and best_face.height >= 24:
                                face_crop = best_face.crop(person_crop)
                                face_emb = face_recognizer.get_embedding_from_crop(face_crop)
                                if face_emb is not None:
                                    track_face_embeddings[tid] = face_emb
                                    sim = float(np.dot(query_embedding, face_emb))
                                    if sim >= similarity_threshold:
                                        matched_tids.add(tid)
                                        # Generate thumbnail (JPEG bytes of person crop)
                                        ok, buf = cv2.imencode(
                                            ".jpg", person_crop,
                                            [cv2.IMWRITE_JPEG_QUALITY, 80],
                                        )
                                        thumbnail = buf.tobytes() if ok else None
                                        match_event = {
                                            "camera_id": lf.camera_id,
                                            "timestamp": lf.timestamp.isoformat(),
                                            "track_id": tid,
                                            "similarity": round(sim, 4),
                                            "bbox": [x1, y1, x2, y2],
                                            "frame_index": lf.frame_index,
                                            "thumbnail": thumbnail,
                                        }
                                        logger.info(
                                            "LIVE MATCH: camera=%s tid=%d sim=%.3f",
                                            lf.camera_id, tid, sim,
                                        )
                                        if on_match:
                                            on_match(match_event)

        # Camera ID + timestamp overlay (preserved on every annotated frame)
        overlay = f"[{lf.camera_id}] {lf.timestamp.strftime('%H:%M:%S.%f')[:-3]} #{lf.frame_index}"
        cv2.putText(annotated, overlay, (10, 25),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 200), 2, cv2.LINE_AA)
        cv2.putText(annotated, overlay, (10, 25),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

        if on_frame:
            on_frame(annotated, lf)


# ─────────────────────────────────────────────────────────────────────────────
# Standalone test — displays live footage from the V4L2 camera
# ─────────────────────────────────────────────────────────────────────────────

def _standalone_test() -> None:
    """Open the V4L2 camera, display live footage, print camera ID + timestamps."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    cam = AVSSLiveCamera()
    cam.start()

    # Give the capture thread a moment to connect
    time.sleep(1)

    logger.info("Press 'q' to quit.")
    try:
        while True:
            lf = cam.get_latest_frame(timeout=1.0)
            if lf is None:
                logger.warning("No frame received (camera may be disconnected).")
                continue

            logger.info(
                "frame #%d  camera_id=%s  %s  %dx%d",
                lf.frame_index, lf.camera_id,
                lf.timestamp.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                lf.width, lf.height,
            )

            # Annotate with camera ID + timestamp
            annotated = lf.frame.copy()
            label = (
                f"[{lf.camera_id}] "
                f"{lf.timestamp.strftime('%H:%M:%S.%f')[:-3]} "
                f"frame#{lf.frame_index}"
            )
            cv2.putText(annotated, label, (10, 25),
                         cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 200), 2, cv2.LINE_AA)
            cv2.putText(annotated, label, (10, 25),
                         cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

            cv2.imshow("AVSS Live Camera — Pixel 7", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cam.stop()
        cv2.destroyAllWindows()
        logger.info("Standalone test complete.")


if __name__ == "__main__":
    _standalone_test()
