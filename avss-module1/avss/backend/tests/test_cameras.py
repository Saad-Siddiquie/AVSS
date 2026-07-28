"""
Module 4 — Camera Management tests.
All CRUD endpoints require authentication; tests register + login first.
"""
from uuid import uuid4


def _auth_headers(client) -> dict:
    """Helper: register a fresh user and return Bearer headers."""
    email = f"cam-tester-{uuid4()}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secret123", "role": "user"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "secret123"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

def test_create_camera_returns_201(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/cameras",
        json={
            "name": "Front Entrance",
            "url": "rtsp://192.168.1.10/stream1",
            "camera_type": "rtsp",
            "location": "Main Gate",
            "status": "inactive",
        },
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Front Entrance"
    assert data["camera_type"] == "rtsp"
    assert data["status"] == "inactive"
    assert data["is_active"] is True
    assert "id" in data


def test_create_camera_requires_auth(client):
    response = client.post(
        "/api/v1/cameras",
        json={"name": "No Auth", "url": "rtsp://x", "camera_type": "rtsp"},
    )
    assert response.status_code == 401


def test_create_camera_duplicate_name_returns_409(client):
    headers = _auth_headers(client)
    payload = {
        "name": f"Duplicate-{uuid4()}",
        "url": "rtsp://192.168.1.11/stream",
        "camera_type": "rtsp",
    }
    client.post("/api/v1/cameras", json=payload, headers=headers)
    response = client.post("/api/v1/cameras", json=payload, headers=headers)
    assert response.status_code == 409


def test_create_camera_invalid_type_returns_422(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/cameras",
        json={"name": "Bad Type", "url": "rtsp://x", "camera_type": "ftp"},
        headers=headers,
    )
    assert response.status_code == 422


def test_create_webcam_camera(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/cameras",
        json={
            "name": f"Webcam-{uuid4()}",
            "url": "0",
            "camera_type": "webcam",
            "location": "Office",
        },
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["camera_type"] == "webcam"


def test_create_file_camera(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/cameras",
        json={
            "name": f"File-{uuid4()}",
            "url": "/videos/sample.mp4",
            "camera_type": "file",
        },
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["camera_type"] == "file"


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------

def test_list_cameras_returns_200(client):
    headers = _auth_headers(client)
    response = client.get("/api/v1/cameras", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "cameras" in data
    assert isinstance(data["cameras"], list)


def test_list_cameras_requires_auth(client):
    response = client.get("/api/v1/cameras")
    assert response.status_code == 401


def test_list_cameras_includes_created_camera(client):
    headers = _auth_headers(client)
    name = f"Listed-{uuid4()}"
    client.post(
        "/api/v1/cameras",
        json={"name": name, "url": "rtsp://x", "camera_type": "rtsp"},
        headers=headers,
    )
    response = client.get("/api/v1/cameras", headers=headers)
    names = [c["name"] for c in response.json()["cameras"]]
    assert name in names


# ---------------------------------------------------------------------------
# GET BY ID
# ---------------------------------------------------------------------------

def test_get_camera_by_id(client):
    headers = _auth_headers(client)
    created = client.post(
        "/api/v1/cameras",
        json={
            "name": f"GetById-{uuid4()}",
            "url": "rtsp://192.168.1.20/stream",
            "camera_type": "rtsp",
        },
        headers=headers,
    ).json()
    response = client.get(f"/api/v1/cameras/{created['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_camera_not_found(client):
    headers = _auth_headers(client)
    response = client.get("/api/v1/cameras/999999", headers=headers)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------

def test_update_camera_name_and_status(client):
    headers = _auth_headers(client)
    created = client.post(
        "/api/v1/cameras",
        json={
            "name": f"UpdateMe-{uuid4()}",
            "url": "rtsp://x",
            "camera_type": "rtsp",
        },
        headers=headers,
    ).json()
    camera_id = created["id"]
    response = client.put(
        f"/api/v1/cameras/{camera_id}",
        json={"status": "active", "location": "Parking Lot"},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert data["location"] == "Parking Lot"


def test_update_camera_not_found(client):
    headers = _auth_headers(client)
    response = client.put(
        "/api/v1/cameras/999999",
        json={"status": "active"},
        headers=headers,
    )
    assert response.status_code == 404


def test_update_camera_invalid_status(client):
    headers = _auth_headers(client)
    created = client.post(
        "/api/v1/cameras",
        json={
            "name": f"StatusTest-{uuid4()}",
            "url": "rtsp://x",
            "camera_type": "rtsp",
        },
        headers=headers,
    ).json()
    response = client.put(
        f"/api/v1/cameras/{created['id']}",
        json={"status": "broken"},
        headers=headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

def test_delete_camera_returns_204(client):
    headers = _auth_headers(client)
    created = client.post(
        "/api/v1/cameras",
        json={
            "name": f"DeleteMe-{uuid4()}",
            "url": "rtsp://x",
            "camera_type": "rtsp",
        },
        headers=headers,
    ).json()
    response = client.delete(f"/api/v1/cameras/{created['id']}", headers=headers)
    assert response.status_code == 204


def test_delete_camera_not_found(client):
    headers = _auth_headers(client)
    response = client.delete("/api/v1/cameras/999999", headers=headers)
    assert response.status_code == 404


def test_deleted_camera_no_longer_retrievable(client):
    headers = _auth_headers(client)
    created = client.post(
        "/api/v1/cameras",
        json={
            "name": f"GoneAfterDelete-{uuid4()}",
            "url": "rtsp://x",
            "camera_type": "rtsp",
        },
        headers=headers,
    ).json()
    camera_id = created["id"]
    client.delete(f"/api/v1/cameras/{camera_id}", headers=headers)
    response = client.get(f"/api/v1/cameras/{camera_id}", headers=headers)
    assert response.status_code == 404
