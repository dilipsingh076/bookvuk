import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.schema.commerce import PasswordResetConfirm, PasswordResetRequest
from app.schema.user import (
    AccessTokenResponse,
    AuthResponse,
    RefreshRequest,
    RegisterRequest,
)
from ...core.config import settings
from ...core.jobs import enqueue
from ...core.ratelimit import RateLimiter, rate_limit_dependency
from ...database import db, models
from ...utils import utils
from ...core.security import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)


def _hash_token(raw: str) -> str:
    """Reset tokens are stored hashed; see PasswordResetToken."""
    return hashlib.sha256(raw.encode()).hexdigest()

router = APIRouter(prefix="/auth", tags=["Auth"])

login_limiter = RateLimiter(
    attempts=settings.LOGIN_RATE_LIMIT_ATTEMPTS,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    name="login",
)
register_limiter = RateLimiter(
    attempts=settings.REGISTER_RATE_LIMIT_ATTEMPTS,
    window_seconds=settings.REGISTER_RATE_LIMIT_WINDOW_SECONDS,
    name="registration",
)
# Reset requests send mail to whatever address is supplied, so they need a tighter
# cap than login: otherwise the endpoint is a free spam relay.
password_reset_limiter = RateLimiter(
    attempts=5,
    window_seconds=3600,
    name="password reset",
)


def _issue_tokens(db_session: Session, user: models.User) -> dict:
    """Mint an access/refresh pair and record the refresh token so it can be revoked."""
    claims = {"user_id": str(user.id), "role": user.role}
    refresh_token, jti, expires_at = create_refresh_token(claims)

    db_session.add(
        models.RefreshToken(jti=jti, user_id=user.id, expires_at=expires_at)
    )
    db_session.commit()

    return {
        "access_token": create_access_token(claims),
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.full_name or user.username,
            "email": user.email,
            "role": user.role,
        },
    }


@router.post(
    "/register",
    response_model=AuthResponse,
    dependencies=[Depends(rate_limit_dependency(register_limiter))],
)
def register(payload: RegisterRequest, db: Session = Depends(db.get_db)):
    existing_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pass = utils.hash_password(payload.password)

    new_user = models.User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hashed_pass,
        role="customer"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return _issue_tokens(db, new_user)


@router.post(
    "/login",
    response_model=AuthResponse,
    dependencies=[Depends(rate_limit_dependency(login_limiter))],
)
def login(
    request: Request,
    user_credentails: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(db.get_db),
):
    user_db = db.query(models.User).filter(models.User.email == user_credentails.username).first()
    if not user_db or not utils.verify(user_credentails.password, user_db.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Checked *after* the password, deliberately.
    #
    # Saying "this account is disabled" to anyone who types an e-mail address
    # would confirm the address exists. Once the password is right, the person
    # asking is the account holder, and they are owed the real reason rather
    # than "invalid credentials" — which would send them round the password
    # reset for a problem no new password can fix.
    #
    # `is_active` existed and was shown in the admin ("account disabled") but
    # was never read anywhere: a disabled customer could sign in and shop as
    # normal, so the admin's switch did nothing at all.
    if not user_db.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account has been disabled. Contact us if you think that is a mistake.",
        )

    # A legitimate user should not be locked out by their own earlier typos.
    login_limiter.reset(request)

    return _issue_tokens(db, user_db)


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(db.get_db)):
    """Exchange a valid, unrevoked refresh token for a new access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data, jti = verify_refresh_token(payload.refresh_token, credentials_exception)

    stored = (
        db.query(models.RefreshToken)
        .filter(models.RefreshToken.jti == jti)
        .first()
    )
    # Unknown jti means the record was purged; revoked means logged out.
    if stored is None or stored.revoked_at is not None:
        raise credentials_exception
    if stored.expires_at <= datetime.now(timezone.utc):
        raise credentials_exception

    # Re-read the user so a deleted account, or a role that changed since the
    # refresh token was issued, cannot keep minting valid access tokens.
    user_db = db.query(models.User).filter(models.User.id == token_data.id).first()
    if user_db is None:
        raise credentials_exception

    return {
        "access_token": create_access_token({"user_id": str(user_db.id), "role": user_db.role}),
        "token_type": "bearer",
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: Session = Depends(db.get_db)):
    """Revoke a refresh token.

    Deliberately returns 204 whether or not the token was valid: telling a caller
    which tokens exist would leak information, and a client logging out only
    needs to know it can discard its copy. The short-lived access token is not
    tracked and simply expires.
    """
    try:
        _, jti = verify_refresh_token(payload.refresh_token, HTTPException(status_code=401))
    except HTTPException:
        return None

    stored = db.query(models.RefreshToken).filter(models.RefreshToken.jti == jti).first()
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        db.commit()

    return None


@router.post(
    "/password-reset/request",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(rate_limit_dependency(password_reset_limiter))],
)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(db.get_db)):
    """Start a password reset.

    Always answers the same way whether or not the address exists: a different
    response would turn this into a way to discover who has an account.
    """
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if user is not None:
        # Invalidate outstanding tokens so only the newest link works.
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.used_at.is_(None),
        ).update({"used_at": datetime.now(timezone.utc)})

        raw_token = secrets.token_urlsafe(32)
        db.add(
            models.PasswordResetToken(
                token_hash=_hash_token(raw_token),
                user_id=user.id,
                expires_at=datetime.now(timezone.utc)
                + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
            )
        )
        # Queued in the same transaction as the token: a committed token always
        # has a queued email, and the caller does not wait on SMTP. Few attempts
        # because the token expires — retrying for hours would be pointless.
        enqueue(
            db,
            "password_reset_email",
            {
                "email": user.email,
                "name": user.full_name or user.username,
                "token": raw_token,
            },
            max_attempts=3,
        )
        db.commit()

    return {"message": "If that address has an account, a reset link is on its way."}


@router.post("/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(db.get_db)):
    """Set a new password using a reset token, then end every existing session."""
    invalid = HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    record = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token_hash == _hash_token(payload.token))
        .first()
    )
    if record is None or record.used_at is not None:
        raise invalid
    if record.expires_at <= datetime.now(timezone.utc):
        raise invalid

    user = db.query(models.User).filter(models.User.id == record.user_id).first()
    if user is None:
        raise invalid

    user.password_hash = utils.hash_password(payload.password)
    record.used_at = datetime.now(timezone.utc)

    # A reset usually means the account may be compromised, so drop every session.
    db.query(models.RefreshToken).filter(
        models.RefreshToken.user_id == user.id,
        models.RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.now(timezone.utc)})

    db.commit()

    return {"message": "Password updated. You can sign in now."}
