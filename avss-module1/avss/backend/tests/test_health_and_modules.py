def test_health_endpoint_returns_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "AVSS Backend"
    assert "database_connected" in payload


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "AVSS API is running"


def test_module5_overview_endpoint(client):
    response = client.get("/api/v1/module5/overview")
    assert response.status_code == 200
    payload = response.json()
    assert payload["framework"] == "OpenCV"
    assert payload["pipeline_name"] == "Video Processing Pipeline"
    assert len(payload["features"]) >= 5


def test_module9_overview_endpoint(client):
    response = client.get("/api/v1/module9/overview")
    assert response.status_code == 200
    payload = response.json()
    assert payload["task"] == "Person Registration"
    assert len(payload["features"]) == 6
    assert payload["features"][0]["name"] == "Upload Person Photo"
