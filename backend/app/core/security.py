import uuid

from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from app.schema import user
from app.database import models, db
from fastapi import Depends, status, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/auth/login')

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

# Tokens carry their kind so a long-lived refresh token cannot be replayed as an
# access token (and vice versa).
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

# Optional `iss` / `aud` scoping. Both off unless configured.
#
# These settings existed and were read by nothing: a deployment could set
# JWT_ISSUER, reasonably believe tokens were now issuer-scoped, and get no
# validation at all. Config that reads as a security control and silently does
# nothing is worse than no setting.
#
# Turning either on invalidates tokens already issued — they carry no `iss`/`aud`
# — so everyone signs in again once. That is the correct behaviour for enabling
# a check, but it should not be a surprise.
JWT_ISSUER = settings.JWT_ISSUER
JWT_AUDIENCE = settings.JWT_AUDIENCE


def _encode(data: dict, *, token_type: str, expires_delta: timedelta) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + expires_delta
    to_encode = data.copy()
    to_encode.update({
        "exp": expires_at,
        "typ": token_type,
    })
    if JWT_ISSUER:
        to_encode["iss"] = JWT_ISSUER
    if JWT_AUDIENCE:
        to_encode["aud"] = JWT_AUDIENCE
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM), expires_at


def create_access_token(data: dict) -> str:
    token, _ = _encode(
        data,
        token_type=ACCESS_TOKEN_TYPE,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return token


def create_refresh_token(data: dict) -> tuple[str, str, datetime]:
    """Return (token, jti, expires_at).

    The `jti` is recorded server-side so the token can be revoked before it
    expires; see `app.database.models.refresh_token.RefreshToken`.
    """
    jti = uuid.uuid4().hex
    token, expires_at = _encode(
        {**data, "jti": jti},
        token_type=REFRESH_TOKEN_TYPE,
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return token, jti, expires_at


def _decode(token: str, *, expected_type: str, credentials_exception):
    verify_kwargs = {}
    if JWT_ISSUER:
        verify_kwargs["issuer"] = JWT_ISSUER
    if JWT_AUDIENCE:
        verify_kwargs["audience"] = JWT_AUDIENCE

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], **verify_kwargs)
    except JWTError:
        raise credentials_exception

    # `audience=` alone is not a gate: python-jose accepts a token with no `aud`
    # claim at all even when an audience is expected. Only `iss` is rejected on
    # absence. So the presence check has to be made here, or configuring an
    # audience would buy nothing against a token that simply omits it.
    if JWT_AUDIENCE and not payload.get("aud"):
        raise credentials_exception

    if payload.get("typ") != expected_type:
        raise credentials_exception

    user_id = payload.get("user_id")
    if user_id is None:
        raise credentials_exception

    return user.TokenData(id=user_id, role=payload.get("role")), payload


def verify_access_token(token: str, credentials_exception):
    """Verify an access token and return TokenData."""
    token_data, _ = _decode(
        token, expected_type=ACCESS_TOKEN_TYPE, credentials_exception=credentials_exception
    )
    return token_data


def verify_refresh_token(token: str, credentials_exception):
    """Verify a refresh token and return (TokenData, jti).

    A refresh token without a `jti` predates revocation support and is refused,
    since it could not be revoked.
    """
    token_data, payload = _decode(
        token, expected_type=REFRESH_TOKEN_TYPE, credentials_exception=credentials_exception
    )
    jti = payload.get("jti")
    if not jti:
        raise credentials_exception
    return token_data, jti


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(db.get_db)):
    """Dependency to get the current user from the token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = verify_access_token(token, credentials_exception)
    current_user = db.query(models.User).filter(models.User.id == token_data.id).first()
    if current_user is None:
        raise credentials_exception

    # An account disabled after this token was issued stops working now, not in
    # thirty minutes when the token expires. This is the reason the row is read
    # at all: the token already carries the id and the role, so without this
    # check the query would only be catching deleted accounts.
    #
    # 401 rather than 403, so the client treats it as a dead session and signs
    # them out instead of leaving them on a page where nothing works.
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been disabled.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return current_user
