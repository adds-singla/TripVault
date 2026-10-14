def _c(client):
    return client


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_me_default_mock_user(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 200 and r.json()["email"] == "elena.vance@tripvault.io"


def test_me_unknown_user_rejected(client):
    assert client.get("/api/auth/me", headers={"X-Mock-User": "nobody"}).status_code == 401


def test_seed_is_idempotent(client):
    from scripts.seed import run
    run()  # must not raise or duplicate
