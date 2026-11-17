"""
AVSS Live Camera Configuration — Pixel 7 via scrcpy (USB → V4L2).

All settings are overridable via environment variables so the same config
works on different machines without editing code.

Override examples:
    AVSS_SCRCPY_DIR=~/Downloads/scrcpy-linux-x86_64-v5.0.1
    AVSS_V4L2_DEVICE=/dev/video9
    AVSS_CAM_WIDTH=1280
    AVSS_CAM_HEIGHT=720
    AVSS_CAM_FPS=30
"""
import os
import logging

logger = logging.getLogger(__name__)

# ── scrcpy binary ───────────────────────────────────────────────────────────
SCRCPY_DIR = os.environ.get(
    "AVSS_SCRCPY_DIR",
    os.path.expanduser("~/Downloads/scrcpy-linux-x86_64-v5.0.1"),
)
SCRCPY_BIN = os.path.join(SCRCPY_DIR, "scrcpy")

# ── V4L2 virtual camera device ───────────────────────────────────────────────
V4L2_DEVICE = os.environ.get("AVSS_V4L2_DEVICE", "/dev/video9")

# ── Camera identity ──────────────────────────────────────────────────────────
CAMERA_ID   = os.environ.get("AVSS_CAMERA_ID",   "pixel7_usb_cam_01")
CAMERA_NAME = os.environ.get("AVSS_CAMERA_NAME", "Pixel 7 USB Camera")

# ── Camera resolution & FPS ──────────────────────────────────────────────────
CAMERA_WIDTH  = int(os.environ.get("AVSS_CAM_WIDTH",  "1280"))
CAMERA_HEIGHT = int(os.environ.get("AVSS_CAM_HEIGHT", "720"))
CAMERA_FPS    = int(os.environ.get("AVSS_CAM_FPS",    "30"))
CAMERA_FACING = os.environ.get("AVSS_CAM_FACING",     "back")

# ── Timeouts (seconds) ──────────────────────────────────────────────────────
SCRCPY_START_TIMEOUT = 10   # wait for /dev/video9 after starting scrcpy
ADB_CHECK_TIMEOUT    = 5    # ADB device check timeout


def get_scrcpy_command() -> list[str]:
    """
    Build the scrcpy command with current configuration.

    This is the exact command that gets run when the user clicks
    "Start Live Cam" in the dashboard.  It can also be run manually
    in a terminal for debugging:

        cd ~/Downloads/scrcpy-linux-x86_64-v5.0.1
        ./scrcpy \
          --video-source=camera \
          --camera-facing=back \
          --camera-size=1280x720 \
          --camera-fps=30 \
          --v4l2-sink=/dev/video9 \
          --no-playback \
          --no-audio
    """
    return [
        SCRCPY_BIN,
        "--video-source=camera",
        f"--camera-facing={CAMERA_FACING}",
        f"--camera-size={CAMERA_WIDTH}x{CAMERA_HEIGHT}",
        f"--camera-fps={CAMERA_FPS}",
        f"--v4l2-sink={V4L2_DEVICE}",
        "--no-playback",
        "--no-audio",
    ]


def get_manual_command_str() -> str:
    """Return the scrcpy command as a human-readable string for display."""
    cmd = get_scrcpy_command()
    return f"cd {SCRCPY_DIR}\n" + " ".join(cmd)
