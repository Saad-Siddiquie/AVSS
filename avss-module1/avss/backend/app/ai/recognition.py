"""
Module 8 — Face Recognition
Uses InsightFace (buffalo_l model) to generate 512-dimensional face embeddings.

Two-step process for video pipeline:
  Step 1: YOLOv8-Face detects face bounding boxes  (app/ai/face.py)
  Step 2: InsightFace ArcFace embeds each face crop  (this file)

get_embedding(image)          — for query photos (full detect + embed)
get_embedding_from_crop(crop) — for pipeline crops (fast, skip re-detection)
get_embeddings_from_crops([]) — batched version of above
"""
import logging
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class FaceRecognizer:
    """
    Singleton wrapper around InsightFace ArcFace (buffalo_l).

    IMPORTANT — what each method does:
      get_embedding(full_image)        YOLOv8-Face detects face in image → ArcFace embeds it
      get_embedding_from_crop(crop)    Skips detection → ArcFace embeds the crop directly (FAST)
      get_embeddings_from_crops(list)  Same as above, batched
      cosine_similarity(a, b)          Returns 0.0–1.0, higher = more similar
    """

    _instance: Optional["FaceRecognizer"] = None

    def __init__(self):
        from insightface.app import FaceAnalysis

        logger.info("Loading InsightFace buffalo_l...")
        self._app = FaceAnalysis(
            name="buffalo_l",
            providers=["CPUExecutionProvider"],
        )
        self._app.prepare(ctx_id=0, det_size=(640, 640))

        # Get the recognition (ArcFace) model for fast crop-only inference
        rec_model = self._app.models.get("recognition")
        if rec_model is None:
            # Fallback: find any recognition model by name
            for k, v in self._app.models.items():
                if "rec" in k.lower() or "arcface" in k.lower() or "recognition" in k.lower():
                    rec_model = v
                    break

        self._rec_model = rec_model
        if rec_model is not None:
            # Get input size from the model (112×112 for most ArcFace models)
            try:
                self._rec_input_size = tuple(rec_model.input_size)
            except Exception:
                self._rec_input_size = (112, 112)
        else:
            self._rec_input_size = (112, 112)
            logger.warning("Recognition model not found — will use full pipeline for all crops.")

        logger.info(
            "InsightFace loaded. ArcFace input size: %s",
            self._rec_input_size,
        )

    @classmethod
    def load(cls) -> "FaceRecognizer":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @staticmethod
    def _normalize(embedding: np.ndarray) -> np.ndarray:
        """L2-normalise so cosine similarity = dot product."""
        norm = np.linalg.norm(embedding)
        return (embedding / norm).astype(np.float32) if norm > 0 else embedding.astype(np.float32)

    def _embed_crop_via_rec_model(self, crop_bgr: np.ndarray) -> Optional[np.ndarray]:
        """
        Fast path: resize crop → run ArcFace ONNX → return embedding.
        Bypasses face detection entirely since YOLO already found the bbox.
        """
        if self._rec_model is None:
            return None
        try:
            resized = cv2.resize(crop_bgr, self._rec_input_size)
            # InsightFace rec models expose get_feat(imgs) for direct embedding
            feat = self._rec_model.get_feat([resized])
            if feat is not None and len(feat) > 0:
                return self._normalize(feat[0])
        except Exception as exc:
            logger.debug("Fast crop embedding failed (%s), falling back to full pipeline.", exc)
        return None

    def _embed_via_full_pipeline(self, image_bgr: np.ndarray) -> Optional[np.ndarray]:
        """
        Slow but reliable: run full InsightFace detect+align+embed pipeline.
        Used as fallback when fast path fails.
        """
        faces = self._app.get(image_bgr)
        if not faces:
            return None
        best = max(faces, key=lambda f: f.det_score)
        return self._normalize(best.embedding)

    # ── Public API ────────────────────────────────────────────────────────────

    def get_embedding_from_crop(self, face_bgr: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate a 512-dim embedding from an already-detected face crop.

        This is the FAST PATH used by the video pipeline:
          YOLOv8-Face detected the bbox → we cropped it → embed directly.

        Args:
            face_bgr: Pre-cropped face image (any size; resized internally to 112×112).

        Returns:
            L2-normalised 512-dim float32 numpy array, or None on failure.
        """
        if face_bgr is None or face_bgr.size == 0:
            return None

        # Try fast ArcFace-only path first
        emb = self._embed_crop_via_rec_model(face_bgr)
        if emb is not None:
            return emb

        # Fallback: full InsightFace pipeline on the crop
        return self._embed_via_full_pipeline(face_bgr)

    def get_embeddings_from_crops(
        self, crops: list[np.ndarray]
    ) -> list[np.ndarray]:
        """
        Batched embedding for multiple face crops.

        Args:
            crops: List of pre-cropped face BGR images.

        Returns:
            List of 512-dim embeddings. Failed crops get zero vectors.
        """
        if not crops:
            return []

        if self._rec_model is not None:
            try:
                resized = [cv2.resize(c, self._rec_input_size) for c in crops]
                feats = self._rec_model.get_feat(resized)
                if feats is not None and len(feats) == len(crops):
                    return [self._normalize(feats[i]) for i in range(len(crops))]
            except Exception as exc:
                logger.debug("Batched embedding failed (%s), falling back one-by-one.", exc)

        # Fallback: embed one by one
        return [
            self.get_embedding_from_crop(c) or np.zeros(512, dtype=np.float32)
            for c in crops
        ]

    def get_embedding(self, image_bgr: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate a 512-dim embedding from a full image (used for query photos).

        Flow:
          1. YOLOv8-Face detects face in the image
          2. Best face crop extracted
          3. ArcFace embeds the crop (fast path)
          4. If step 1-3 fails → full InsightFace pipeline (fallback)

        Args:
            image_bgr: Full image (query photo, any size).

        Returns:
            L2-normalised 512-dim float32 numpy array, or None if no face found.
        """
        if image_bgr is None or image_bgr.size == 0:
            return None

        # Step 1+2: Use YOLOv8-Face to detect and crop the best face
        try:
            from app.ai.face import FaceDetector
            faces = FaceDetector.load().detect(image_bgr, confidence_threshold=0.40)
            if faces:
                best_face = max(faces, key=lambda f: f.confidence)
                crop = best_face.crop(image_bgr)
                if crop.size > 0:
                    emb = self.get_embedding_from_crop(crop)
                    if emb is not None:
                        logger.debug(
                            "Query embedded via YOLOv8-Face + ArcFace (conf=%.2f).",
                            best_face.confidence,
                        )
                        return emb
        except Exception as exc:
            logger.debug("YOLOv8-Face step failed for query image: %s", exc)

        # Fallback: full InsightFace pipeline
        emb = self._embed_via_full_pipeline(image_bgr)
        if emb is None:
            logger.warning(
                "No face detected in image (tried YOLOv8-Face + InsightFace fallback)."
            )
        return emb

    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Cosine similarity between two L2-normalised embeddings. Returns [0, 1]."""
        score = float(np.dot(emb1, emb2))
        return max(0.0, min(1.0, score))

    @staticmethod
    def embedding_to_list(embedding: np.ndarray) -> list[float]:
        return embedding.tolist()

    @staticmethod
    def embedding_from_list(values: list[float]) -> np.ndarray:
        return np.array(values, dtype=np.float32)
