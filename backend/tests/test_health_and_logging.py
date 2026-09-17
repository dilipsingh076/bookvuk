"""Health probes and request-id propagation."""

from app.core.logging import REQUEST_ID_HEADER


def test_health_is_public_and_does_not_touch_the_database(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_readiness_reports_the_database(client):
    res = client.get("/health/ready")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ready"
    # The target is safe to expose: no credentials in it.
    assert "@" not in body["database"]


def test_every_response_carries_a_request_id(client):
    res = client.get("/health")
    assert res.headers.get(REQUEST_ID_HEADER)


def test_an_upstream_request_id_is_preserved(client):
    res = client.get("/health", headers={REQUEST_ID_HEADER: "trace-abc-123"})
    assert res.headers[REQUEST_ID_HEADER] == "trace-abc-123"


def test_request_ids_differ_between_requests(client):
    a = client.get("/health").headers[REQUEST_ID_HEADER]
    b = client.get("/health").headers[REQUEST_ID_HEADER]
    assert a != b


def test_error_responses_also_carry_a_request_id(client):
    res = client.get("/api/customer/cart")
    assert res.status_code == 401
    assert res.headers.get(REQUEST_ID_HEADER)
