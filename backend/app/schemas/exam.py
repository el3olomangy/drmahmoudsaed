from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime

class QuestionType(str, Enum):
    mcq = "mcq"
    essay = "essay"

class ChoiceCreate(BaseModel):
    text: str
    is_correct: bool = False

class QuestionCreate(BaseModel):
    text: str = ""
    question_type: QuestionType = QuestionType.mcq
    choices: Optional[List[ChoiceCreate]] = None
    correct_answer: Optional[str] = None
    points: int = 1
    image_url: Optional[str] = None
    image_path: Optional[str] = None

class AnswerSubmit(BaseModel):
    question_id: str
    selected_choice: Optional[str] = None
    essay_answer: Optional[str] = None
    # إجابة السؤال المقالي بتكون صورة يرفعها الطالب (بدل الكتابة)
    essay_answer_image_url: Optional[str] = None
    essay_answer_image_path: Optional[str] = None

class ExamSubmit(BaseModel):
    exam_id: str
    answers: List[AnswerSubmit]


# ====== جلسة الامتحان (النظام البروفيشنال: الوقت والمسودة على السيرفر) ======

class SaveAnswerRequest(BaseModel):
    """حفظ إجابة سؤال واحد فورًا أثناء الحل (auto-save)."""
    session_token: str
    question_id: str
    selected_choice: Optional[str] = None
    essay_answer: Optional[str] = None
    essay_answer_image_url: Optional[str] = None
    essay_answer_image_path: Optional[str] = None


class SubmitAttemptRequest(BaseModel):
    """تسليم نهائي للامتحان من الطالب (زر إنهاء)."""
    session_token: str

class ExamResult(BaseModel):
    exam_id: str
    student_id: str
    score: float
    passed: bool
    total_points: int
    earned_points: int
    submitted_at: datetime
    answers: List[dict] = []

class ExamCreate(BaseModel):
    title: str = Field(..., min_length=3)
    lecture_id: Optional[str] = None
    unit_id: Optional[str] = None
    course_id: str
    duration_minutes: int = Field(default=30, ge=5)
    pass_score: int = Field(default=50, ge=0, le=100)
    show_result_immediately: bool = True
    scheduled_at: Optional[str] = None
    available_until: Optional[str] = None
    questions: List[QuestionCreate] = []