"""
Module 10 — FAISS Search endpoint tests.
"""
import io
from uuid import uuid4


def _auth_headers(client) -> dict:
    email = f"search-tester-{uuid4()}@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "password": "secret123"})
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _fake_jpeg() -> bytes:
    import cv2
    import numpy as np
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def test_search_face_returns_200(client):
    headers = _auth_headers(client)
    jpeg = _fake_jpeg()
    response = client.post(
        "/api/v1/search/face",
        files={"image": ("query.jpg", io.BytesIO(jpeg), "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["query_processed"] is True
    assert "results" in data
    assert "index_size" in data


def test_search_face_requires_auth(client):
    jpeg = _fake_jpeg()
    response = client.post(
        "/api/v1/search/face",
        files={"image": ("query.jpg", io.BytesIO(jpeg), "image/jpeg")},
    )
    assert response.status_code == 401


def test_search_face_rejects_pdf(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/search/face",
        files={"image": ("file.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 400
