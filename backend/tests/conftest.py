import os
import tempfile
from pathlib import Path

# Must be set before any app module is imported so the engine binds to the temp DB.
_TMPDIR = tempfile.mkdtemp(prefix="r53-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMPDIR}/test.db"

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Delete order respects foreign keys (children first).
_TABLES = (
    "resource_records",
    "record_sets",
    "delegation_name_servers",
    "hosted_zone_tags",
    "hosted_zone_vpcs",
    "hosted_zones",
    "sessions",
    "changes",
    "users",
)


@pytest.fixture(scope="session", autouse=True)
def apply_migrations():
    """Prove the Alembic migration is correct: the test DB is built only from it."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def clean_db(apply_migrations):
    yield
    with engine.begin() as conn:
        for table in _TABLES:
            conn.execute(text(f"DELETE FROM {table}"))


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def create_user(db, username="demo", password="route53demo", account_id="123456789012"):
    user = User(
        username=username,
        password_hash=hash_password(password),
        account_id=account_id,
        display_name=f"{username}-user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user(db):
    return create_user(db)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_client(client, user):
    resp = client.post(
        "/api/v1/auth/login", json={"username": "demo", "password": "route53demo"}
    )
    assert resp.status_code == 200, resp.text
    return client


@pytest.fixture
def other_client(db):
    create_user(db, username="other", password="otherpass", account_id="999999999999")
    other = TestClient(app)
    resp = other.post(
        "/api/v1/auth/login", json={"username": "other", "password": "otherpass"}
    )
    assert resp.status_code == 200, resp.text
    return other


@pytest.fixture
def make_zone(auth_client):
    def _make(name="example.com", **kwargs):
        resp = auth_client.post("/api/v1/hostedzones", json={"name": name, **kwargs})
        assert resp.status_code == 201, resp.text
        return resp.json()

    return _make


@pytest.fixture
def make_records(auth_client):
    def _make(zone_id, payload, expect=201):
        resp = auth_client.post(f"/api/v1/hostedzones/{zone_id}/records", json=payload)
        assert resp.status_code == expect, resp.text
        return resp.json()

    return _make
