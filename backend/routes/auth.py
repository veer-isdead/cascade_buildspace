import hashlib
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from backend.db import DatabaseManager, get_db
from backend.models.user import User, UserLoginRequest, UserSignupRequest


router = APIRouter(tags=["Authentication"])


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


@router.post("/signup", summary="Register a new Cascade operator")
def signup(payload: UserSignupRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    existing_user = database.find_one("users", {"email": payload.email.lower()})
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists.")

    user = User(
        id=str(uuid4()),
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        password_hash=_hash_password(payload.password),
        role=payload.role,
        created_at=datetime.utcnow(),
    )
    database.insert_one("users", user.model_dump(mode="json"))
    return {
        "message": "Signup successful.",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@router.post("/login", summary="Log in to the Cascade control plane")
def login(payload: UserLoginRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    user = database.find_one("users", {"email": payload.email.lower().strip()})
    if not user or user.get("password_hash") != _hash_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    return {
        "message": "Login successful.",
        "token": f"session-{user['id']}",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        },
    }
