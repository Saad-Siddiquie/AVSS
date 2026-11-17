"""
Module 4 — Camera Management API
Endpoints for adding, listing, retrieving, updating, and deleting cameras.
All endpoints require a valid JWT access token.
"""
import logging
from typing import Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.auth import get_user_from_token
from app.core.database import get_db
from app.schemas.camera import CameraCreate, CameraListResponse, CameraRead, CameraUpdate
from app.services import camera as camera_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Cameras"])


@router.post(
    "/cameras",
    response_model=CameraRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new camera",
    description=(
        "Register a new camera source. Supported types: `rtsp`, `webcam`, `file`. "
        "RTSP cameras require a full stream URL (e.g. `rtsp://192.168.1.100/stream`). "
        "Webcam cameras use a device path or index (e.g. `/dev/video0` or `0`). "
        "File cameras use an absolute path to an MP4 file."
    ),
)
def add_camera(
    payload: CameraCreate,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Add a new camera to the surveillance system.
    Input: CameraCreate (name, url, camera_type, location, status)
    Output: Created CameraRead record
    Errors: 409 if camera name already exists, 422 for validation errors
    """
    logger.info("Creating camera: name=%s type=%s", payload.name, payload.camera_type)
    camera = camera_service.create_camera(db, payload)
    logger.info("Camera created: id=%d name=%s", camera.id, camera.name)
    return camera


@router.get(
    "/cameras",
    response_model=CameraListResponse,
    summary="List all cameras",
    description="Returns a paginated list of all registered cameras.",
)
def list_cameras(
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=100, ge=1, le=500, description="Maximum records to return"),
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Retrieve all cameras with pagination.
    Input: skip (offset), limit (page size)
    Output: CameraListResponse { total, cameras[] }
    """
    total, cameras = camera_service.list_cameras(db, skip=skip, limit=limit)
    return CameraListResponse(total=total, cameras=cameras)


@router.get(
    "/cameras/{camera_id}",
    response_model=CameraRead,
    summary="Get a single camera",
    description="Retrieve full details for a specific camera by its ID.",
)
def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Fetch one camera record.
    Input: camera_id (path parameter)
    Output: CameraRead
    Errors: 404 if not found
    """
    return camera_service.get_camera(db, camera_id)


@router.put(
    "/cameras/{camera_id}",
    response_model=CameraRead,
    summary="Update a camera",
    description="Partially update a camera. Only provided fields are changed.",
)
def update_camera(
    camera_id: int,
    payload: CameraUpdate,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Update camera name, URL, type, location, or status.
    Input: camera_id (path), CameraUpdate (partial fields)
    Output: Updated CameraRead
    Errors: 404 if not found, 409 if new name conflicts
    """
    logger.info("Updating camera id=%d", camera_id)
    return camera_service.update_camera(db, camera_id, payload)


@router.delete(
    "/cameras/{camera_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a camera",
    description="Permanently remove a camera from the system.",
)
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_user_from_token),
):
    """
    Purpose: Delete a camera record.
    Input: camera_id (path parameter)
    Output: 204 No Content
    Errors: 404 if not found
    """
    logger.info("Deleting camera id=%d", camera_id)
    camera_service.delete_camera(db, camera_id)


# ── Live stream + test-connection endpoints ───────────────────────────────────

import os as _os
import time as _time
import threading as _threading_mod
from fastapi import HTTPException as _HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel as _BaseModel


# ── Shared V4L2 device manager ────────────────────────────────────────────────
# V4L2 devices are exclusive — only one VideoCapture can hold a device at a time.
# This manager runs one capture thread per device path and distributes the latest
# frame to all registered consumers via a callback. When all consumers disconnect
# the device is released automatically.

class _V4L2DeviceManager:
    """Singleton per-device: one capture thread, N consumers."""

    def __init__(self):
        self._devices: dict[str, dict] = {}   # url → {cap, thread, consumers, frame, lock, stop}
        self._mgr_lock = _threading_mod.Lock()

    def subscribe(self, url: str) -> "dict":
        """
        Register as a consumer of *url*.  Returns a consumer handle dict
        with keys: get_frame() → np.ndarray | None,  release().
        """
        import cv2 as _cv2_dm

        with self._mgr_lock:
            if url not in self._devices:
                cap = _cv2_dm.VideoCapture(url, _cv2_dm.CAP_V4L2)
                if not cap.isOpened():
                    # Try integer index as fallback
                    tail = url.replace("/dev/video", "")
                    if tail.isdigit():
                        cap.release()
                        cap = _cv2_dm.VideoCapture(int(tail), _cv2_dm.CAP_V4L2)
                    if not cap.isOpened():
                        cap.release()
                        return None  # device unavailable

                cap.set(_cv2_dm.CAP_PROP_BUFFERSIZE, 1)
                cap.set(_cv2_dm.CAP_PROP_FOURCC, _cv2_dm.VideoWriter_fourcc(*"MJPG"))

                dev = {
                    "cap":       cap,
                    "frame":     None,
                    "lock":      _threading_mod.Lock(),
                    "stop":      _threading_mod.Event(),
                    "consumers": 0,
                    "thread":    None,
                }

                def _reader(d=dev):
                    while not d["stop"].is_set():
                        ret, f = d["cap"].read()
                        if ret and f is not None:
                            with d["lock"]:
                                d["frame"] = f
                        else:
                            _time.sleep(0.005)
                    d["cap"].release()
                    logger.info("V4L2DeviceManager: released %s", url)

                dev["thread"] = _threading_mod.Thread(target=_reader, daemon=True)
                dev["thread"].start()
                self._devices[url] = dev
                logger.info("V4L2DeviceManager: opened %s", url)

            dev = self._devices[url]
            dev["consumers"] += 1

        def get_frame():
            with dev["lock"]:
                return dev["frame"]

        def release():
            with self._mgr_lock:
                if url not in self._devices:
                    return
                dev2 = self._devices[url]
                dev2["consumers"] -= 1
                if dev2["consumers"] <= 0:
                    dev2["stop"].set()
                    dev2["thread"].join(timeout=2)
                    del self._devices[url]
                    logger.info("V4L2DeviceManager: all consumers gone, released %s", url)

        return {"get_frame": get_frame, "release": release}


_v4l2_mgr = _V4L2DeviceManager()


class StreamTestRequest(_BaseModel):
    url: str


