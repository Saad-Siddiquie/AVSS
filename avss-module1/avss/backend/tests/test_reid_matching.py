from types import SimpleNamespace

import numpy as np

from app.ai.pipeline import _combined_track_scores_with_db


def test_face_photo_search_uses_face_similarity_only(monkeypatch):
    track_ids = [101, 202]
    face_embeddings = np.array(
        [
            [1.0, 0.0],
            [0.0, 1.0],
        ],
        dtype=np.float32,
    )
    query_embedding = np.array([0.6, 0.8], dtype=np.float32)
    monkeypatch.setattr(
        "app.ai.pipeline._load_job_track_index",
        lambda job_id, db: (track_ids, face_embeddings),
    )

    returned_ids, scores = _combined_track_scores_with_db(
        SimpleNamespace(id=1),
        query_embedding,
        db=object(),
    )

    assert returned_ids == track_ids
    np.testing.assert_allclose([scores[101], scores[202]], [0.6, 0.8])
