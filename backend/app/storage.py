"""S3 helpers. On AWS the EC2 IAM role supplies credentials; locally MinIO is used."""
import re
import uuid
import boto3
from botocore.client import Config
from app.config import get_settings

ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                 "application/pdf": "pdf", "application/vnd.apple.pkpass": "pkpass"}
SUBFOLDERS = ("documents", "receipts", "photos")


def _client(endpoint: str):
    s = get_settings()
    return boto3.client("s3", region_name=s.aws_region, endpoint_url=endpoint or None,
                        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}))


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


def presign_upload(key: str, content_type: str, expires: int = 300) -> tuple[str, dict[str, str]]:
    """Returns (url, headers the browser MUST send with the PUT)."""
    cfg = get_settings()
    params = {"Bucket": cfg.s3_bucket, "Key": key, "ContentType": content_type}
    headers = {"Content-Type": content_type}
    if not cfg.s3_endpoint_url:  # real AWS S3: enforce SSE-S3 (AES-256); MinIO has no KMS configured
        params["ServerSideEncryption"] = "AES256"
        headers["x-amz-server-side-encryption"] = "AES256"
    return presign_client().generate_presigned_url("put_object", Params=params, ExpiresIn=expires), headers


def presign_download(key: str, filename: str, expires: int = 300) -> str:
    safe = re.sub(r'[^A-Za-z0-9._ -]', "_", filename)
    return presign_client().generate_presigned_url(
        "get_object", Params={"Bucket": get_settings().s3_bucket, "Key": key,
                              "ResponseContentDisposition": f'inline; filename="{safe}"'}, ExpiresIn=expires)


def ensure_bucket() -> None:
    """Local MinIO convenience; on AWS the bucket is created by hand (see /infra)."""
    c, b = internal_client(), get_settings().s3_bucket
    try:
        c.head_bucket(Bucket=b)
    except Exception:
        c.create_bucket(Bucket=b)


def head_object(key: str) -> dict | None:
    try:
        return internal_client().head_object(Bucket=get_settings().s3_bucket, Key=key)
    except Exception:
        return None


def get_bytes(key: str) -> bytes:
    return internal_client().get_object(Bucket=get_settings().s3_bucket, Key=key)["Body"].read()


def delete_object(key: str) -> None:
    try:
        internal_client().delete_object(Bucket=get_settings().s3_bucket, Key=key)
    except Exception:
        pass
