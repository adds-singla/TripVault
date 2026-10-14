"""TripVault API entrypoint. Served under /api (CloudFront forwards /api/* to EC2)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from contextlib import asynccontextmanager
from app import storage
from app.routers import content, core, expenses, files, trips

s = get_settings()
@asynccontextmanager
async def lifespan(_: FastAPI):
    if s.s3_endpoint_url:  # local MinIO: create the bucket if missing
        try:
            storage.ensure_bucket()
        except Exception as exc:  # don't crash the API if MinIO is down
            print("MinIO bucket check failed:", type(exc).__name__)
    yield


app = FastAPI(title="TripVault API", version="1.0.0", lifespan=lifespan,
              docs_url=f"{s.api_prefix}/docs", openapi_url=f"{s.api_prefix}/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=s.cors_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
for r in (core.router, trips.router, content.router, files.router, expenses.router):
    app.include_router(r, prefix=s.api_prefix)
