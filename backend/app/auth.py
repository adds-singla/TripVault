"""Authentication.

AUTH_MODE=mock    -> local dev only. The caller is identified by the X-Mock-User header
                     (default MOCK_DEFAULT_USER). Refused when APP_ENV=production.
AUTH_MODE=cognito -> verifies the Cognito ID/access JWT against the user pool JWKS.
"""
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import User


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True)


def _verify_cognito(token: str, s: Settings) -> dict:
    issuer = f"https://cognito-idp.{s.cognito_region}.amazonaws.com/{s.cognito_user_pool_id}"
    try:
        key = _jwks_client(f"{issuer}/.well-known/jwks.json").get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["RS256"], issuer=issuer,
                            options={"verify_aud": False})
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    # ID tokens carry aud; access tokens carry client_id.
    if claims.get("aud", claims.get("client_id")) != s.cognito_app_client_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token not issued for this app")
    return claims


def get_current_user(
    authorization: str | None = Header(default=None),
    x_mock_user: str | None = Header(default=None),
    db: Session = Depends(get_db),
    s: Settings = Depends(get_settings),
) -> User:
    if s.auth_mode == "mock":
        if s.app_env == "production":
            raise HTTPException(500, "Mock auth is not allowed in production")
        user = db.get(User, x_mock_user or s.mock_default_user)
        if not user:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown mock user (run the seed script)")
        return user

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    claims = _verify_cognito(authorization.split(" ", 1)[1], s)
    sub = claims["sub"]
    user = db.get(User, sub)
    if not user:  # first login: create the profile row (users.id = Cognito sub)
        user = User(id=sub, email=claims.get("email", f"{sub}@unknown"),
                    name=claims.get("name") or claims.get("email", "").split("@")[0])
        db.add(user)
        db.commit()
    return user