@router.post(
    "/cameras/test-stream",
    summary="Test if a camera URL is reachable",
    tags=["Cameras"],
)
def test_stream(body: StreamTestRequest, _user=Depends(get_user_from_token)):
    """
    Opens the camera URL with OpenCV (FFmpeg backend) and returns stream metadata.
    Used by the Add Camera form's Test Connection button.
    """
    import cv2 as _cv2

    # Set FFmpeg options for faster connection timeout
    if body.url.startswith("/dev/video"):
        cap = _cv2.VideoCapture(body.url, _cv2.CAP_V4L2)
    else:
        _os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;5000000")
        cap = _cv2.VideoCapture(body.url, _cv2.CAP_FFMPEG)
    try:
        if not cap.isOpened():
            raise _HTTPException(
                status_code=400,
                detail="Cannot open stream. Check the URL, credentials, and network connectivity."
            )
        # Try reading up to 3 frames (RTSP sometimes needs a few reads to start)
        frame = None
        for _ in range(3):
            ret, frame = cap.read()
            if ret and frame is not None:
                break
            _time.sleep(0.1)

        if frame is None:
            raise _HTTPException(
                status_code=400,
                detail="Stream opened but no frame received. Camera may be initialising — try again."
            )
        h, w = frame.shape[:2]
        fps  = cap.get(_cv2.CAP_PROP_FPS) or None
        return {
            "reachable": True,
            "width":  w,
            "height": h,
            "fps":    round(float(fps), 2) if fps else None,
            "message": f"Connected — {w}×{h} @ {fps:.1f} fps" if fps else f"Connected — {w}×{h}",
        }
    finally:
        cap.release()


def _mjpeg_generator(url: str, max_reconnects: int = 5):
    """
    Robust MJPEG generator — raw stream, no inference.

    For V4L2 devices uses _v4l2_mgr so multiple streams can share the same
    device without exclusive-access conflicts.
    """
    import cv2 as _cv2

    # ── V4L2 fast path: shared device manager ────────────────────────────────
    if url.startswith("/dev/video"):
        handle = _v4l2_mgr.subscribe(url)
        if handle is None:
            logger.warning("MJPEG: V4L2 device unavailable: %s", url)
            return
        logger.info("MJPEG: subscribed to shared V4L2 device %s", url)
        FRAME_INTERVAL = 1.0 / 25
        last_yield = 0.0
        try:
            while True:
                frame = handle["get_frame"]()
                if frame is None:
                    _time.sleep(0.01)
                    continue

                now = _time.monotonic()
                gap = FRAME_INTERVAL - (now - last_yield)
                if gap > 0:
                    _time.sleep(gap)
                last_yield = _time.monotonic()

                h, w = frame.shape[:2]
                if w > 640:
                    frame = _cv2.resize(frame, (640, int(h * 640 / w)))

                ok, buf = _cv2.imencode(".jpg", frame, [_cv2.IMWRITE_JPEG_QUALITY, 65])
                if not ok:
                    continue
                data = buf.tobytes()
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                    b"\r\n" + data + b"\r\n"
                )
        except GeneratorExit:
            logger.info("MJPEG V4L2: client disconnected")
        finally:
            handle["release"]()
        return

    # ── Standard path: RTSP / file / HTTP ────────────────────────────────────
    _os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;10000000")

    reconnects = 0
    while reconnects <= max_reconnects:
        cap = _cv2.VideoCapture(url, _cv2.CAP_FFMPEG)
        opened = cap.isOpened()
        consecutive_failures = 0

        if opened:
            reconnects = 0

        try:
            while opened:
                ret, frame = cap.read()
                if not ret or frame is None:
                    consecutive_failures += 1
                    if consecutive_failures > 10:
                        logger.warning("MJPEG stream: too many failures, reconnecting...")
                        break
                    _time.sleep(0.05)
                    continue

                consecutive_failures = 0

                h, w = frame.shape[:2]
                if w > 640:
                    scale = 640 / w
                    frame = _cv2.resize(frame, (640, int(h * scale)))

                ok, buf = _cv2.imencode(".jpg", frame, [_cv2.IMWRITE_JPEG_QUALITY, 65])
                if not ok:
                    continue

                data = buf.tobytes()
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                    b"\r\n" + data + b"\r\n"
                )
        except GeneratorExit:
            logger.info("MJPEG client disconnected.")
            return
        finally:
            cap.release()

        reconnects += 1
        if reconnects <= max_reconnects:
            logger.info("MJPEG reconnect attempt %d/%d for: %s", reconnects, max_reconnects, url[:60])
            _time.sleep(min(reconnects * 2, 10))

    logger.warning("MJPEG stream exhausted reconnect attempts: %s", url[:60])


@router.get(
    "/cameras/{camera_id}/stream",
    summary="MJPEG stream proxy — no auth (URL is secure by camera ID)",
    tags=["Cameras"],
    # NOTE: No auth dependency — browsers cannot send Authorization headers with <img> tags.
    # The camera ID in the URL is sufficient access control for a local deployment.
)
def stream_camera(
    camera_id: int,
    db=Depends(get_db),
):
    """
    Proxies the camera's RTSP/video stream as MJPEG (multipart/x-mixed-replace).
    Browsers display it via a plain <img src="..."> tag — no plugins required.

    Auto-reconnects on stream loss with exponential backoff.
    Works with: RTSP, RTSP over TCP, HTTP MJPEG, video files, webcams.
    """
    from app.models.camera import Camera as CameraModel
    cam = db.query(CameraModel).filter(CameraModel.id == camera_id).first()
    if not cam:
        raise _HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    logger.info("Starting MJPEG stream for camera id=%d url=%s...", camera_id, cam.url[:60])

    return StreamingResponse(
        _mjpeg_generator(cam.url),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma":        "no-cache",
            "Expires":       "0",
            "X-Accel-Buffering": "no",   # disable nginx buffering if proxied
        },
    )


