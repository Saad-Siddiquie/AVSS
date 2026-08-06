"""
model_layer.py — AVSS Model Abstraction Layer
------------------------------------------------
Purpose: swap between pretrained models (for prototyping) and your own
trained models (final submission) by changing ONE config value, without
touching FastAPI routes, database logic, or the dashboard.

Usage:
    from model_layer import get_detector, get_face_model, get_cloth_model

    detector = get_detector()
    face_model = get_face_model()
    cloth_model = get_cloth_model()

Switch everything to your own trained weights by editing MODEL_CONFIG below,
or by setting environment variables (see bottom of file).
"""

import os
import logging
from dataclasses import dataclass
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("avss.model_layer")


# ============================================================
# 1. CONFIG — this is the ONLY section you need to edit to swap models
# ============================================================

@dataclass
class ModelConfig:
    # Detector
    use_pretrained_detector: bool = True
    pretrained_detector_path: str = "yolo11n.pt"
    custom_detector_path: str = "weights/avss_detector_scratch.pt"

    # Face recognition
    use_pretrained_face: bool = True
    pretrained_face_backend: str = "insightface"          # loaded via insightface lib
    custom_face_path: str = "weights/avss_face_scratch.pth"
    face_embedding_dim: int = 512

    # Clothing recognition
    use_pretrained_cloth: bool = True
    pretrained_cloth_path: str = "osnet_x1_0_market1501.pth"   # or similar
    custom_cloth_path: str = "weights/avss_cloth_scratch.pth"
    cloth_num_attributes: int = 26

    device: str = "cuda" if torch.cuda.is_available() else "cpu"


# Environment variables override the defaults above, so you can flip
# a switch at deploy-time without editing this file:
#   AVSS_USE_PRETRAINED_DETECTOR=false
#   AVSS_USE_PRETRAINED_FACE=false
#   AVSS_USE_PRETRAINED_CLOTH=false
def _env_bool(name: str, default: bool) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes")


MODEL_CONFIG = ModelConfig(
    use_pretrained_detector=_env_bool("AVSS_USE_PRETRAINED_DETECTOR", True),
    use_pretrained_face=_env_bool("AVSS_USE_PRETRAINED_FACE", True),
    use_pretrained_cloth=_env_bool("AVSS_USE_PRETRAINED_CLOTH", True),
)


# ============================================================
# 2. DETECTOR — YOLO wrapper (pretrained .pt or your own scratch .pt)
# ============================================================

class DetectorWrapper:
    """Consistent interface regardless of which weights are loaded underneath.
    predict() always returns a list of dicts: [{'bbox': [x1,y1,x2,y2], 'conf': float}, ...]
    """

    def __init__(self, weights_path: str, device: str):
        from ultralytics import YOLO   # local import so this file loads even if ultralytics isn't installed yet

        if not Path(weights_path).exists():
            raise FileNotFoundError(
                f"Detector weights not found at '{weights_path}'. "
                f"If using a custom model, train it first (see AVSS_Training_Pipeline_Guide.md)."
            )
        self.model = YOLO(weights_path)
        self.device = device
        logger.info(f"Detector loaded from: {weights_path}")

    def predict(self, image, conf_threshold: float = 0.4):
        results = self.model.predict(image, device=self.device, conf=conf_threshold, verbose=False)
        detections = []
        for box in results[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "bbox": [x1, y1, x2, y2],
                "conf": float(box.conf[0]),
                "class_id": int(box.cls[0]),
            })
        return detections


def get_detector() -> DetectorWrapper:
    cfg = MODEL_CONFIG
    path = cfg.pretrained_detector_path if cfg.use_pretrained_detector else cfg.custom_detector_path
    logger.info(f"[Detector] mode={'pretrained' if cfg.use_pretrained_detector else 'custom-trained'}")
    return DetectorWrapper(path, cfg.device)


# ============================================================
# 3. FACE RECOGNITION — pretrained (InsightFace) or your own ArcFace net
# ============================================================

class FaceEmbeddingNet(nn.Module):
    """Architecture used when loading YOUR OWN trained face weights.
    Must match the architecture used during training (see training guide)."""

    def __init__(self, embedding_size: int = 512):
        super().__init__()
        from torchvision.models import resnet50
        backbone = resnet50(weights=None)  # no pretrained backbone — matches from-scratch training
        self.backbone = nn.Sequential(*list(backbone.children())[:-1])
        self.fc = nn.Linear(2048, embedding_size)

    def forward(self, x):
        x = self.backbone(x).flatten(1)
        return self.fc(x)


