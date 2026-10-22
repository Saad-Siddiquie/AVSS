import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Use SQLite for tests — no PostgreSQL needed
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

# ── Mock heavy AI models so tests don't need GPUs or downloads ───────────────
import numpy as np

_FAKE_EMBEDDING = np.random.rand(512).astype("float32")
_FAKE_EMBEDDING /= np.linalg.norm(_FAKE_EMBEDDING)  # L2-normalise

def _mock_person_detector():
    m = MagicMock()
    m.detect.return_value = []
    return m

def _mock_face_detector():
    m = MagicMock()
    m.detect.return_value = []
    return m

def _mock_face_recognizer():
    m = MagicMock()
    m.get_embedding.return_value = _FAKE_EMBEDDING
    m.get_embedding_from_crop.return_value = _FAKE_EMBEDDING
    m.get_embeddings_from_crops.return_value = [_FAKE_EMBEDDING]
    m.cosine_similarity = lambda a, b: float(np.dot(a, b))
    return m

def _mock_face_search_index():
    m = MagicMock()
    m.search.return_value = []
    m.add.return_value = 0
    m.total = 0
    return m


@pytest.fixture(scope="session", autouse=True)
def mock_ai_models():
    """Patch all AI singletons for the entire test session."""
    with (
        patch("app.ai.person.PersonDetector.load", return_value=_mock_person_detector()),
        patch("app.ai.face.FaceDetector.load", return_value=_mock_face_detector()),
        patch("app.ai.recognition.FaceRecognizer.load", return_value=_mock_face_recognizer()),
        patch("app.ai.search.FaceSearchIndex.load", return_value=_mock_face_search_index()),
        patch("app.ai.loader.load_all_models", return_value=None),
    ):
        yield


@pytest.fixture(scope="session")
def create_test_tables(mock_ai_models):
    """Create all DB tables once per test session."""
    from app.core.database import Base, engine
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(create_test_tables):
    from app.main import app
    with TestClient(app) as c:
        yield c
