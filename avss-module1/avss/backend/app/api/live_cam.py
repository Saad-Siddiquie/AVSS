"""
AVSS Live Camera Control API — start/stop/status for the Pixel 7 via scrcpy.

Endpoints:
  GET  /cameras/live-cam/status   → phone connected? scrcpy running? V4L2 ready?
  POST /cameras/live-cam/start    → check ADB → start scrcpy → wait for /dev/video9
  POST /cameras/live-cam/stop     → kill scrcpy process

All endpoints require a valid JWT (get_user_from_token).
"""
import logging
import os
import signal
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_user_from_token
from app.core.database import get_db
from app.ai.live_cam_config import (
    SCRCPY_BIN, SCRCPY_DIR, SCRCPY_START_TIMEOUT, ADB_CHECK_TIMEOUT,
    V4L2_DEVICE, CAMERA_ID, CAMERA_NAME,
    CAMERA_WIDTH, CAMERA_HEIGHT, CAMERA_FPS,
    get_scrcpy_command, get_manual_command_str,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Live Camera Control"])

# ── scrcpy process management (module-level, thread-safe) ──────────────────
_scrcpy_process: Optional[subprocess.Popen] = None
_scrcpy_lock = threading.Lock()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _check_adb() -> dict:
    """
    Check if an Android device is connected via ADB.
    Returns dict with adb_available, device_connected, devices[], error.
    """
    try:
        result = subprocess.run(
            ["adb", "devices", "-l"],
            capture_output=True, text=True, timeout=ADB_CHECK_TIMEOUT,
        )
        lines = result.stdout.strip().split("\n")
        devices = []
        for line in lines[1:]:  # skip "List of devices attached"
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "device":
                model = "unknown"
                for p in parts[2:]:
                    if p.startswith("model:"):
                        model = p.split(":", 1)[1]
                devices.append({"serial": parts[0], "model": model})

        unauthorized = any(
            p[1] == "unauthorized"
            for line in lines[1:]
            for p in [line.strip().split()]
            if len(p) >= 2
        )

        return {
            "adb_available": True,
            "device_connected": len(devices) > 0,
            "devices": devices,
            "unauthorized": unauthorized,
        }
    except FileNotFoundError:
        return {
            "adb_available": False,
            "device_connected": False,
            "devices": [],
            "error": "ADB not found. Install Android platform tools: sudo apt install adb",
        }
    except subprocess.TimeoutExpired:
        return {
            "adb_available": True,
            "device_connected": False,
            "devices": [],
            "error": "ADB timed out — daemon may be starting. Try again.",
        }
    except Exception as exc:
        return {
            "adb_available": False,
            "device_connected": False,
            "devices": [],
            "error": str(exc),
        }


def _check_v4l2_device() -> bool:
    """
    Check if the V4L2 device exists and can produce a frame.
    Uses a quick path existence check first to avoid spamming V4L2 warnings
    when scrcpy isn't running yet.
    """
    import cv2
    # Fast check — device node must exist before we try to open it
    if not Path(V4L2_DEVICE).exists():
        return False
    # Try to open and read one frame; suppress OpenCV log noise
    prev_level = cv2.getLogLevel()
    cv2.setLogLevel(0)
    try:
        cap = cv2.VideoCapture(V4L2_DEVICE, cv2.CAP_V4L2)
        try:
            if not cap.isOpened():
                return False
            ret, frame = cap.read()
            return ret and frame is not None
        finally:
            cap.release()
    finally:
        cv2.setLogLevel(prev_level)


def _scrcpy_is_running() -> bool:
    """Check if the managed scrcpy process is still alive."""
    with _scrcpy_lock:
        return _scrcpy_process is not None and _scrcpy_process.poll() is None


def _kill_scrcpy() -> None:
    """Kill the scrcpy process group cleanly."""
    global _scrcpy_process
    with _scrcpy_lock:
        proc = _scrcpy_process
        if proc is None or proc.poll() is not None:
            _scrcpy_process = None
            return
        _scrcpy_process = None   # clear the reference before waiting

    # Terminate outside the lock so other threads can check state
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            proc.wait(timeout=2)
        except Exception:
            pass
    except (ProcessLookupError, OSError):
        pass


# ── Response models ──────────────────────────────────────────────────────────

class LiveCamStatus(BaseModel):
    phone_connected: bool
    phone_model: Optional[str] = None
    adb_available: bool
    adb_error: Optional[str] = None
    unauthorized: bool = False
    scrcpy_running: bool
    v4l2_device: str
    v4l2_ready: bool
    resolution: str
    fps: int
    camera_id: str
    camera_name: str
    scrcpy_path: str
    scrcpy_exists: bool
    manual_command: str
    camera_db_id: Optional[int] = None   # DB id when camera is registered


class LiveCamActionResponse(BaseModel):
    status: str   # started | already_running | stopped | not_running | error
    message: str
    v4l2_device: Optional[str] = None
    phone_model: Optional[str] = None
    manual_command: Optional[str] = None
    camera_db_id: Optional[int] = None   # DB id of the auto-registered camera record


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get(
    "/cameras/live-cam/status",
    response_model=LiveCamStatus,
    summary="Check Pixel 7 USB camera status (phone, scrcpy, V4L2 device)",
)
def live_cam_status(
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    """
    Returns the full status of the live camera pipeline:
      - Phone connected via ADB?
      - scrcpy process running?
      - V4L2 device (/dev/video9) ready?
      - camera_db_id when registered
    """
    from app.models.camera import Camera as CameraModel
    adb = _check_adb()
    v4l2_ready = _check_v4l2_device()

    # Look up the registered camera DB id if it exists
    cam_db_id: Optional[int] = None
    existing = db.query(CameraModel).filter(CameraModel.url == V4L2_DEVICE).first()
    if existing:
        cam_db_id = existing.id

    return LiveCamStatus(
        phone_connected=adb["device_connected"],
        phone_model=adb["devices"][0]["model"] if adb["devices"] else None,
        adb_available=adb["adb_available"],
        adb_error=adb.get("error"),
        unauthorized=adb.get("unauthorized", False),
        scrcpy_running=_scrcpy_is_running(),
        v4l2_device=V4L2_DEVICE,
        v4l2_ready=v4l2_ready,
        resolution=f"{CAMERA_WIDTH}x{CAMERA_HEIGHT}",
        fps=CAMERA_FPS,
        camera_id=CAMERA_ID,
        camera_name=CAMERA_NAME,
        scrcpy_path=SCRCPY_BIN,
        scrcpy_exists=Path(SCRCPY_BIN).exists(),
        manual_command=get_manual_command_str(),
        camera_db_id=cam_db_id,
    )


@router.post(
    "/cameras/live-cam/start",
    response_model=LiveCamActionResponse,
    summary="Start the Pixel 7 live camera via scrcpy",
)
def live_cam_start(
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    """
    Starts scrcpy to stream the Pixel 7 camera to /dev/video9.
    Also auto-registers the camera in the DB (or reuses existing record)
    so the main Live viewer can open it directly.
    """
    global _scrcpy_process

    def _ensure_camera_registered(db: Session) -> int:
        """
        Find or create the Pixel 7 camera record in the DB.
        Returns the camera DB id.
        """
        from app.models.camera import Camera as CameraModel
        existing = (
            db.query(CameraModel)
            .filter(CameraModel.url == V4L2_DEVICE)
            .first()
        )
        if existing:
            # Make sure it's active
            if existing.status != "active":
                existing.status = "active"
                db.commit()
            return existing.id

        cam = CameraModel(
            name=CAMERA_NAME,
            url=V4L2_DEVICE,
            camera_type="webcam",
            location="USB (Pixel 7)",
            description="Auto-registered by AVSS live camera control",
            status="active",
            is_active=True,
        )
        db.add(cam)
        db.commit()
        db.refresh(cam)
        logger.info("Auto-registered Pixel 7 camera: id=%d url=%s", cam.id, V4L2_DEVICE)
        return cam.id

    # 1. Check if V4L2 device is already active (scrcpy might be running manually)
    if _check_v4l2_device():
        with _scrcpy_lock:
            if _scrcpy_process is None or _scrcpy_process.poll() is not None:
                _scrcpy_process = None  # someone started it manually
        cam_id = _ensure_camera_registered(db)
        return LiveCamActionResponse(
            status="already_running",
            message=f"V4L2 device {V4L2_DEVICE} is already active.",
            v4l2_device=V4L2_DEVICE,
            camera_db_id=cam_id,
        )

    # 2. Check ADB
    adb = _check_adb()
    if not adb["adb_available"]:
        raise HTTPException(
            status_code=400,
            detail=f"ADB not found. Install Android platform tools: sudo apt install adb",
        )
    if adb.get("unauthorized"):
        raise HTTPException(
            status_code=400,
            detail="Phone connected but USB debugging is not authorised. Unlock your phone and tap 'Allow USB debugging'.",
        )
    if not adb["device_connected"]:
        raise HTTPException(
            status_code=400,
            detail="No Android device detected. Connect your Pixel 7 via USB cable and enable USB debugging in Developer Options.",
        )

    phone_model = adb["devices"][0]["model"] if adb["devices"] else None

    # 3. Check scrcpy binary
    if not Path(SCRCPY_BIN).exists():
        raise HTTPException(
            status_code=400,
            detail=f"scrcpy not found at {SCRCPY_BIN}. Set AVSS_SCRCPY_DIR or install scrcpy.",
        )

    # 4. Kill any stale scrcpy we might have
    with _scrcpy_lock:
        if _scrcpy_process is not None and _scrcpy_process.poll() is not None:
            _scrcpy_process = None

    # 5. Start scrcpy
    cmd = get_scrcpy_command()
    logger.info("Starting scrcpy: %s", " ".join(cmd))

    with _scrcpy_lock:
        if _scrcpy_process is not None and _scrcpy_process.poll() is None:
            return LiveCamActionResponse(
                status="already_running",
                message="scrcpy is already running.",
                v4l2_device=V4L2_DEVICE,
                phone_model=phone_model,
            )

        try:
            _scrcpy_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=SCRCPY_DIR,
                preexec_fn=os.setsid,  # new process group for clean kill
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to start scrcpy: {exc}",
            )

    # 6. Wait for V4L2 device to become available
    deadline = time.time() + SCRCPY_START_TIMEOUT
    while time.time() < deadline:
        # Check if scrcpy exited early
        with _scrcpy_lock:
            proc = _scrcpy_process
        if proc is not None and proc.poll() is not None:
            stderr = ""
            try:
                stderr = proc.stderr.read().decode("utf-8", errors="replace")[:500] if proc.stderr else ""
            except Exception:
                pass
            with _scrcpy_lock:
                _scrcpy_process = None
            raise HTTPException(
                status_code=400,
                detail=f"scrcpy exited immediately. stderr: {stderr}",
            )

        if _check_v4l2_device():
            cam_id = _ensure_camera_registered(db)
            logger.info("Live camera started: %s (%s)", V4L2_DEVICE, phone_model or "unknown")
            return LiveCamActionResponse(
                status="started",
                message=f"Live camera started — {V4L2_DEVICE} is active.",
                v4l2_device=V4L2_DEVICE,
                phone_model=phone_model,
                manual_command=get_manual_command_str(),
                camera_db_id=cam_id,
            )

        time.sleep(0.5)

    # 7. Timeout — V4L2 device never appeared
    raise HTTPException(
        status_code=400,
        detail=(
            f"V4L2 device {V4L2_DEVICE} not available after {SCRCPY_START_TIMEOUT}s. "
            f"Check that the v4l2loopback module is loaded: sudo modprobe v4l2loopback"
        ),
    )


@router.post(
    "/cameras/live-cam/stop",
    response_model=LiveCamActionResponse,
    summary="Stop the Pixel 7 live camera (kill scrcpy)",
)
def live_cam_stop(
    _user=Depends(get_user_from_token),
):
    """Kill the scrcpy process and release the V4L2 device."""
    global _scrcpy_process

    with _scrcpy_lock:
        proc = _scrcpy_process
        if proc is None or proc.poll() is not None:
            _scrcpy_process = None
            return LiveCamActionResponse(
                status="not_running",
                message="scrcpy is not running.",
            )

    # Kill outside the lock so _kill_scrcpy can safely acquire it
    _kill_scrcpy()

    logger.info("Live camera stopped.")
    return LiveCamActionResponse(
        status="stopped",
        message="Live camera stopped. V4L2 device released.",
        v4l2_device=V4L2_DEVICE,
    )


# ── Direct MJPEG stream from /dev/video9 (no auth — for <img> tags) ──────────

@router.get(
    "/cameras/live-cam/stream",
    summary="MJPEG preview stream directly from the Pixel 7 V4L2 device",
    tags=["Live Camera Control"],
)
def live_cam_stream():
    """
    Direct MJPEG stream from /dev/video9.
    No auth required (browsers cannot send Authorization headers with <img> tags).
    Used by the Live Cam preview in the dashboard.
    """
    import cv2 as _cv2
    import time as _time

    def _generate():
        import threading as _t
        cap = _cv2.VideoCapture(V4L2_DEVICE, _cv2.CAP_V4L2)
        if not cap.isOpened():
            logger.warning("Live cam stream: cannot open %s", V4L2_DEVICE)
            return
        cap.set(_cv2.CAP_PROP_BUFFERSIZE, 1)

        # Dedicated capture thread keeps latest frame; inference/encode doesn't block capture
        _latest: dict = {"frame": None}
        _stop   = _t.Event()

        def _read():
            while not _stop.is_set():
                ret, f = cap.read()
                if ret and f is not None:
                    _latest["frame"] = f
                else:
                    _time.sleep(0.005)

        reader = _t.Thread(target=_read, daemon=True)
        reader.start()

        try:
            while True:
                frame = _latest.get("frame")
                if frame is None:
                    _time.sleep(0.01)
                    continue

                h, w = frame.shape[:2]
                if w > 640:
                    frame = _cv2.resize(frame, (640, int(h * 640 / w)))

                ok, buf = _cv2.imencode(
                    ".jpg", frame,
                    [_cv2.IMWRITE_JPEG_QUALITY, 65],
                )
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
            logger.info("Live cam stream: client disconnected")
        finally:
            _stop.set()
            reader.join(timeout=1)
            cap.release()
            logger.info("Live cam stream: closed")

    return StreamingResponse(
        _generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Laptop webcam endpoints ───────────────────────────────────────────────────

LAPTOP_CAM_DEVICE = os.environ.get("AVSS_LAPTOP_CAM_DEVICE", "/dev/video0")
LAPTOP_CAM_W      = int(os.environ.get("AVSS_LAPTOP_CAM_WIDTH",  "640"))
LAPTOP_CAM_H      = int(os.environ.get("AVSS_LAPTOP_CAM_HEIGHT", "480"))
LAPTOP_CAM_FPS    = int(os.environ.get("AVSS_LAPTOP_CAM_FPS",    "30"))
LAPTOP_CAM_NAME   = "Laptop Webcam (HP HD Camera)"
LAPTOP_CAM_ID     = "laptop_webcam_01"


def _check_laptop_cam() -> bool:
    """Quick check: device node exists."""
    return Path(LAPTOP_CAM_DEVICE).exists()


def _ensure_laptop_cam_registered(db: Session) -> int:
    """Find or create the laptop webcam camera record. Returns DB id."""
    from app.models.camera import Camera as CameraModel
    existing = db.query(CameraModel).filter(CameraModel.url == LAPTOP_CAM_DEVICE).first()
    if existing:
        if existing.status != "active":
            existing.status = "active"
            db.commit()
        return existing.id
    cam = CameraModel(
        name=LAPTOP_CAM_NAME,
        url=LAPTOP_CAM_DEVICE,
        camera_type="webcam",
        location="Laptop built-in",
        description="HP HD Camera — auto-registered by AVSS",
        status="active",
        is_active=True,
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    logger.info("Auto-registered laptop webcam: id=%d url=%s", cam.id, LAPTOP_CAM_DEVICE)
    return cam.id


class LaptopCamResponse(BaseModel):
    status: str
    message: str
    device: str
    camera_db_id: Optional[int] = None
    resolution: str = ""
    fps: int = 0
    available: bool = False


@router.get(
    "/cameras/laptop-cam/status",
    response_model=LaptopCamResponse,
    summary="Check if the laptop built-in webcam is available",
    tags=["Live Camera Control"],
)
def laptop_cam_status(
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    """Returns whether /dev/video0 (HP HD Camera) exists and is registered."""
    from app.models.camera import Camera as CameraModel
    available = _check_laptop_cam()
    cam_db_id: Optional[int] = None
    existing = db.query(CameraModel).filter(CameraModel.url == LAPTOP_CAM_DEVICE).first()
    if existing:
        cam_db_id = existing.id
    return LaptopCamResponse(
        status="available" if available else "unavailable",
        message=f"{LAPTOP_CAM_NAME} {'ready' if available else 'not found'} at {LAPTOP_CAM_DEVICE}",
        device=LAPTOP_CAM_DEVICE,
        camera_db_id=cam_db_id,
        resolution=f"{LAPTOP_CAM_W}x{LAPTOP_CAM_H}",
        fps=LAPTOP_CAM_FPS,
        available=available,
    )


@router.post(
    "/cameras/laptop-cam/start",
    response_model=LaptopCamResponse,
    summary="Register and open the laptop built-in webcam",
    tags=["Live Camera Control"],
)
def laptop_cam_start(
    db: Session = Depends(get_db),
    _user=Depends(get_user_from_token),
):
    """
    Checks /dev/video0 is accessible, registers it in the DB if needed,
    and returns the camera_db_id so the frontend can open it in the main viewer.
    No external process needed — the laptop webcam is always available.
    """
    if not _check_laptop_cam():
        raise HTTPException(
            status_code=400,
            detail=f"Laptop webcam not found at {LAPTOP_CAM_DEVICE}. "
                   "Check that the camera is connected and not in use by another application.",
        )
    cam_db_id = _ensure_laptop_cam_registered(db)
    logger.info("Laptop webcam opened: id=%d device=%s", cam_db_id, LAPTOP_CAM_DEVICE)
    return LaptopCamResponse(
        status="started",
        message=f"Laptop webcam ready — {LAPTOP_CAM_W}x{LAPTOP_CAM_H} @ {LAPTOP_CAM_FPS}fps",
        device=LAPTOP_CAM_DEVICE,
        camera_db_id=cam_db_id,
        resolution=f"{LAPTOP_CAM_W}x{LAPTOP_CAM_H}",
        fps=LAPTOP_CAM_FPS,
        available=True,
    )
