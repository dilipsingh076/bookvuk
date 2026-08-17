from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.schema.user import AuthResponse, RegisterRequest
from ...database import db, models
from ...utils import utils
from ...core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", response_model=AuthResponse)
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

    token = create_access_token({"user_id": str(new_user.id), "role": new_user.role})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "name": new_user.full_name or new_user.username,
            "email": new_user.email,
            "role": new_user.role,
        },
    }

@router.post("/login", response_model=AuthResponse)
def login(user_credentails: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(db.get_db)):
    user_db = db.query(models.User).filter(models.User.email == user_credentails.username).first()
    if not user_db or not utils.verify(user_credentails.password, user_db.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"user_id": str(user_db.id), "role": user_db.role})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_db.id,
            "name": user_db.full_name or user_db.username,
            "email": user_db.email,
            "role": user_db.role,
        },
    }