class FaceModelWrapper:
    """Consistent interface: embed(face_crop) -> normalized embedding vector (numpy array)."""

    def __init__(self, cfg: ModelConfig):
        self.cfg = cfg
        self.device = cfg.device

        if cfg.use_pretrained_face:
            self._load_pretrained()
        else:
            self._load_custom()

    def _load_pretrained(self):
        import insightface
        self.backend = "insightface"
        self.app = insightface.app.FaceAnalysis(name="buffalo_l")
        self.app.prepare(ctx_id=0 if self.device == "cuda" else -1)
        logger.info("Face model loaded: InsightFace (pretrained)")

    def _load_custom(self):
        self.backend = "custom"
        path = self.cfg.custom_face_path
        if not Path(path).exists():
            raise FileNotFoundError(
                f"Custom face weights not found at '{path}'. "
                f"Train it first (see AVSS_Training_Pipeline_Guide.md, Component 2)."
            )
        self.model = FaceEmbeddingNet(embedding_size=self.cfg.face_embedding_dim).to(self.device)
        self.model.load_state_dict(torch.load(path, map_location=self.device))
        self.model.eval()
        logger.info(f"Face model loaded: custom weights from {path}")

    def embed(self, face_crop):
        """face_crop: aligned face image (numpy array, BGR, roughly 112x112 for custom model)"""
        if self.backend == "insightface":
            faces = self.app.get(face_crop)
            if not faces:
                return None
            return faces[0].normed_embedding
        else:
            import cv2
            import numpy as np
            img = cv2.resize(face_crop, (112, 112))
            tensor = torch.from_numpy(img).permute(2, 0, 1).float().unsqueeze(0).to(self.device) / 255.0
            with torch.no_grad():
                emb = self.model(tensor)
                emb = F.normalize(emb)
            return emb.cpu().numpy()[0]


def get_face_model() -> FaceModelWrapper:
    cfg = MODEL_CONFIG
    logger.info(f"[Face] mode={'pretrained (InsightFace)' if cfg.use_pretrained_face else 'custom-trained'}")
    return FaceModelWrapper(cfg)


# ============================================================
# 4. CLOTHING RECOGNITION — pretrained (OSNet re-id) or your own attribute classifier
# ============================================================

class ClothingAttributeNet(nn.Module):
    """Architecture used when loading YOUR OWN trained clothing weights."""

    def __init__(self, num_attributes: int):
        super().__init__()
        from torchvision.models import resnet50
        backbone = resnet50(weights=None)
        self.backbone = nn.Sequential(*list(backbone.children())[:-1])
        self.classifier = nn.Linear(2048, num_attributes)

    def forward(self, x):
        x = self.backbone(x).flatten(1)
        return self.classifier(x)


class ClothModelWrapper:
    """Consistent interface: predict(person_crop) -> dict of attributes or embedding vector."""

    def __init__(self, cfg: ModelConfig):
        self.cfg = cfg
        self.device = cfg.device

        if cfg.use_pretrained_cloth:
            self._load_pretrained()
        else:
            self._load_custom()

    def _load_pretrained(self):
        # Example using torchreid's OSNet for appearance embeddings (re-id style,
        # not discrete attribute labels — swap for a different pretrained model
        # if you need explicit attribute output, e.g. a PA-100K pretrained net)
        import torchreid
        self.backend = "osnet"
        self.model = torchreid.models.build_model(
            name="osnet_x1_0", num_classes=1000, pretrained=True
        ).to(self.device)
        self.model.eval()
        logger.info("Cloth model loaded: OSNet (pretrained, appearance embedding)")

    def _load_custom(self):
        self.backend = "custom"
        path = self.cfg.custom_cloth_path
        if not Path(path).exists():
            raise FileNotFoundError(
                f"Custom clothing weights not found at '{path}'. "
                f"Train it first (see AVSS_Training_Pipeline_Guide.md, Component 3)."
            )
        self.model = ClothingAttributeNet(num_attributes=self.cfg.cloth_num_attributes).to(self.device)
        self.model.load_state_dict(torch.load(path, map_location=self.device))
        self.model.eval()
        logger.info(f"Cloth model loaded: custom weights from {path}")

    def predict(self, person_crop):
        import cv2
        img = cv2.resize(person_crop, (128, 256) if self.backend == "osnet" else (224, 224))
        tensor = torch.from_numpy(img).permute(2, 0, 1).float().unsqueeze(0).to(self.device) / 255.0

        with torch.no_grad():
            output = self.model(tensor)

        if self.backend == "osnet":
            return {"embedding": F.normalize(output).cpu().numpy()[0]}
        else:
            probs = torch.sigmoid(output).cpu().numpy()[0]
            return {"attribute_probs": probs}   # map back to attribute names in your API layer


def get_cloth_model() -> ClothModelWrapper:
    cfg = MODEL_CONFIG
    logger.info(f"[Cloth] mode={'pretrained (OSNet)' if cfg.use_pretrained_cloth else 'custom-trained'}")
    return ClothModelWrapper(cfg)


# ============================================================
# 5. Quick self-test — run `python model_layer.py` to sanity-check loading
# ============================================================

if __name__ == "__main__":
    logger.info(f"Device: {MODEL_CONFIG.device}")
    logger.info("Attempting to load all three models with current config...")

    try:
        detector = get_detector()
        logger.info("Detector: OK")
    except Exception as e:
        logger.warning(f"Detector failed to load: {e}")

    try:
        face_model = get_face_model()
        logger.info("Face model: OK")
    except Exception as e:
        logger.warning(f"Face model failed to load: {e}")

    try:
        cloth_model = get_cloth_model()
        logger.info("Cloth model: OK")
    except Exception as e:
        logger.warning(f"Cloth model failed to load: {e}")