@router.get(
    "/cameras/{camera_id}/snapshot",
    summary="Single JPEG snapshot from camera",
    tags=["Cameras"],
)
def camera_snapshot(
    camera_id: int,
    db=Depends(get_db),
):
    """
    Returns a single JPEG frame from the camera. Useful for thumbnails.
    No auth required (same reasoning as /stream).
    """
    import cv2 as _cv2
    from fastapi.responses import Response as _Response

    from app.models.camera import Camera as CameraModel
    cam = db.query(CameraModel).filter(CameraModel.id == camera_id).first()
    if not cam:
        raise _HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    if cam.camera_type == "webcam" or cam.url.startswith("/dev/video"):
        cap = _cv2.VideoCapture(cam.url, _cv2.CAP_V4L2)
    else:
        _os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;5000000")
        cap = _cv2.VideoCapture(cam.url, _cv2.CAP_FFMPEG)
    try:
        for _ in range(5):  # skip a few frames for cameras that start black
            ret, frame = cap.read()
            if ret and frame is not None:
                break

        if not ret or frame is None:
            raise _HTTPException(status_code=503, detail="Camera not reachable.")

        # Resize thumbnail
        h, w = frame.shape[:2]
        if w > 640:
            scale = 640 / w
            frame = _cv2.resize(frame, (640, int(h * scale)))

        ok, buf = _cv2.imencode(".jpg", frame, [_cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ok:
            raise _HTTPException(status_code=500, detail="Could not encode frame.")

        return _Response(
            content=buf.tobytes(),
            media_type="image/jpeg",
            headers={"Cache-Control": "max-age=5"},
        )
    finally:
        cap.release()


# ── IP Webcam (Android app) support ──────────────────────────────────────────
# IP Webcam streams a JPEG snapshot endpoint and MJPEG stream over HTTP.
# RTSP URLs also work: rtsp://ip:port/h264_ulaw.sdp

import threading as _threading
import queue as _queue


def _normalize_ip_webcam_url(url: str) -> dict:
    """
    Given any IP Webcam URL format, return all the stream URLs.

    Supports:
      - http://192.168.x.x:8080          → derive MJPEG, snapshot, RTSP
      - https://192.168.x.x:8080         → same
      - rtsp://192.168.x.x:8080/...      → use as-is + derive HTTP base
      - rtsp://192.168.x.x:8080/h264_ulaw.sdp
    """
    url = url.strip().rstrip("/")

    if url.startswith("rtsp://"):
        # Extract host:port for the HTTP base
        rest    = url[7:]  # strip rtsp://
        hostport = rest.split("/")[0]
        base_http = f"http://{hostport}"
        return {
            "rtsp_url":      url,
            "rtsp_hq":       f"rtsp://{hostport}/h264_pcm.sdp",
            "mjpeg_url":     f"{base_http}/video",
            "snapshot_url":  f"{base_http}/shot.jpg",
            "base_http":     base_http,
        }
    else:
        # HTTP base URL  →  derive everything
        # Strip trailing /video, /shot.jpg etc. if present
        for suffix in ["/video", "/shot.jpg", "/mjpeg", "/stream"]:
            if url.endswith(suffix):
                url = url[:-len(suffix)]
        hostport = url.split("//", 1)[-1]
        return {
            "rtsp_url":  f"rtsp://{hostport}/h264_ulaw.sdp",
            "rtsp_hq":   f"rtsp://{hostport}/h264_pcm.sdp",
            "mjpeg_url": f"{url}/video",
            "snapshot_url": f"{url}/shot.jpg",
            "base_http": url,
        }


def _ip_webcam_mjpeg_generator(url: str):
    """
    MJPEG generator for IP Webcam Android app.

    Try order:
      1. Direct HTTP MJPEG stream  (/video)
      2. RTSP h264 via FFmpeg      (rtsp://ip:port/h264_ulaw.sdp)
      3. Snapshot polling          (/shot.jpg) — slowest, always works
    """
    import time as _time_mod
    import urllib.request as _urllib

    urls = _normalize_ip_webcam_url(url)
    logger.info("IP Webcam stream: %s", urls)

    # ── Method 1: HTTP MJPEG stream (/video endpoint) ───────────────────────
    try:
        req = _urllib.Request(urls["mjpeg_url"], headers={"User-Agent": "AVSS/1.0"})
        response = _urllib.urlopen(req, timeout=5)
        buf = b""
        SOI = b"\xff\xd8"
        EOI = b"\xff\xd9"
        logger.info("IP Webcam: HTTP MJPEG stream connected")
        while True:
            chunk = response.read(8192)
            if not chunk:
                break
            buf += chunk
            while True:
                start = buf.find(SOI)
                if start == -1: buf = b""; break
                end = buf.find(EOI, start + 2)
                if end == -1: buf = buf[start:]; break
                frame_data = buf[start:end + 2]
                buf = buf[end + 2:]
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame_data)).encode() + b"\r\n"
                    b"\r\n" + frame_data + b"\r\n"
                )
        return  # clean exit
    except GeneratorExit:
        return
    except Exception as e:
        logger.warning("IP Webcam HTTP MJPEG failed (%s) — trying FFmpeg RTSP", e)

    # ── Method 2: RTSP via FFmpeg ────────────────────────────────────────────
    try:
        yield from _ffmpeg_mjpeg_generator(urls["rtsp_url"])
        return
    except GeneratorExit:
        return
    except Exception as e:
        logger.warning("IP Webcam RTSP failed (%s) — falling back to snapshot polling", e)

    # ── Method 3: Snapshot polling (/shot.jpg) ───────────────────────────────
    logger.info("IP Webcam: snapshot polling mode (1 fps)")
    while True:
        try:
            req  = _urllib.Request(urls["snapshot_url"], headers={"User-Agent": "AVSS/1.0"})
            resp = _urllib.urlopen(req, timeout=3)
            data = resp.read()
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                b"\r\n" + data + b"\r\n"
            )
            _time_mod.sleep(0.1)
        except GeneratorExit:
            return
        except Exception as e:
            logger.debug("Snapshot poll error: %s", e)
            _time_mod.sleep(1)


