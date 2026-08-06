"""
Module 10 — FAISS Similarity Search
Maintains an in-memory FAISS index of face embeddings.
Supports adding embeddings, searching by nearest neighbour, and persistence to disk.
"""
import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 512
INDEX_DIR = Path("faiss_index")
INDEX_DIR.mkdir(exist_ok=True)
INDEX_FILE = INDEX_DIR / "faces.index"
META_FILE = INDEX_DIR / "faces_meta.json"


class FaceSearchIndex:
    """
    Wraps a FAISS IndexFlatIP (inner-product / cosine similarity on L2-normalised vectors).

    Thread-safety: FAISS itself is not thread-safe for concurrent writes.
    For a single-process dev server this is fine.
    """

    _instance: Optional["FaceSearchIndex"] = None

    def __init__(self):
        import faiss

        self._faiss = faiss
        # IndexFlatIP = exact inner-product search (cosine sim when vectors are L2-normalised)
        self._index = faiss.IndexFlatIP(EMBEDDING_DIM)
        # Metadata: list of {"person_id": int, "person_name": str}
        self._meta: list[dict] = []

        # Load persisted index if available
        if INDEX_FILE.exists() and META_FILE.exists():
            self._load()

        logger.info(
            "FaceSearchIndex ready — %d embeddings in index.", self._index.ntotal
        )

    @classmethod
    def load(cls) -> "FaceSearchIndex":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ── Write operations ────────────────────────────────────────────────────

    def add(self, embedding: np.ndarray, person_id: int, person_name: str) -> int:
        """
        Add a single L2-normalised embedding to the index.

        Returns:
            The FAISS internal index position (0-based).
        """
        vec = embedding.reshape(1, EMBEDDING_DIM).astype(np.float32)
        self._index.add(vec)
        position = len(self._meta)
        self._meta.append({"person_id": person_id, "person_name": person_name})
        self._save()
        logger.info(
            "Added embedding for person_id=%d (%s). Index size=%d",
            person_id, person_name, self._index.ntotal,
        )
        return position

    def remove_by_person_id(self, person_id: int) -> int:
        """
        Remove all embeddings belonging to a person.
        Rebuilds the index from scratch (FAISS IndexFlatIP has no native delete).

        Returns:
            Number of embeddings removed.
        """
        keep_indices = [
            i for i, m in enumerate(self._meta) if m["person_id"] != person_id
        ]
        removed = len(self._meta) - len(keep_indices)
        if removed == 0:
            return 0

        # Rebuild index
        new_index = self._faiss.IndexFlatIP(EMBEDDING_DIM)
        new_meta: list[dict] = []

        if keep_indices and self._index.ntotal > 0:
            # Reconstruct all kept vectors
            all_vecs = self._faiss.rev_swig_ptr(
                self._index.get_xb(), self._index.ntotal * EMBEDDING_DIM
            ).reshape(self._index.ntotal, EMBEDDING_DIM)
            kept_vecs = all_vecs[keep_indices]
            new_index.add(kept_vecs)
            new_meta = [self._meta[i] for i in keep_indices]

        self._index = new_index
        self._meta = new_meta
        self._save()
        logger.info("Removed %d embeddings for person_id=%d", removed, person_id)
        return removed

    # ── Search ──────────────────────────────────────────────────────────────

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 5,
        min_similarity: float = 0.30,
    ) -> list[dict]:
        """
        Search for the most similar faces in the index.

        Args:
            query_embedding: L2-normalised 512-dim float32 array.
            top_k:           Number of results to return.
            min_similarity:  Minimum cosine similarity to include in results.

        Returns:
            List of dicts: [{"person_id", "person_name", "similarity", "rank"}]
            Sorted by similarity descending.
        """
        if self._index.ntotal == 0:
            return []

        k = min(top_k, self._index.ntotal)
        vec = query_embedding.reshape(1, EMBEDDING_DIM).astype(np.float32)
        similarities, indices = self._index.search(vec, k)

        results = []
        for rank, (sim, idx) in enumerate(zip(similarities[0], indices[0]), start=1):
            if idx < 0 or float(sim) < min_similarity:
                continue
            meta = self._meta[idx]
            results.append(
                {
                    "rank": rank,
                    "person_id": meta["person_id"],
                    "person_name": meta["person_name"],
                    "similarity": round(float(sim), 4),
                    "distance": round(1.0 - float(sim), 4),
                }
            )
        return results

    # ── Stats ───────────────────────────────────────────────────────────────

    @property
    def total(self) -> int:
        return self._index.ntotal

    # ── Persistence ─────────────────────────────────────────────────────────

    def _save(self) -> None:
        self._faiss.write_index(self._index, str(INDEX_FILE))
        META_FILE.write_text(json.dumps(self._meta))

    def _load(self) -> None:
        self._index = self._faiss.read_index(str(INDEX_FILE))
        self._meta = json.loads(META_FILE.read_text())
        logger.info("Loaded FAISS index: %d vectors", self._index.ntotal)
