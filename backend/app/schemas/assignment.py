from pydantic import BaseModel
from typing import Optional


class AssignmentCreate(BaseModel):
    title: str
    description: str
    lecture_id: str
    course_id: str
    deadline: Optional[str] = None  # ISO string مثل "2026-04-01T00:00:00"


class AssignmentSubmit(BaseModel):
    assignment_id: str
    text_answer: Optional[str] = None  # إجابة نصية


class AssignmentGrade(BaseModel):
    grade: float
    teacher_note: Optional[str] = None