@router.get(
    "/cameras/{camera_id}/stream/live",
    summary="Live MJPEG stream with real-time AI detection overlay",
    tags=["Cameras"],
)
def stream_camera_live(
    camera_id: int,
    detect: bool  = True,    # ?detect=false to disable AI overlay
    conf:   float = 0.55,    # ?conf=0.70 to make stricter, ?conf=0.40 for more detections
    db=Depends(get_db),
):
    """
    Live MJPEG stream from any camera type — with optional real-time AI detection overlay.

    Supports:
      - IP Webcam Android app  (http://ip:port or rtsp://ip:port/h264_ulaw.sdp)
      - Any RTSP camera
      - Webcams / video files

    AI overlay (when detect=True):
      - YOLOv8 draws person bounding boxes directly on each frame
      - ByteTrack assigns persistent IDs
      - No face matching — this is pure live detection for display

    Browser usage: <img src="/api/v1/cameras/{id}/stream/live">
    """
    from app.models.camera import Camera as CameraModel
    cam = db.query(CameraModel).filter(CameraModel.id == camera_id).first()
    if not cam:
        raise _HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    logger.info("Live stream request: camera=%d type=%s detect=%s", camera_id, cam.camera_type, detect)

    def generator():
        if detect:
            yield from _live_detection_generator(cam.url, cam.camera_type, live_conf=conf)
        elif cam.camera_type in ("ip_webcam", "http") or cam.url.startswith("http://") or cam.url.startswith("https://"):
            yield from _ip_webcam_mjpeg_generator(cam.url)
        else:
            yield from _ffmpeg_mjpeg_generator(cam.url)

    return StreamingResponse(
        generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _live_detection_generator(url: str, camera_type: str, live_conf: float = 0.55):
    """
    Fast live MJPEG with AI detection overlay.

    Performance design:
      - Dedicated capture thread reads frames at full camera FPS into a 1-slot
        buffer — inference latency never causes stale frames to pile up.
      - YOLOv8 inference runs every INFER_EVERY frames (default every 3rd),
        reusing the last bbox result on skipped frames for smooth display.
      - Inference at 320px width — ~3× faster than 960px, good enough for
        person detection.
      - Output JPEG at 640px / quality 65 — reduces encode and network time.
    """
    import cv2 as _cv2
    import threading as _threading
    import time as _time_mod
    import numpy as _np

    INFER_EVERY    = 3     # run YOLOv8 every Nth frame; reuse bboxes between
    INFER_W        = 320   # inference width in pixels (height scaled proportionally)
    OUTPUT_W       = 640   # max output width sent to browser
    JPEG_QUALITY   = 65    # JPEG encode quality (65 is fine for live preview)

    # ── Open capture ─────────────────────────────────────────────────────────
    cap = None
    if camera_type in ("ip_webcam", "http") or url.startswith("http://") or url.startswith("https://"):
        urls = _normalize_ip_webcam_url(url)
        for try_url in [urls["rtsp_url"], urls["mjpeg_url"], url]:
            cap = _cv2.VideoCapture(try_url, _cv2.CAP_FFMPEG)
            if cap.isOpened():
                logger.info("Live detection: opened %s", try_url)
                break
            cap.release()
            cap = None
    elif camera_type == "webcam" or url.startswith("/dev/video"):
        # Use shared device manager — allows concurrent streams on the same device
        _handle_ldet = _v4l2_mgr.subscribe(url)
        if _handle_ldet is None:
            logger.warning("Live detection: V4L2 device unavailable: %s", url)
            return
        logger.info("Live detection: subscribed to shared V4L2 device %s", url)
        cap = None   # signals to use _handle_ldet below
    else:
        _os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;10000000")
        cap = _cv2.VideoCapture(url, _cv2.CAP_FFMPEG)

    if cap is not None and not cap.isOpened():
        logger.warning("Live detection: cannot open %s", url)
        cap.release()
        return

    # For V4L2 devices the shared manager already runs the capture thread.
    # For all other sources we start our own capture thread here.
    _handle_ldet_local = locals().get("_handle_ldet", None)
    _is_v4l2 = _handle_ldet_local is not None

    # ── Load models (singletons — loaded once at startup) ────────────────────
    try:
        from app.ai.person import PersonDetector
        from app.ai.tracking import create_byte_tracker, detections_to_supervision
        from app.ai.weights_config import LIVE_MIN_PERSON_PX, LIVE_MIN_BRIGHTNESS
        detector = PersonDetector.load()
        tracker  = create_byte_tracker(frame_rate=10)
        logger.info("Live detection ready: conf=%.2f infer_every=%d infer_w=%d", live_conf, INFER_EVERY, INFER_W)
    except Exception as exc:
        logger.warning("Live detection: AI unavailable (%s) — raw stream fallback", exc)
        if _is_v4l2:
            try:
                while True:
                    frame = _handle_ldet_local["get_frame"]()
                    if frame is None:
                        _time_mod.sleep(0.01)
                        continue
                    h, w = frame.shape[:2]
                    if w > OUTPUT_W:
                        frame = _cv2.resize(frame, (OUTPUT_W, int(h * OUTPUT_W / w)))
                    ok, buf = _cv2.imencode(".jpg", frame, [_cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                    if ok:
                        data = buf.tobytes()
                        yield (b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                               + str(len(data)).encode() + b"\r\n\r\n" + data + b"\r\n")
            except GeneratorExit:
                pass
            finally:
                _handle_ldet_local["release"]()
        else:
            try:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        _time_mod.sleep(0.05)
                        continue
                    h, w = frame.shape[:2]
                    if w > OUTPUT_W:
                        frame = _cv2.resize(frame, (OUTPUT_W, int(h * OUTPUT_W / w)))
                    ok, buf = _cv2.imencode(".jpg", frame, [_cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                    if ok:
                        data = buf.tobytes()
                        yield (b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                               + str(len(data)).encode() + b"\r\n\r\n" + data + b"\r\n")
            except GeneratorExit:
                pass
            finally:
                cap.release()
        return

    # ── Frame getter — unified API regardless of V4L2 vs other source ────────
    if _is_v4l2:
        def _get_latest_frame():
            return _handle_ldet_local["get_frame"]()
        _release_capture = _handle_ldet_local["release"]
    else:
        cap.set(_cv2.CAP_PROP_BUFFERSIZE, 1)
        _latest_ld: dict = {"frame": None}
        _stop_ld = _threading.Event()

        def _capture_ld():
            while not _stop_ld.is_set():
                ret, f = cap.read()
                if ret and f is not None:
                    _latest_ld["frame"] = f
                else:
                    _time_mod.sleep(0.005)

        _t_ld = _threading.Thread(target=_capture_ld, daemon=True)
        _t_ld.start()

        def _get_latest_frame():
            return _latest_ld.get("frame")

        def _release_capture():
            _stop_ld.set()
            _t_ld.join(timeout=1)
            cap.release()

    FONT       = _cv2.FONT_HERSHEY_SIMPLEX
    frame_n    = 0
    last_tracked  = None
    last_scale    = 1.0
    last_wh       = (0, 0)
    last_bright   = 100.0

    try:
        while True:
            frame = _get_latest_frame()
            if frame is None:
                _time_mod.sleep(0.01)
                continue

            frame_n += 1
            h, w = frame.shape[:2]

            # ── Run inference every INFER_EVERY frames only ───────────────
            if frame_n % INFER_EVERY == 1:
                # Scale to INFER_W for fast inference
                infer_w = min(w, INFER_W)
                scale   = infer_w / w
                proc    = _cv2.resize(frame, (infer_w, int(h * scale))) if scale < 1.0 else frame

                # Brightness check — skip on dark frames
                gray       = _cv2.resize(proc, (40, 30))
                gray       = _cv2.cvtColor(gray, _cv2.COLOR_BGR2GRAY)
                brightness = float(_np.mean(gray))
                last_bright = brightness

                try:
                    if brightness > LIVE_MIN_BRIGHTNESS:
                        persons = detector.detect(proc, confidence_threshold=live_conf)
                        sv_dets = detections_to_supervision(persons)
                        tracked = tracker.update_with_detections(sv_dets)
                    else:
                        tracked = tracker.update_with_detections(detections_to_supervision([]))
                except Exception:
                    tracked = None

                last_tracked = tracked
                last_scale   = scale
                last_wh      = (w, h)

            tracked = last_tracked
            scale   = last_scale
            w_ref, h_ref = last_wh if last_wh != (0, 0) else (w, h)

            # ── Annotate frame ────────────────────────────────────────────
            annotated = frame.copy()

            if tracked is not None and len(tracked) > 0:
                track_ids = tracked.tracker_id
                for i in range(len(tracked)):
                    try:
                        bbox = tracked.xyxy[i]
                    except (TypeError, IndexError):
                        continue

                    x1 = max(0, int(bbox[0] / scale))
                    y1 = max(0, int(bbox[1] / scale))
                    x2 = min(w, int(bbox[2] / scale))
                    y2 = min(h, int(bbox[3] / scale))

                    bw, bh = x2 - x1, y2 - y1
                    if bw < LIVE_MIN_PERSON_PX or bh < LIVE_MIN_PERSON_PX * 1.5:
                        continue
                    if bw * bh < w * h * 0.005:
                        continue

                    tid = int(track_ids[i]) if track_ids is not None and i < len(track_ids) else i
                    _cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    label = f"P {tid}"
                    lbl_y = max(y1 - 4, 14)
                    _cv2.putText(annotated, label, (x1 + 2, lbl_y), FONT, 0.45, (0, 220, 0), 1, _cv2.LINE_AA)

            _cv2.putText(annotated, "LIVE  AVSS", (8, 20), FONT, 0.45, (0, 0, 180), 2, _cv2.LINE_AA)
            _cv2.putText(annotated, "LIVE  AVSS", (8, 20), FONT, 0.45, (255, 255, 255), 1, _cv2.LINE_AA)

            if last_bright <= 30.0:
                _cv2.putText(annotated, "LOW LIGHT", (8, 38), FONT, 0.4, (0, 200, 255), 1, _cv2.LINE_AA)

            # ── Encode and yield ──────────────────────────────────────────
            if w > OUTPUT_W:
                annotated = _cv2.resize(annotated, (OUTPUT_W, int(h * OUTPUT_W / w)))

            ok, buf = _cv2.imencode(".jpg", annotated, [_cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            if not ok:
                continue
            data = buf.tobytes()
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                b"\r\n" + data + b"\r\n"
            )

    except GeneratorExit:
        logger.info("Live detection: client disconnected")
    finally:
        _release_capture()
        logger.info("Live detection: stream closed")


# ── Live person-specific stream ───────────────────────────────────────────────
# Accepts a query photo (multipart), embeds the face, then streams only the
# frames where that specific person appears in the live feed.

from fastapi import UploadFile as _UploadFile, File as _File, Form as _Form

@router.post(
    "/cameras/{camera_id}/stream/person",
    summary="Live MJPEG stream showing ONLY a specific person (face-matched)",
    tags=["Cameras"],
)
async def stream_person_live(
    camera_id:           int,
    query_image:         _UploadFile = _File(..., description="Face photo of the person to find"),
    similarity_threshold: float      = _Form(default=0.45, ge=0.1, le=0.9),
    conf:                float       = _Form(default=0.55, ge=0.1, le=0.9),
    db=Depends(get_db),
):
    """
    Live MJPEG stream with FACE MATCHING:
      1. Accepts a query face photo (uploaded once)
      2. Generates ArcFace 512-dim embedding
      3. For every live frame: detect all persons → crop each face → compare with ArcFace
      4. Only draws GREEN box around the MATCHED person
      5. All other persons get a grey box (detected but not the target)

    Display in browser:
      POST /api/v1/cameras/{id}/stream/person  (multipart: query_image file)
      → response is multipart/x-mixed-replace MJPEG stream
    """
    from app.models.camera import Camera as CameraModel
    import cv2 as _cv2, numpy as _np, tempfile as _tmp

    cam = db.query(CameraModel).filter(CameraModel.id == camera_id).first()
    if not cam:
        raise _HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    # ── Read and embed query image ────────────────────────────────────────────
    img_bytes = await query_image.read()
    nparr     = _np.frombuffer(img_bytes, _np.uint8)
    query_img = _cv2.imdecode(nparr, _cv2.IMREAD_COLOR)
    if query_img is None:
        raise _HTTPException(status_code=400, detail="Cannot decode query image.")

    try:
        from app.ai.recognition import FaceRecognizer
        recognizer = FaceRecognizer.load()
        query_emb  = recognizer.get_embedding(query_img)
        if query_emb is None:
            raise _HTTPException(
                status_code=422,
                detail="No face detected in the query image. Use a clear, well-lit front-facing photo.",
            )
    except _HTTPException:
        raise
    except Exception as exc:
        raise _HTTPException(status_code=500, detail=f"Face embedding failed: {exc}")

    logger.info(
        "Person-specific stream: camera=%d threshold=%.2f query_emb_norm=%.4f",
        camera_id, similarity_threshold, float(_np.linalg.norm(query_emb)),
    )

    return StreamingResponse(
        _person_search_stream(cam.url, cam.camera_type, query_emb, similarity_threshold, conf),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control":     "no-cache, no-store, must-revalidate",
            "Pragma":            "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _person_search_stream(
    url: str,
    camera_type: str,
    query_emb: "np.ndarray | None",
    threshold: float,
    live_conf: float,
    query_body_emb: "np.ndarray | None" = None,
    appearance_threshold: float = 0.65,
    focus_mode: bool = False,
):
    """
    Generator: streams live MJPEG with face- or appearance-matched people highlighted.

    For each frame:
      1. YOLOv8 detects all persons
      2. ArcFace compares detected faces when a face query is available
      3. OSNet compares person appearance when a full-person query is available
      4. Matched people receive a GREEN box; other YOLO detections remain visible
    """
    import cv2 as _cv2
    import numpy as _np
    import time as _time_mod

    MATCH_COLOR  = (0, 255, 0)    # green — target found
    OTHER_COLOR  = (80, 80, 80)   # grey  — other persons
    FONT         = _cv2.FONT_HERSHEY_SIMPLEX
    MIN_FACE_PX  = 24
    MIN_PERSON_W = 50

    # ── Open stream ──────────────────────────────────────────────────────────
    import time as _time_open
    _os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;10000000")
    cap = None
    _handle_ps = None   # V4L2 device manager handle

    if camera_type in ("ip_webcam", "http") or url.startswith("http://") or url.startswith("https://"):
        urls = _normalize_ip_webcam_url(url)
        for try_url in [urls["rtsp_url"], urls["mjpeg_url"], url]:
            cap = _cv2.VideoCapture(try_url, _cv2.CAP_FFMPEG)
            if cap.isOpened():
                logger.info("Person stream: opened %s", try_url)
                break
            cap.release(); cap = None
    elif camera_type == "webcam" or url.startswith("/dev/video"):
        # Use shared device manager — no exclusive-access conflict
        _handle_ps = _v4l2_mgr.subscribe(url)
        if _handle_ps is None:
            logger.warning("Person stream: V4L2 device unavailable: %s", url)
            return
        logger.info("Person stream: subscribed to shared V4L2 device %s", url)
    else:
        cap = _cv2.VideoCapture(url, _cv2.CAP_FFMPEG)

    if _handle_ps is None and (cap is None or not cap.isOpened()):
        logger.warning("Person stream: cannot open %s", url)
        if cap:
            cap.release()
        return

    # ── Frame getter unified API ──────────────────────────────────────────────
    if _handle_ps is not None:
        def _ps_get_frame():
            return _handle_ps["get_frame"]()
        def _ps_release():
            _handle_ps["release"]()
    else:
        cap.set(_cv2.CAP_PROP_BUFFERSIZE, 1)
        _capture_lock_ps = _threading.Lock()
        _stop_ps = _threading.Event()
        _latest_ps: dict[str, Any] = {"frame": None, "sequence": 0, "read_at": _time_mod.monotonic()}

        def _read_ps():
            while not _stop_ps.is_set():
                try:
                    ret, f = cap.read()
                except Exception:
                    _stop_ps.set()
                    return
                if ret and f is not None:
                    with _capture_lock_ps:
                        _latest_ps["frame"] = f
                        _latest_ps["sequence"] += 1
                        _latest_ps["read_at"] = _time_mod.monotonic()
                else:
                    _stop_ps.wait(0.05)

        _t_ps = _threading.Thread(target=_read_ps, daemon=True, name="person-search-capture")
        _t_ps.start()

        def _ps_get_frame():
            with _capture_lock_ps:
                return _latest_ps["frame"]

        def _ps_release():
            _stop_ps.set()
            cap.release()
            _t_ps.join(timeout=1)

    # ── Load models ──────────────────────────────────────────────────────────
    try:
        from app.ai.person import PersonDetector
        from app.ai.tracking import create_byte_tracker, detections_to_supervision
        from app.ai.weights_config import FACE_IN_PERSON_CONF
        p_detector = PersonDetector.load()
        f_detector = None
        recognizer = None
        if query_emb is not None:
            from app.ai.face import FaceDetector
            from app.ai.recognition import FaceRecognizer
            f_detector = FaceDetector.load()
            recognizer = FaceRecognizer.load()

        # OSNet re-ID is disabled in live search — the osnet_final.pt weights are
        # a ResNet50 fallback with 265 missing keys that returns sim≈0.999 for
        # everything, causing every new track to match regardless of appearance.
        # Face-only matching (ArcFace) is used instead.
        reid_model = None
        tracker = create_byte_tracker(frame_rate=10)
        logger.info(
            "Person stream: models loaded person=%s face=%s appearance=disabled(broken weights)",
            p_detector.model_name,
            f_detector.model_name if f_detector else "disabled",
        )
    except Exception as exc:
        logger.error("Person stream: model load failed: %s", exc)
        _ps_release()
        return

    # Track which IDs have been matched (face-only, no OSNet)
    # matched_tids: only tracks currently visible in frame + confirmed by ArcFace
    matched_tids: set[int] = set()       # tracks confirmed by ArcFace this session
    active_tids:  set[int] = set()       # tracks visible in current frame
    frame_count = 0
    last_diagnostic_at = _time_mod.monotonic()
    last_error_at = 0.0
    best_similarity = 0.0
    detected_faces = 0
    INFER_W     = 320    # inference width
    OUTPUT_W    = 640    # output width
    JPEG_Q      = 65
    INFER_EVERY = 2      # run detection every 2nd frame

    # Stricter size thresholds for webcam (stop hands/partial bodies being detected)
    # 60px minimum — matches LIVE_MIN_PERSON_PX; hands are typically <50px wide
    MIN_PERSON_W_STRICT = 60    # px
    MIN_AREA_FRAC       = 0.008  # 0.8% of frame area minimum

    # Use face threshold from config (0.50) rather than the UI slider value
    # The slider is for batch search; live face matching needs to be stricter
    from app.ai.weights_config import LIVE_FACE_THRESHOLD as _LIVE_FACE_THRESH
    effective_face_thresh = max(threshold, _LIVE_FACE_THRESH)

    last_track_items: list = []
    last_scale: float = 1.0
    # face_checked_tids: tracks that failed face match — retry after RECHECK_AFTER frames
    face_checked_tids: dict[int, int] = {}   # tid → frame_count when first failed
    RECHECK_AFTER = 30  # re-attempt face match after 30 frames (~1–2 seconds)

    try:
        while True:
            frame = _ps_get_frame()
            if frame is None:
                _time_mod.sleep(0.01)
                continue
            frame_count += 1
            h, w = frame.shape[:2]

            run_infer = (frame_count % INFER_EVERY == 1)

            if run_infer:
                infer_w = min(w, INFER_W)
                scale   = infer_w / w
                proc    = _cv2.resize(frame, (infer_w, int(h * scale))) if scale < 1.0 else frame

                gray   = _cv2.resize(proc, (40, 30))
                gray   = _cv2.cvtColor(gray, _cv2.COLOR_BGR2GRAY)
                bright = float(_np.mean(gray))

                track_items_new: list = []
                current_tids: set[int] = set()
                detection_failed = False
                face_check_failed = False

                if bright > 30.0:
                    try:
                        persons = p_detector.detect(proc, confidence_threshold=live_conf)
                        sv_dets = detections_to_supervision(persons)
                        tracked = tracker.update_with_detections(sv_dets)
                    except Exception as exc:
                        tracked = None
                        detection_failed = True
                        if _time_mod.monotonic() - last_error_at >= 10:
                            logger.warning("Person stream: detection failed: %s", exc)
                            last_error_at = _time_mod.monotonic()

                    if tracked is not None and len(tracked) > 0:
                        track_ids = tracked.tracker_id
                        for i in range(len(tracked)):
                            try:
                                bbox = tracked.xyxy[i]
                            except (TypeError, IndexError):
                                continue
                            tid    = int(track_ids[i]) if track_ids is not None and i < len(track_ids) else i
                            conf_v = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0

                            # Strict size filter — reject hands, partial bodies
                            x1r = max(0, int(bbox[0] / scale))
                            y1r = max(0, int(bbox[1] / scale))
                            x2r = min(w, int(bbox[2] / scale))
                            y2r = min(h, int(bbox[3] / scale))
                            bw, bh = x2r - x1r, y2r - y1r
                            if bw < MIN_PERSON_W_STRICT or bh < MIN_PERSON_W_STRICT * 1.8:
                                continue
                            if (bw * bh) < (w * h * MIN_AREA_FRAC):
                                continue
                            # Reject if significantly wider than tall — hands/horizontal objects
                            if bw > bh * 1.2:
                                continue

                            track_items_new.append((bbox, tid, conf_v))
                            current_tids.add(tid)

                    # Remove matched tids that are no longer visible in frame
                    # This prevents stale matches from accumulating
                    matched_tids.intersection_update(current_tids)
                    active_tids = current_tids

                    # Face matching — retry after RECHECK_AFTER frames if previously failed
                    for bbox, tid, _ in track_items_new:
                        if tid in matched_tids:
                            continue
                        # Skip if checked recently — but retry after RECHECK_AFTER frames
                        if tid in face_checked_tids:
                            if frame_count - face_checked_tids[tid] < RECHECK_AFTER:
                                continue
                            # Time to retry — remove from cooldown
                            del face_checked_tids[tid]

                        if query_emb is None or f_detector is None or recognizer is None:
                            continue

                        x1 = max(0, int(bbox[0] / scale))
                        y1 = max(0, int(bbox[1] / scale))
                        x2 = min(w, int(bbox[2] / scale))
                        y2 = min(h, int(bbox[3] / scale))
                        person_crop = frame[y1:y2, x1:x2]
                        if person_crop.size == 0:
                            continue

                        try:
                            faces = f_detector.detect_in_crop(
                                person_crop, confidence_threshold=FACE_IN_PERSON_CONF
                            )
                            if faces:
                                detected_faces += 1
                                best_face = max(faces, key=lambda f: f.confidence)
                                if best_face.width >= MIN_FACE_PX and best_face.height >= MIN_FACE_PX:
                                    face_emb = recognizer.get_embedding_from_crop(
                                        best_face.crop(person_crop)
                                    )
                                    if face_emb is not None:
                                        sim = float(_np.dot(query_emb, face_emb))
                                        best_similarity = max(best_similarity, sim)
                                        if sim >= effective_face_thresh:
                                            matched_tids.add(tid)
                                            logger.info(
                                                "Person stream: FACE MATCH tid=%d sim=%.3f (thresh=%.2f)",
                                                tid, sim, effective_face_thresh,
                                            )
                                        else:
                                            # Put on cooldown — retry after RECHECK_AFTER frames
                                            face_checked_tids[tid] = frame_count
                        except Exception as exc:
                            face_check_failed = True
                            if _time_mod.monotonic() - last_error_at >= 10:
                                logger.warning("Person stream: face matching failed: %s", exc)
                                last_error_at = _time_mod.monotonic()

                # Cache for skipped frames
                last_track_items = track_items_new
                last_scale = scale
            else:
                track_items_new = last_track_items
                scale = last_scale
                bright = 100.0
                detection_failed = False
                face_check_failed = False

            # ── Annotate ─────────────────────────────────────────────────────
            annotated = frame.copy()
            for bbox, tid, detection_confidence in track_items_new:
                x1 = max(0, int(bbox[0] / scale))
                y1 = max(0, int(bbox[1] / scale))
                x2 = min(w, int(bbox[2] / scale))
                y2 = min(h, int(bbox[3] / scale))
                bw, bh = x2 - x1, y2 - y1
                if bw < MIN_PERSON_W_STRICT or bh < MIN_PERSON_W_STRICT * 1.8:
                    continue
                if (bw * bh) < (w * h * MIN_AREA_FRAC):
                    continue

                is_match = tid in matched_tids

                if focus_mode and not is_match:
                    continue

                color     = MATCH_COLOR if is_match else OTHER_COLOR
                thickness = 3 if is_match else 1
                _cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)
                label   = f"FOUND ID:{tid}" if is_match else f"ID:{tid}"
                label_y = max(y1 - 4, 14)
                _cv2.putText(annotated, label, (x1 + 3, label_y), FONT,
                             0.45 if is_match else 0.38,
                             (0, 220, 0) if is_match else (100, 100, 100),
                             1, _cv2.LINE_AA)

            # Status badge
            if matched_tids:
                status_txt = f"TARGET FOUND — face matched"
            elif bright <= 30.0:
                status_txt = "LOW LIGHT"
            elif not track_items_new:
                status_txt = "NO PERSON DETECTED"
            else:
                status_txt = f"SEARCHING face… best={best_similarity:.2f}/{effective_face_thresh:.2f}"

            status_color = MATCH_COLOR if matched_tids else (0, 180, 255)
            _cv2.putText(annotated, "AVSS LIVE SEARCH", (8, 20), FONT, 0.45, (0, 0, 180), 2, _cv2.LINE_AA)
            _cv2.putText(annotated, "AVSS LIVE SEARCH", (8, 20), FONT, 0.45, (255, 255, 255), 1, _cv2.LINE_AA)
            _cv2.putText(annotated, status_txt, (8, 38), FONT, 0.4, status_color, 1, _cv2.LINE_AA)

            now = _time_mod.monotonic()
            if now - last_diagnostic_at >= 5:
                logger.info(
                    "Person stream: frames=%d face_sim=%.3f matches=%d (thresh=%.2f)",
                    frame_count, best_similarity, len(matched_tids), effective_face_thresh,
                )
                last_diagnostic_at = now

            if w > OUTPUT_W:
                annotated = _cv2.resize(annotated, (OUTPUT_W, int(h * OUTPUT_W / w)))

            ok, buf = _cv2.imencode(".jpg", annotated, [_cv2.IMWRITE_JPEG_QUALITY, JPEG_Q])
            if not ok:
                continue
            data = buf.tobytes()
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                b"\r\n" + data + b"\r\n"
            )

    except GeneratorExit:
        logger.info("Person stream client disconnected")
    finally:
        _ps_release()
        logger.info("Person stream closed (matched %d unique IDs)", len(matched_tids))


# ── Query token registry ──────────────────────────────────────────────────────
# Stores optional face and appearance embeddings in-memory keyed by a short token.
# Token expires after 30 minutes.

import uuid as _uuid
import time as _timem

_QUERY_STORE: dict[str, dict] = {}   # token → {emb, threshold, conf, expires_at}
_TOKEN_TTL   = 30 * 60               # 30 minutes


def _clean_expired_tokens():
    now = _timem.time()
    expired = [k for k, v in _QUERY_STORE.items() if v["expires_at"] < now]
    for k in expired:
        del _QUERY_STORE[k]


@router.post(
    "/cameras/{camera_id}/query/register",
    summary="Register a query face or person photo and get a stream token",
    tags=["Cameras"],
)
async def register_query(
    camera_id:            int,
    query_image:          _UploadFile = _File(...),
    similarity_threshold: float       = _Form(default=0.45, ge=0.1, le=0.9),
    conf:                 float       = _Form(default=0.35, ge=0.1, le=0.9),
    appearance_threshold: float       = _Form(default=0.65, ge=0.1, le=0.99),
    focus_mode:           bool        = _Form(default=False),
    db=Depends(get_db),
    _user=Depends(get_user_from_token),
):
    """
    POST a face or full-person photo → receive a short-lived stream_token.
    Then open:  GET /cameras/{id}/stream/person?token=<stream_token>
    Token is valid for 30 minutes.
    """
    import cv2 as _cv2_r
    import numpy as _np_r

    _clean_expired_tokens()

    from app.models.camera import Camera as CameraModel
    cam = db.query(CameraModel).filter(CameraModel.id == camera_id).first()
    if not cam:
        raise _HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    img_bytes = await query_image.read()
    nparr     = _np_r.frombuffer(img_bytes, _np_r.uint8)
    qimg      = _cv2_r.imdecode(nparr, _cv2_r.IMREAD_COLOR)
    if qimg is None:
        raise _HTTPException(status_code=400, detail="Cannot decode image.")

    emb = None
    try:
        from app.ai.recognition import FaceRecognizer
        rec = FaceRecognizer.load()
        emb = rec.get_embedding(qimg)
    except Exception as exc:
        logger.warning("Could not create query face embedding; trying appearance only: %s", exc)

    body_emb = None
    try:
        from app.ai.person import PersonDetector
        from app.ai.reid import OSNET_WEIGHTS, PersonReID

        if OSNET_WEIGHTS.exists():
            query_persons = PersonDetector.load().detect(qimg, confidence_threshold=0.25)
            if query_persons:
                query_person = max(
                    query_persons,
                    key=lambda person: person.width * person.height,
                )
                body_crop = query_person.crop(qimg)
                body_emb = PersonReID.load().get_embedding(body_crop)
        else:
            logger.warning("OSNet weights unavailable; live search will use face matching only")
    except Exception as exc:
        logger.warning("Could not create query appearance embedding; using face only: %s", exc)

    if emb is None and body_emb is None:
        raise _HTTPException(
            status_code=422,
            detail=(
                "No usable face or full-person image was found. Upload a clear face photo "
                "or a full-body photo with the person visible."
            ),
        )

    token = _uuid.uuid4().hex
    _QUERY_STORE[token] = {
        "camera_id":  camera_id,
        "emb":        emb,
        "body_emb":   body_emb,
        "threshold":  similarity_threshold,
        "conf":       conf,
        "appearance_threshold": appearance_threshold,
        "focus_mode": focus_mode,
        "expires_at": _timem.time() + _TOKEN_TTL,
    }
    logger.info(
        "Query registered: camera=%d token=%s face=%s appearance=%s",
        camera_id, token[:8], emb is not None, body_emb is not None,
    )

    return {
        "stream_token":  token,
        "expires_in_sec": _TOKEN_TTL,
        "appearance_ready": body_emb is not None,
        "face_ready": emb is not None,
        "stream_url": f"/api/v1/cameras/{camera_id}/stream/person?token={token}",
    }


@router.get(
    "/cameras/{camera_id}/stream/person",
    summary="Live MJPEG stream — only the queried person highlighted (use token from /query/register)",
    tags=["Cameras"],
)
def stream_person_by_token(
    camera_id: int,
    token:     str,
    db=Depends(get_db),
):
    """
    GET endpoint for person-specific live stream.
    Requires a token from POST /cameras/{id}/query/register.
    Streams MJPEG: matched person = GREEN box, others = grey.
    """
    _clean_expired_tokens()

    entry = _QUERY_STORE.get(token)
    if not entry:
        raise _HTTPException(status_code=404, detail="Token not found or expired. Re-upload the query photo.")
    if entry["camera_id"] != camera_id:
        raise _HTTPException(status_code=403, detail="Token does not match this camera.")

    from app.models.camera import Camera as CameraModel
    cam = db.query(CameraModel).filter(CameraModel.id == camera_id).first()
    if not cam:
        raise _HTTPException(status_code=404, detail=f"Camera id={camera_id} not found.")

    import numpy as _np_s
    emb       = _np_s.array(entry["emb"], dtype=_np_s.float32) if entry["emb"] is not None else None
    body_emb  = _np_s.array(entry["body_emb"], dtype=_np_s.float32) if entry["body_emb"] is not None else None
    threshold = entry["threshold"]
    conf      = entry["conf"]
    appearance_threshold = entry["appearance_threshold"]
    focus_mode = entry.get("focus_mode", False)

    logger.info(
        "Person stream via token: camera=%d face_threshold=%.2f appearance_threshold=%.2f person_conf=%.2f focus=%s",
        camera_id, threshold, appearance_threshold, conf, focus_mode,
    )

    return StreamingResponse(
        _person_search_stream(
            cam.url, cam.camera_type, emb, threshold, conf, body_emb, appearance_threshold,
            focus_mode=focus_mode,
        ),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control":     "no-cache, no-store, must-revalidate",
            "Pragma":            "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
