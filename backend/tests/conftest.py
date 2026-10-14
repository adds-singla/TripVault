import os

# Must be set before app modules are imported (settings are cached).
os.environ.update(DATABASE_URL="sqlite:///./test.db", AUTH_MODE="mock", S3_ENDPOINT_URL="",
                  AWS_ACCESS_KEY_ID="test", AWS_SECRET_ACCESS_KEY="test", AWS_DEFAULT_REGION="ap-south-1")

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    if os.path.exists("test.db"):
        os.remove("test.db")
    command.upgrade(Config("alembic.ini"), "head")
    from scripts.seed import run
    run()
    from app.main import app
    yield TestClient(app)
    os.remove("test.db")
