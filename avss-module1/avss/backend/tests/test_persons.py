"""
Module 9 — Person Registration tests.
AI models are mocked in conftest.py — tests run without GPU or downloads.
"""
import io
from uuid import uuid4

import numpy as np
import pytest


def _auth_headers(client) -> dict:
    email = f"person-tester-{uuid4()}@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "password": "secret123"})
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _fake_jpeg() -> bytes:
    """Create a minimal valid JPEG bytes for upload tests."""
    import cv2
    import numpy as np
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def test_register_person_returns_201(client):
    headers = _auth_headers(client)
    jpeg = _fake_jpeg()
    response = client.post(
        "/api/v1/persons/register",
        data={
            "name": f"Ali Hassan {uuid4()}",
            "age": "25",
            "gender": "Male",
            "description": "Test person",
        },
        files={"photo": ("face.jpg", io.BytesIO(jpeg), "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"].startswith("Ali Hassan")
    assert data["age"] == 25
    assert data["gender"] == "Male"
    assert "photo_filename" in data
    assert "id" in data


def test_register_person_requires_auth(client):
    jpeg = _fake_jpeg()
    response = client.post(
        "/api/v1/persons/register",
        data={"name": "No Auth", "age": "20", "gender": "Male"},
        files={"photo": ("face.jpg", io.BytesIO(jpeg), "image/jpeg")},
    )
    assert response.status_code == 401


def test_register_person_rejects_unsupported_file_type(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/persons/register",
        data={"name": "BadFile", "age": "20", "gender": "Male"},
        files={"photo": ("file.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 400


def test_list_persons_returns_200(client):
    headers = _auth_headers(client)
    response = client.get("/api/v1/persons", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_person_not_found(client):
    headers = _auth_headers(client)
    response = client.get("/api/v1/persons/999999", headers=headers)
    assert response.status_code == 404


def test_registered_person_appears_in_list(client):
    headers = _auth_headers(client)
    name = f"Saad Test {uuid4()}"
    jpeg = _fake_jpeg()
    client.post(
        "/api/v1/persons/register",
        data={"name": name, "age": "22", "gender": "Male"},
        files={"photo": ("face.jpg", io.BytesIO(jpeg), "image/jpeg")},
        headers=headers,
    )
    response = client.get("/api/v1/persons", headers=headers)
    names = [p["name"] for p in response.json()]
    assert name in names
