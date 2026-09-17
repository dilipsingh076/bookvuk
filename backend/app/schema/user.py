from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from typing import Optional

class TokenData(BaseModel):
    id: str
    role: str

class AuthUser(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: AuthUser

class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str

class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: Optional[str] = Field(default=None, max_length=255)
    # Upper bound guards against unreasonably large hashing work per request.
    password: str = Field(..., min_length=8, max_length=128)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
