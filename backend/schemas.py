from pydantic import BaseModel, EmailStr
from database import UserRole
from typing import Optional

class UserCreate(BaseModel):
    username: str
    nickname: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.CLIENT
    founder_secret_key: str = None

class UserResponse(BaseModel):
    id: int
    username: str
    nickname: str | None = None 
    email: str
    role: UserRole
    balance: float = 0.0

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class GameCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = "games"
    image_url: Optional[str] = None
    icon_url: Optional[str] = None

class GameResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = "games"
    image_url: Optional[str] = None
    icon_url: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True

class ServiceCreate(BaseModel):
    title: str
    description: str = None
    price: float
    game_id: int
    image_url: Optional[str] = None

class ServiceResponse(BaseModel):
    id: int
    title: str
    description: str = None
    price: float
    game_id: int
    provider_id: int

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    service_id: int

class OrderResponse(BaseModel):
    id: int
    client_id: int
    service_id: int
    provider_id: int | None = None
    provider_username: str | None = None  
    status: str

    class Config:
        from_attributes = True