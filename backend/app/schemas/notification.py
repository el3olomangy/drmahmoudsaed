from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime

class NotificationType(str, Enum):
    announcement = "announcement"
    new_course = "new_course"
    new_lecture = "new_lecture"
    new_homework = "new_homework"
    new_assignment = "new_assignment"
    new_exam = "new_exam"
    exam_result = "exam_result"
    exam_reviewed = "exam_reviewed"
    code_activated = "code_activated"
    subscription_expiry = "subscription_expiry"
    assignment_missed = "assignment_missed"
    exam_missed = "exam_missed"

class NotificationCreate(BaseModel):
    title: str = Field(..., min_length=2)
    body: str = Field(..., min_length=2)
    notification_type: NotificationType = NotificationType.announcement
    target_grade: Optional[str] = None
    target_user_id: Optional[str] = None

class NotificationResponse(BaseModel):
    id: str
    title: str
    body: str
    notification_type: str  # str بدل enum عشان يقبل أي قيمة جديدة من غير ما يكسر
    is_read: bool = False
    created_at: datetime