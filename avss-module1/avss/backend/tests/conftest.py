import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.main import app
from app.core.database import Base, engine


@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    """Create all tables once per test session, then drop them on teardown."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(create_test_tables):
    with TestClient(app) as test_client:
        yield test_client
