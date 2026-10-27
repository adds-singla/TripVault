"""S3 helpers. On AWS the EC2 IAM role supplies credentials; locally files are stored on disk."""
import os
import re
import uuid
import shutil
from pathlib import Path
from app.config import get_settings

ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                 "application/pdf": "pdf", "application/vnd.apple.pkpass": "pkpass"}
SUBFOLDERS = ("documents", "receipts", "photos")

# Local storage root (used when S3 is not configured)
LOCAL_ROOT = Path(__file__).parent.parent / "local_storage"


def _use_local() -> bool:
    """Use local disk when no real S3 endpoint / AWS creds are configured."""
    s = get_settings()
    has_endpoint = bool(s.s3_endpoint_url)
    has_creds = bool(os.environ.get("AWS_ACCESS_KEY_ID") or os.environ.get("AWS_PROFILE"))
    return not (has_endpoint or has_creds)


def _client(endpoint: str):
    import boto3
    from botocore.client import Config
    s = get_settings()
    return boto3.client(
        "s3", region_name=s.aws_region, endpoint_url=endpoint or None,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def internal_client():
    return _client(get_settings().s3_endpoint_url)


def presign_client():
    s = get_settings()
    return _client(s.s3_public_endpoint_url or s.s3_endpoint_url)


def build_key(trip_id: str, subfolder: str, content_type: str) -> str:
    if subfolder not in SUBFOLDERS:
        raise ValueError("bad subfolder")
    return f"trips/{trip_id}/{subfolder}/{uuid.uuid4()}.{ALLOWED_TYPES[content_type]}"


def validate_upload(content_type: str, size: int) -> None:
    s = get_settings()
    if content_type not in ALLOWED_TYPES:
        raise ValueError("Only images, PDFs and .pkpass files are allowed")
    if not 0 < size <= s.max_upload_bytes:
        raise ValueError("File must be between 1 byte and 10 MB")


# ── Local-disk presigned URL helpers ──────────────────────────────────────────
_UPLOAD_TOKENS: dict[str, str] = {}   # token -> s3_key


def _local_upload_url(key: str) -> tuple[str, dict]:
    """Return a fake 'presigned' URL that hits our own /api/local-upload endpoint."""
    token = str(uuid.uuid4())
    _UPLOAD_TOKENS[token] = key
    return f"/api/local-upload?token={token}", {"Content-Type": "application/octet-stream"}


def _local_download_url(key: str) -> str:
    return f"/api/local-download?key={key}"


def _local_path(key: str) -> Path:
    p = LOCAL_ROOT / key
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


# ── Public API ─────────────────────────────────────────────────────────────────

def presign_upload(key: str, content_type: str, expires: int = 300) -> tuple[str, dict[str, str]]:
    if _use_local():
        return _local_upload_url(key)
    cfg = get_settings()
    params = {"Bucket": cfg.s3_bucket, "Key": key, "ContentType": content_type}
    headers: dict[str, str] = {"Content-Type": content_type}
    if not cfg.s3_endpoint_url:
        params["ServerSideEncryption"] = "AES256"
        headers["x-amz-server-side-encryption"] = "AES256"
    return presign_client().generate_presigned_url("put_object", Params=params, ExpiresIn=expires), headers


def presign_download(key: str, filename: str = "file", expires: int = 300) -> str:
    if _use_local():
        return _local_download_url(key)
    safe = re.sub(r'[^A-Za-z0-9._ -]', "_", filename)
    return presign_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": get_settings().s3_bucket, "Key": key,
                "ResponseContentDisposition": f'inline; filename="{safe}"'},
        ExpiresIn=expires,
    )


def ensure_bucket() -> None:
    if _use_local():
        LOCAL_ROOT.mkdir(parents=True, exist_ok=True)
        return
    c, b = internal_client(), get_settings().s3_bucket
    try:
        c.head_bucket(Bucket=b)
    except Exception:
        c.create_bucket(Bucket=b)


def head_object(key: str) -> dict | None:
    if _use_local():
        p = LOCAL_ROOT / key
        if not p.exists():
            return None
        return {"ContentLength": p.stat().st_size, "ContentType": "application/octet-stream"}
    try:
        return internal_client().head_object(Bucket=get_settings().s3_bucket, Key=key)
    except Exception:
        return None


def get_bytes(key: str) -> bytes:
    if _use_local():
        return (LOCAL_ROOT / key).read_bytes()
    return internal_client().get_object(Bucket=get_settings().s3_bucket, Key=key)["Body"].read()


def delete_object(key: str) -> None:
    if _use_local():
        p = LOCAL_ROOT / key
        if p.exists():
            p.unlink()
        return
    try:
        internal_client().delete_object(Bucket=get_settings().s3_bucket, Key=key)
    except Exception:
        pass


# ── Local upload/download endpoint helpers (called from routers/core.py) ──────

def save_local_upload(token: str, data: bytes) -> str:
    """Write uploaded bytes to disk; returns the s3_key."""
    key = _UPLOAD_TOKENS.pop(token, None)
    if not key:
        raise ValueError("Invalid or expired upload token")
    _local_path(key).write_bytes(data)
    return key


def resolve_local_token(token: str) -> str | None:
    return _UPLOAD_TOKENS.get(token)
