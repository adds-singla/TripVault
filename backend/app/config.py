"""Central configuration. Everything comes from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    auth_mode: str = "mock"  # "mock" | "cognito"
    database_url: str = "sqlite:///./tripvault.db"
    api_prefix: str = "/api"

    s3_bucket: str = "tripvault-files"
    s3_endpoint_url: str = ""         # set only for MinIO
    s3_public_endpoint_url: str = ""  # endpoint the browser can reach (MinIO)
    aws_region: str = "ap-south-1"

    cognito_region: str = "ap-south-1"
    cognito_user_pool_id: str = ""
    cognito_app_client_id: str = ""

    cors_origins: str = "http://localhost:3000"
    mock_default_user: str = "mock-elena"

    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
