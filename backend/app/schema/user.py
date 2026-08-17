from pydantic import BaseModel, EmailStr
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
    token_type: str
    user: AuthUser

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
