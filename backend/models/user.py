from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class User(BaseModel):
    id: str
    name: str
    email: str
    password_hash: str
    role: Literal["operator", "merchant", "admin"] = "operator"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserSignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Literal["operator", "merchant", "admin"] = "operator"


class UserLoginRequest(BaseModel):
    email: str
    password: str
