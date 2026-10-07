API = "/api/v1"


def test_login_success_me_and_cookie(client, user):
    resp = client.post(
        f"{API}/auth/login", json={"username": "demo", "password": "route53demo"}
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "username": "demo",
        "display_name": "demo-user",
        "account_id": "123456789012",
    }
    assert "r53_session" in resp.cookies
    assert client.get(f"{API}/auth/me").json()["username"] == "demo"


def test_login_wrong_password(client, user):
    resp = client.post(f"{API}/auth/login", json={"username": "demo", "password": "nope"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "NotAuthenticated"


def test_me_requires_auth(client):
    resp = client.get(f"{API}/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "NotAuthenticated"
    assert client.get(f"{API}/hostedzones").status_code == 401


def test_logout_invalidates_session(auth_client):
    assert auth_client.post(f"{API}/auth/logout").status_code == 204
    assert auth_client.get(f"{API}/auth/me").status_code == 401
