"""API tests: authorization, expenses/balances/settle flow, dashboard."""
import pytest

H = lambda u: {"X-Mock-User": u}


@pytest.fixture
def c(client):
    return client


def trip_id(c):
    return next(t["id"] for t in c.get("/api/trips", headers=H("mock-elena")).json() if t["name"] == "Singapore Trip")


def test_list_trips_has_summary(c):
    t = c.get("/api/trips", headers=H("mock-elena")).json()[0]
    assert float(t["total_spent"]) == 1590.5 and t["checklist_total"] == 7 and len(t["members"]) == 4


def test_non_member_gets_404(c):
    c.post("/api/auth/mock-login", json={"email": "stranger@x.com"})
    assert c.get(f"/api/trips/{trip_id(c)}", headers=H("mock-stranger")).status_code == 404


def test_viewer_cannot_write_but_can_read(c):
    tid = trip_id(c)
    assert c.post(f"/api/trips/{tid}/members", json={"email": "stranger@x.com", "role": "viewer"},
                  headers=H("mock-elena")).status_code == 201
    assert c.get(f"/api/trips/{tid}/expenses", headers=H("mock-stranger")).status_code == 200
    r = c.post(f"/api/trips/{tid}/checklist", json={"label": "x"}, headers=H("mock-stranger"))
    assert r.status_code == 403
    assert c.post(f"/api/trips/{tid}/members", json={"email": "a@b.co", "role": "editor"},
                  headers=H("mock-aman")).status_code == 403  # editors can't invite


def test_invite_unknown_email_claimed_on_login(c):
    tid = trip_id(c)
    assert c.post(f"/api/trips/{tid}/members", json={"email": "newbie@x.com", "role": "editor"},
                  headers=H("mock-elena")).json()["status"] == "invited"
    c.post("/api/auth/mock-login", json={"email": "newbie@x.com"})
    assert any(m["email"] == "newbie@x.com" for m in c.get(f"/api/trips/{tid}/members", headers=H("mock-elena")).json()["members"])


def test_expense_balances_and_settle(c):
    tid, h = trip_id(c), H("mock-elena")
    before = c.get(f"/api/trips/{tid}/balances", headers=h).json()
    pairs = {(t["from_user"], t["to_user"]): float(t["amount"]) for t in before["transactions"]}
    assert pairs  # seed leaves Aman's baggage unsettled
    r = c.post(f"/api/trips/{tid}/expenses", headers=h, json={
        "merchant": "Test Cafe", "amount": "30.00", "category": "Food", "spent_on": "2026-10-16",
        "participants": ["mock-elena", "mock-aman", "mock-david"]})
    assert r.status_code == 201 and r.json()["per_person"] == "10.00"
    bad = c.post(f"/api/trips/{tid}/expenses", headers=h, json={
        "merchant": "X", "amount": "10", "spent_on": "2026-10-16", "split_mode": "custom",
        "shares": {"mock-elena": "3", "mock-aman": "3"}})
    assert bad.status_code == 422
    # settle everything the algorithm suggests -> all balances zero
    for _ in range(5):
        txs = c.get(f"/api/trips/{tid}/balances", headers=h).json()["transactions"]
        if not txs:
            break
        t = txs[0]
        c.post(f"/api/trips/{tid}/settle", headers=h, json={"from_user": t["from_user"], "to_user": t["to_user"], "amount": t["amount"]})
    after = c.get(f"/api/trips/{tid}/balances", headers=h).json()
    assert after["transactions"] == [] and all(abs(float(n["amount"])) < 0.01 for n in after["net"])
    # settlement payments are not counted as spend
    assert float(c.get(f"/api/trips/{tid}/dashboard", headers=h).json()["kpis"]["total_spent"]) == 1620.5


def test_settle_rejects_overpayment(c):
    tid = trip_id(c)
    r = c.post(f"/api/trips/{tid}/settle", headers=H("mock-elena"),
               json={"from_user": "mock-elena", "to_user": "mock-aman", "amount": "9999"})
    assert r.status_code == 422


def test_dashboard_shape(c):
    d = c.get(f"/api/trips/{trip_id(c)}/dashboard", headers=H("mock-elena")).json()
    assert d["categories"][0]["category"] == "Accommodation" and d["counts"]["checklist_total"] == 7
    assert d["recommendations"]["tips"]


def test_presign_validates_type_and_size(c):
    tid, h = trip_id(c), H("mock-elena")
    url = f"/api/trips/{tid}/documents/presign-upload"
    assert c.post(url, headers=h, json={"filename": "a.exe", "content_type": "application/x-msdownload", "size": 5}).status_code == 422
    assert c.post(url, headers=h, json={"filename": "a.pdf", "content_type": "application/pdf", "size": 11 * 1024 * 1024}).status_code == 422
    ok = c.post(url, headers=h, json={"filename": "a.pdf", "content_type": "application/pdf", "size": 1000})
    assert ok.status_code == 200 and ok.json()["s3_key"].startswith(f"trips/{tid}/documents/")


def test_register_rejects_foreign_key(c):
    tid = trip_id(c)
    r = c.post(f"/api/trips/{tid}/documents", headers=H("mock-elena"),
               json={"name": "x.pdf", "s3_key": "trips/other/documents/x.pdf", "content_type": "application/pdf"})
    assert r.status_code == 400
