"""
Module 8 — Face Recognition
Uses InsightFace (buffalo_l model) to generate 512-dimensional face embeddings.
Model is loaded once at startup (~500 MB download on first use to ~/.insightface).
"""
import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


class FaceRecognizer:
    """
    Singleton wrapper around InsightFace ArcFace model (buffalo_l).

    Provides:
      - get_embedding(face_bgr)  → 512-dim float32 numpy array
      - compare(emb1, emb2)      → cosine similarity score [0..1]
    """

    _instance: Optional["FaceRecognizer"] = None

    def __init__(self):
        import insightface
        from insightface.app import FaceAnalysis

        logger.info("Loading InsightFace buffalo_l model (first run downloads ~500 MB)...")
        self._app = FaceAnalysis(
            name="buffalo_l",
            providers=["CPUExecutionProvider"],
        )
        # det_size must be a multiple of 32; 640×640 is recommended for accuracy
        self._app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("InsightFace loaded successfully.")

    @classmethod
    def load(cls) -> "FaceRecognizer":
        """Return the singleton, creating it on first call."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_embedding(self, face_bgr: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate a 512-dim L2-normalised embedding for a face image.

        Args:
            face_bgr: Cropped face region as a BGR numpy array (any size, will be resized).

        Returns:
            numpy array of shape (512,) dtype float32, or None if no face detected.
        """
        faces = self._app.get(face_bgr)
        if not faces:
            logger.warning("InsightFace found no face in the provided crop.")
            return None
        # Use the face with the highest detection score
        best = max(faces, key=lambda f: f.det_score)
        embedding: np.ndarray = best.embedding  # shape (512,)
        # L2 normalise
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding.astype(np.float32)

    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Compute cosine similarity between two L2-normalised embeddings.
        Returns a value in [0, 1] where 1 = identical.
        """
        # Both are already L2-normalised, so dot product == cosine similarity
        score = float(np.dot(emb1, emb2))
        # Clamp to [0, 1] — can be slightly negative due to floating point
        return max(0.0, min(1.0, score))

    @staticmethod
    def embedding_to_list(embedding: np.ndarray) -> list[float]:
        """Convert numpy embedding to a plain Python list for JSON serialisation."""
        return embedding.tolist()

    @staticmethod
    def embedding_from_list(values: list[float]) -> np.ndarray:
        """Reconstruct a numpy embedding from a stored list."""
        return np.array(values, dtype=np.float32)
