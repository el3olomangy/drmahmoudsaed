from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime

class CodeType(str, Enum):
    course = "course"
    bundle = "bundle"

class CodeStatus(str, Enum):
    active = "active"
    used = "used"
    disabled = "disabled"

class CodeGenerate(BaseModel):
    course_id: Optional[str] = None
    bundle_ids: Optional[List[str]] = None
    code_type: CodeType = CodeType.course
    quantity: int = Field(default=1, ge=1, le=500)
    expires_days: Optional[int] = None

class CodeActivate(BaseModel):
    code: str

class CodeResponse(BaseModel):
    id: str
    code: str
    code_type: CodeType
    status: CodeStatus
    course_id: Optional[str] = None
    bundle_ids: Optional[List[str]] = None
    used_by: Optional[str] = None
    used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime