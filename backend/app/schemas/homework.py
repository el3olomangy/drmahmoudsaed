from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class HQuestionType(str, Enum):
    mcq = "mcq"
    essay = "essay"


class HChoiceCreate(BaseModel):
    text: str
    is_correct: bool = False


class HQuestionCreate(BaseModel):
    text: str = ""
    question_type: HQuestionType = HQuestionType.mcq
    choices: Optional[List[HChoiceCreate]] = None
    correct_answer: Optional[str] = None
    points: int = 1
    image_url: Optional[str] = None
    image_path: Optional[str] = None


class HAnswerSubmit(BaseModel):
    question_id: str
    selected_choice: Optional[str] = None
    essay_answer: Optional[str] = None
    # إجابة السؤال المقالي بتكون صورة يرفعها الطالب (بدل الكتابة)
    essay_answer_image_url: Optional[str] = None
    essay_answer_image_path: Optional[str] = None


class HomeworkSubmit(BaseModel):
    homework_id: str
    answers: List[HAnswerSubmit]


# ====== جلسة الواجب (المسودة على السيرفر) ======

class HSaveAnswerRequest(BaseModel):
    """حفظ إجابة سؤال واحد فورًا أثناء الحل (auto-save)."""
    session_token: str
    question_id: str
    selected_choice: Optional[str] = None
    essay_answer: Optional[str] = None
    essay_answer_image_url: Optional[str] = None
    essay_answer_image_path: Optional[str] = None


class HSubmitAttemptRequest(BaseModel):
    """تسليم نهائي للواجب من الطالب (زر تسليم)."""
    session_token: str


class HomeworkResult(BaseModel):
    homework_id: str
    student_id: str
    score: float
    passed: bool
    total_points: int
    earned_points: int
    submitted_at: datetime
    answers: List[dict] = []


class HomeworkCreate(BaseModel):
    title: str = Field(..., min_length=3)
    lecture_id: Optional[str] = None
    unit_id: Optional[str] = None
    course_id: str
    pass_score: int = Field(default=50, ge=0, le=100)
    show_result_immediately: bool = True
    questions: List[HQuestionCreate] = []
    scheduled_at: Optional[str] = None
    deadline: Optional[str] = None  # لو فاضي الواجب هيفضل متاح من غير موعد تسليم
