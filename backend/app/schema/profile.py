from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProfileRead(BaseModel):
    id: UUID
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    """Only what a user may safely change about themselves.

    Email is absent on purpose: it is the login identity and there is no
    verification flow, so a typo would lock the account out. `role` is absent so a
    customer cannot promote themselves.
    """

    full_name: Optional[str] = Field(default=None, max_length=255)
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordChangeResponse(BaseModel):
    message: str
    # Returned so the device that changed the password stays signed in even though
    # every session was revoked.
    access_token: str
    refresh_token: str
    token_type: str
