"""
Module 6 & 7 — Detection endpoint tests.
AI models are mocked — tests verify API contract without real inference.
"""
import io
from uuid import uuid4


def _auth_headers(client) -> dict:
    email = f"detect-tester-{uuid4()}@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "password": "secret123"})
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _fake_jpeg() -> bytes:
    import cv2
    import numpy as np
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def test_detect_persons_returns_200(client):
    headers = _auth_headers(client)
    jpeg = _fake_jpeg()
    response = client.post(
        "/api/v1/detect/persons",
        files={"image": ("frame.jpg", io.BytesIO(jpeg), "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "person_count" in data
    assert "detections" in data
    assert isinstance(data["detections"], list)


def test_detect_persons_requires_auth(client):
    jpeg = _fake_jpeg()
    response = client.post(
        "/api/v1/detect/persons",
        files={"image": ("frame.jpg", io.BytesIO(jpeg), "image/jpeg")},
    )
    assert response.status_code == 401


def test_detect_faces_returns_200(client):
    headers = _auth_headers(client)
    jpeg = _fake_jpeg()
    response = client.post(
        "/api/v1/detect/faces",
        files={"image": ("frame.jpg", io.BytesIO(jpeg), "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "face_count" in data
    assert "detections" in data


def test_detect_persons_rejects_pdf(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/detect/persons",
        files={"image": ("file.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 400
