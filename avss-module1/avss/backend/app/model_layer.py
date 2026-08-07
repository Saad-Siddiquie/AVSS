"""
model_layer.py — AVSS Model Abstraction Layer
------------------------------------------------
Purpose: swap between pretrained models (for prototyping) and your own
trained models (final submission) by changing ONE config value, without
touching FastAPI routes, database logic, or the dashboard.

Usage:
    from app.model_layer import get_detector, get_face_model, get_cloth_model

    detector    = get_detector()     # PersonDetector (YOLOv8)
    face_model  = get_face_model()   # FaceModelWrapper (InsightFace or custom ArcFace)
    cloth_model = get_cloth_model()  # ClothModelWrapper (OSNet or custom classifier)

Switch everything to your own trained weights by:
  1. Editing MODEL_CONFIG below, OR
  2. Setting environment variables at runtime:
       AVSS_USE_PRETRAINED_DETECTOR=false
       AVSS_USE_PRETRAINED_FACE=false
       AVSS_USE_PRETRAINED_CLOTH=false

Compatible with:
  - Python 3.12
  - ultralytics==8.2.103    (YOLOv8 person + face detection)
  - insightface==0.7.3      (ArcFace face recognition, buffalo_l)
  - onnxruntime==1.19.2     (InsightFace inference backend)
  - opencv-python==4.10.0.84
  - numpy==1.26.4
  - faiss-cpu==1.8.0        (similarity search, Module 10)

OSNet (clothing re-id) requires torchreid. Install separately if needed:
  pip install torchreid
"""

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger("avss.model_layer")

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
WEIGHTS_DIR = Path(__file__).parent.parent / "weights"
WEIGHTS_DIR.mkdir(exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# 1. CONFIG — edit this block OR use env vars to flip modes
# ─────────────────────────────────────────────────────────────────────────────

def _env_bool(name: str, default: bool) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes")


def _env_str(name: str, default: str) -> str:
    return os.environ.get(name, default)


@dataclass
class ModelConfig:
    # ── Person Detector (Module 6) ──────────────────────────────────────────
    # Pretrained: YOLOv8n (downloaded automatically by ultralytics on first use)
    # Custom:     your own .pt file trained on your dataset
    use_pretrained_detector: bool = True
    pretrained_detector_weights: str = "yolov8n.pt"        # auto-downloaded (~6 MB)
    custom_detector_weights: str = str(WEIGHTS_DIR / "avss_detector.pt")
    detector_confidence: float = 0.40

    # ── Face Recognition (Module 8) ─────────────────────────────────────────
    # Pretrained: InsightFace buffalo_l (downloaded to ~/.insightface on first use)
    # Custom:     your own ArcFace .onnx or .pth file
    use_pretrained_face: bool = True
    pretrained_face_model: str = "buffalo_l"                # InsightFace model name
    custom_face_weights: str = str(WEIGHTS_DIR / "avss_arcface.onnx")
    face_embedding_dim: int = 512
    face_confidence: float = 0.50

    # ── Clothing / Re-ID (Module 11 — OSNet) ────────────────────────────────
    # Pretrained: OSNet x1.0 (requires torchreid, see install note above)
    # Custom:     your own re-id / attribute classifier weights
    use_pretrained_cloth: bool = True
    pretrained_cloth_model: str = "osnet_x1_0"
    custom_cloth_weights: str = str(WEIGHTS_DIR / "avss_reid.pth")
    cloth_num_attributes: int = 26                          # only used for custom attribute net

    # ── Inference device ────────────────────────────────────────────────────
    # "cpu" always works. Set to "cuda" if you have an NVIDIA GPU.
    device: str = "cpu"


MODEL_CONFIG = ModelConfig(
    use_pretrained_detector=_env_bool("AVSS_USE_PRETRAINED_DETECTOR", True),
    use_pretrained_face=_env_bool("AVSS_USE_PRETRAINED_FACE", True),
    use_pretrained_cloth=_env_bool("AVSS_USE_PRETRAINED_CLOTH", True),
    pretrained_detector_weights=_env_str("AVSS_DETECTOR_WEIGHTS", "yolov8n.pt"),
    custom_detector_weights=_env_str(
        "AVSS_CUSTOM_DETECTOR_WEIGHTS", str(WEIGHTS_DIR / "avss_detector.pt")
    ),
    custom_face_weights=_env_str(
        "AVSS_CUSTOM_FACE_WEIGHTS", str(WEIGHTS_DIR / "avss_arcface.onnx")
    ),
    custom_cloth_weights=_env_str(
        "AVSS_CUSTOM_CLOTH_WEIGHTS", str(WEIGHTS_DIR / "avss_reid.pth")
    ),
    device=_env_str("AVSS_DEVICE", "cpu"),
)


# ─────────────────────────────────────────────────────────────────────────────
# 2. PERSON DETECTOR — Module 6
#    Returns the existing PersonDetector singleton (backed by YOLOv8n or custom .pt)
# ─────────────────────────────────────────────────────────────────────────────

def get_detector():
    """
    Return the AVSS person detector.

    Pretrained mode:  YOLOv8n, downloaded automatically on first use.
    Custom mode:      Set AVSS_USE_PRETRAINED_DETECTOR=false and place your
                      trained .pt file at AVSS_CUSTOM_DETECTOR_WEIGHTS.

    Returns:
        app.ai.detection.PersonDetector singleton
    """
    from app.ai.detection import PersonDetector

    cfg = MODEL_CONFIG
    if cfg.use_pretrained_detector:
        weights = cfg.pretrained_detector_weights          # "yolov8n.pt"
        logger.info("[Detector] mode=pretrained weights=%s", weights)
    else:
        weights = cfg.custom_detector_weights
        if not Path(weights).exists():
            raise FileNotFoundError(
                f"Custom detector weights not found at '{weights}'. "
                "Train your model and place the .pt file there, "
                "or set AVSS_USE_PRETRAINED_DETECTOR=true to use YOLOv8n."
            )
        logger.info("[Detector] mode=custom weights=%s", weights)

    # Override the weights path on the singleton before loading
    import app.ai.detection as _det_module
    _det_module.YOLO_WEIGHTS = Path(weights)

    return PersonDetector.load(confidence_threshold=cfg.detector_confidence)


# ─────────────────────────────────────────────────────────────────────────────
# 3. FACE MODEL — Module 8
#    Returns the existing FaceRecognizer singleton (InsightFace or custom ArcFace)
# ─────────────────────────────────────────────────────────────────────────────

def get_face_model():
    """
    Return the AVSS face recognition model.

    Pretrained mode:  InsightFace buffalo_l (downloads ~500 MB to ~/.insightface
                      on first use, then cached permanently).
    Custom mode:      Set AVSS_USE_PRETRAINED_FACE=false and place your trained
                      ArcFace .onnx file at AVSS_CUSTOM_FACE_WEIGHTS.

    Returns:
        app.ai.recognition.FaceRecognizer singleton
    """
    from app.ai.recognition import FaceRecognizer

    cfg = MODEL_CONFIG
    if cfg.use_pretrained_face:
        logger.info("[Face] mode=pretrained (InsightFace %s)", cfg.pretrained_face_model)
    else:
        weights = cfg.custom_face_weights
        if not Path(weights).exists():
            raise FileNotFoundError(
                f"Custom face weights not found at '{weights}'. "
                "Export your ArcFace model to ONNX and place it there, "
                "or set AVSS_USE_PRETRAINED_FACE=true to use InsightFace."
            )
        logger.info("[Face] mode=custom weights=%s", weights)

    return FaceRecognizer.load()


# ─────────────────────────────────────────────────────────────────────────────
# 4. CLOTHING / RE-ID — Module 11 (OSNet)
#    Provides appearance embeddings for person re-identification.
#    Requires torchreid for pretrained mode.
# ─────────────────────────────────────────────────────────────────────────────

class ClothModelWrapper:
    """
    Consistent interface for clothing / re-id models.

    predict(person_crop_bgr) returns:
      - Pretrained (OSNet): {"embedding": np.ndarray (512,)}
      - Custom classifier:  {"attribute_probs": np.ndarray (num_attributes,)}
    """

    def __init__(self, cfg: ModelConfig):
        self._cfg = cfg
        self._backend: str
        self._model = None

        if cfg.use_pretrained_cloth:
            self._load_pretrained_osnet()
        else:
            self._load_custom()

    def _load_pretrained_osnet(self) -> None:
        try:
            import torchreid
            import torch
            self._model = torchreid.models.build_model(
                name=self._cfg.pretrained_cloth_model,
                num_classes=1000,
                pretrained=True,
            )
            self._model.eval()
            if self._cfg.device == "cuda":
                self._model = self._model.cuda()
            self._backend = "osnet"
            logger.info("[Cloth] mode=pretrained (OSNet x1.0)")
        except ImportError:
            logger.warning(
                "[Cloth] torchreid not installed. "
                "Install it with: pip install torchreid\n"
                "Clothing re-ID will be unavailable until then."
            )
            self._backend = "unavailable"

    def _load_custom(self) -> None:
        import torch
        import torch.nn as nn
        from torchvision.models import resnet50

        weights = self._cfg.custom_cloth_weights
        if not Path(weights).exists():
            raise FileNotFoundError(
                f"Custom clothing weights not found at '{weights}'. "
                "Train your model and place it there, "
                "or set AVSS_USE_PRETRAINED_CLOTH=true to use OSNet."
            )

        class _AttributeNet(nn.Module):
            def __init__(self, n: int):
                super().__init__()
                backbone = resnet50(weights=None)
                self.backbone = nn.Sequential(*list(backbone.children())[:-1])
                self.head = nn.Linear(2048, n)

            def forward(self, x):
                return self.head(self.backbone(x).flatten(1))

        self._model = _AttributeNet(self._cfg.cloth_num_attributes)
        self._model.load_state_dict(
            torch.load(weights, map_location=self._cfg.device)
        )
        self._model.eval()
        self._backend = "custom"
        logger.info("[Cloth] mode=custom weights=%s", weights)

    def predict(self, person_crop_bgr: np.ndarray) -> dict:
        """
        Args:
            person_crop_bgr: Full-body person crop as BGR numpy array.
        Returns:
            dict with "embedding" (OSNet) or "attribute_probs" (custom).
            Returns {"error": "unavailable"} if torchreid is not installed.
        """
        if self._backend == "unavailable":
            return {"error": "torchreid not installed"}

        import cv2
        import torch
        import torch.nn.functional as F

        size = (128, 256) if self._backend == "osnet" else (224, 224)
        img = cv2.resize(person_crop_bgr, size)
        tensor = (
            torch.from_numpy(img)
            .permute(2, 0, 1)
            .float()
            .unsqueeze(0)
            / 255.0
        )
        if self._cfg.device == "cuda":
            tensor = tensor.cuda()

        with torch.no_grad():
            out = self._model(tensor)

        if self._backend == "osnet":
            return {"embedding": F.normalize(out).cpu().numpy()[0]}
        else:
            probs = torch.sigmoid(out).cpu().numpy()[0]
            return {"attribute_probs": probs}


# Singleton cache for ClothModelWrapper
_cloth_instance: Optional[ClothModelWrapper] = None


def get_cloth_model() -> ClothModelWrapper:
    """
    Return the AVSS clothing / re-id model singleton.

    Pretrained mode:  OSNet x1.0 (requires torchreid).
    Custom mode:      Set AVSS_USE_PRETRAINED_CLOTH=false and place your
                      trained weights at AVSS_CUSTOM_CLOTH_WEIGHTS.

    Returns:
        ClothModelWrapper instance
    """
    global _cloth_instance
    if _cloth_instance is None:
        _cloth_instance = ClothModelWrapper(MODEL_CONFIG)
    return _cloth_instance


# ─────────────────────────────────────────────────────────────────────────────
# 5. Self-test — python -m app.model_layer
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logger.info("Device: %s", MODEL_CONFIG.device)
    logger.info(
        "Config — detector=%s  face=%s  cloth=%s",
        "pretrained" if MODEL_CONFIG.use_pretrained_detector else "custom",
        "pretrained" if MODEL_CONFIG.use_pretrained_face else "custom",
        "pretrained" if MODEL_CONFIG.use_pretrained_cloth else "custom",
    )

    for name, loader in [
        ("Detector (YOLOv8)", get_detector),
        ("Face model (InsightFace)", get_face_model),
        ("Cloth model (OSNet)", get_cloth_model),
    ]:
        try:
            loader()
            logger.info("[✓] %s loaded successfully.", name)
        except Exception as exc:
            logger.error("[✗] %s failed: %s", name, exc)
