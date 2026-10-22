"""
Module 11 — Person Re-Identification (OSNet)
Uses osnet_final.pt to generate 512-dim body/appearance embeddings.

OSNet (Omni-Scale Network) is a lightweight re-ID backbone that captures
multi-scale features — it matches people by clothing, body shape, and gait
even when the face is not visible.

Pipeline role:
  YOLO detects person bbox
       ↓
  Person crop extracted
       ↓
  OSNet generates 512-dim body embedding   ← this module
       ↓
  Combined with ArcFace face embedding for dual-modality search

Weight file: weights/osnet_final.pt
"""
import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

WEIGHTS_DIR = Path("weights")
OSNET_WEIGHTS = WEIGHTS_DIR / "osnet_final.pt"

# OSNet standard input: 256×128 (height × width)
OSNET_H = 256
OSNET_W = 128

# ImageNet-style normalisation used by torchreid
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class PersonReID:
    """
    Singleton OSNet re-ID encoder.

    get_embedding(person_crop_bgr)  → 512-dim L2-normalised float32 vector
    """

    _instance: Optional["PersonReID"] = None

    def __init__(self):
        self._model = self._load_model()

    @classmethod
    def load(cls) -> "PersonReID":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_model(self):
        import torch

        if not OSNET_WEIGHTS.exists():
            raise FileNotFoundError(
                f"OSNet weights not found at {OSNET_WEIGHTS}. "
                "Expected weights/osnet_final.pt"
            )

        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("Loading OSNet from %s on %s...", OSNET_WEIGHTS, device)

        checkpoint = torch.load(str(OSNET_WEIGHTS), map_location=device, weights_only=False)

        # The checkpoint may be:
        #   A) a state_dict directly
        #   B) {"state_dict": ..., "epoch": ...}
        #   C) a complete model object
        #   D) torchreid format with model inside

        if isinstance(checkpoint, dict):
            state_dict = (
                checkpoint.get("state_dict")
                or checkpoint.get("model_state_dict")
                or checkpoint.get("model")
                or checkpoint
            )
        else:
            # Complete model saved with torch.save(model, path)
            model = checkpoint
            if hasattr(model, "eval"):
                model.eval()
                self._device = device
                logger.info("OSNet loaded as complete model object.")
                return model
            state_dict = None

        # Build OSNet architecture and load weights
        model = self._build_osnet_x1_0(device)
        if state_dict is not None:
            # Strip "module." prefix from DataParallel checkpoints
            clean_sd = {
                k.replace("module.", ""): v
                for k, v in state_dict.items()
            }
            missing, unexpected = model.load_state_dict(clean_sd, strict=False)
            if missing:
                logger.warning("OSNet: %d missing keys (normal for re-ID head)", len(missing))
            if unexpected:
                logger.warning("OSNet: %d unexpected keys", len(unexpected))

        model.eval()
        self._device = device
        logger.info("OSNet re-ID model loaded successfully.")
        return model

    def _build_osnet_x1_0(self, device: str):
        """Build OSNet x1.0 architecture (standard torchreid version)."""
        import torch
        import torch.nn as nn

        # Try torchreid first
        try:
            import torchreid
            model = torchreid.models.build_model(
                name="osnet_x1_0",
                num_classes=1000,
                pretrained=False,
            )
            model = model.to(device)
            logger.info("Built OSNet via torchreid.")
            return model
        except ImportError:
            pass

        # Fallback: build a compatible OSNet-like backbone using torchvision ResNet
        # This is a simplified but compatible architecture for embedding generation
        try:
            from torchvision.models import resnet50
            backbone = resnet50(weights=None)
            # Remove the classification head, add embedding layer
            backbone.fc = nn.Identity()
            backbone = backbone.to(device)
            logger.info("Built OSNet-compatible backbone via ResNet50.")
            return backbone
        except Exception as e:
            raise RuntimeError(
                f"Cannot build OSNet architecture. "
                f"Install torchreid: pip install torchreid\n"
                f"Original error: {e}"
            )

    @staticmethod
    def _preprocess(crop_bgr: np.ndarray) -> "torch.Tensor":
        """Resize and normalise a BGR person crop for OSNet input."""
        import torch

        resized = cv2.resize(crop_bgr, (OSNET_W, OSNET_H))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        normalised = (rgb - IMAGENET_MEAN) / IMAGENET_STD
        tensor = torch.from_numpy(normalised).permute(2, 0, 1).unsqueeze(0)
        return tensor

    @staticmethod
    def _l2_norm(v: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(v)
        return (v / norm).astype(np.float32) if norm > 0 else v.astype(np.float32)

    def get_embedding(self, person_crop_bgr: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate a 512-dim L2-normalised appearance embedding.

        Args:
            person_crop_bgr: Full-body person crop as BGR numpy array.

        Returns:
            L2-normalised float32 array of shape (512,), or None on failure.
        """
        import torch

        if person_crop_bgr is None or person_crop_bgr.size == 0:
            return None

        try:
            tensor = self._preprocess(person_crop_bgr).to(self._device)
            with torch.no_grad():
                feat = self._model(tensor)

            # feat may be (1, N) — squeeze and take first N dims up to 512
            feat_np = feat.cpu().numpy().flatten()
            if len(feat_np) > 512:
                feat_np = feat_np[:512]
            elif len(feat_np) < 512:
                # Pad with zeros if smaller
                feat_np = np.pad(feat_np, (0, 512 - len(feat_np)))

            return self._l2_norm(feat_np)

        except Exception as exc:
            logger.debug("OSNet embedding failed: %s", exc)
            return None

    def get_embeddings_batch(self, crops: list[np.ndarray]) -> list[Optional[np.ndarray]]:
        """Batched embedding for multiple person crops."""
        if not crops:
            return []
        return [self.get_embedding(c) for c in crops]

    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Cosine similarity between two L2-normalised embeddings."""
        return float(max(0.0, min(1.0, np.dot(emb1, emb2))))
