"""Profile: read your account, rename yourself, change your password.

Open to any signed-in user, not just customers — admins have profiles too, which
is why this uses `get_current_user` rather than `require_role`.

Email is deliberately read-only. It is the login identity and there is no
verification flow, so accepting a change here would let a typo lock someone out of
their own account permanently.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.ratelimit import RateLimiter, rate_limit_dependency
from app.core.security import create_access_token, create_refresh_token, get_current_user
from app.database import db, models
from app.schema.profile import (
    PasswordChangeRequest,
    PasswordChangeResponse,
    ProfileRead,
    ProfileUpdate,
)
from app.utils import utils

router = APIRouter(prefix="/api/profile", tags=["Profile"])

# Guessing the current password is the point of attacking this endpoint.
password_change_limiter = RateLimiter(attempts=10, window_seconds=900, name="password change")


def _to_read(user: models.User) -> ProfileRead:
    return ProfileRead(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        created_at=user.created_at,
    )


@router.get("", response_model=ProfileRead)
def get_profile(current_user=Depends(get_current_user)):
    return _to_read(current_user)


@router.patch("", response_model=ProfileRead)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(db.get_db),
    current_user=Depends(get_current_user),
):
    """Update the fields a user may safely change themselves.

    Only supplied fields are touched (`exclude_unset`), so sending just a name
    cannot blank out a username.
    """
    data = payload.model_dump(exclude_unset=True)

    if "username" in data and data["username"] != current_user.username:
        taken = (
            db.query(models.User)
            .filter(
                models.User.username == data["username"],
                models.User.id != current_user.id,
            )
            .first()
        )
        if taken:
            raise HTTPException(status_code=400, detail="That username is already taken.")
        current_user.username = data["username"]

    if "full_name" in data:
        current_user.full_name = data["full_name"]

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _to_read(current_user)


@router.post(
    "/password",
    response_model=PasswordChangeResponse,
    dependencies=[Depends(rate_limit_dependency(password_change_limiter))],
)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    db: Session = Depends(db.get_db),
    current_user=Depends(get_current_user),
):
    """Change the password after proving the current one.

    Every existing session is revoked, because a password change is how someone
    locks out whoever else was signed in. A fresh token pair is returned so the
    device making the change stays signed in rather than being logged out too.
    """
    if not utils.verify(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is not correct.")

    if utils.verify(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=400, detail="The new password must be different from the current one."
        )

    current_user.password_hash = utils.hash_password(payload.new_password)

    db.query(models.RefreshToken).filter(
        models.RefreshToken.user_id == current_user.id,
        models.RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.now(timezone.utc)})

    claims = {"user_id": str(current_user.id), "role": current_user.role}
    refresh_token, jti, expires_at = create_refresh_token(claims)
    db.add(models.RefreshToken(jti=jti, user_id=current_user.id, expires_at=expires_at))

    db.commit()

    # A successful change means the caller is legitimate; don't hold their own
    # earlier typos against them.
    password_change_limiter.reset(request)

    return PasswordChangeResponse(
        message="Password updated. Other devices have been signed out.",
        access_token=create_access_token(claims),
        refresh_token=refresh_token,
        token_type="bearer",
    )
