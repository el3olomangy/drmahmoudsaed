from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

class UserRole(str, Enum):
    teacher = "teacher"
    assistant = "assistant"
    student = "student"

class Gender(str, Enum):
    male = "male"
    female = "female"

class Grade(str, Enum):
    first_preparatory  = "first_preparatory"
    second_preparatory = "second_preparatory"
    third_preparatory  = "third_preparatory"
    first_secondary    = "first_secondary"
    second_secondary   = "second_secondary"
    third_secondary    = "third_secondary"

class UserRegister(BaseModel):
    first_name: str = Field(..., min_length=2)
    last_name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=11, max_length=11)
    parent_phone: str = Field(..., min_length=11, max_length=11)
    password: str = Field(..., min_length=6)
    gender: Gender
    grade: Grade
    governorate: str

class UserLogin(BaseModel):
    phone: str
    password: str
    device_id: str

class UserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    phone: str
    role: UserRole
    grade: Optional[Grade] = None
    governorate: Optional[str] = None
    gender: Optional[Gender] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse