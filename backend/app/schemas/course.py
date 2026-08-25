from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from enum import Enum

class LectureType(str, Enum):
    free = "free"
    paid = "paid"

class CourseType(str, Enum):
    free = "free"
    paid = "paid"

class CourseCreate(BaseModel):
    title: str = Field(..., min_length=3)
    description: Optional[str] = None
    grade: str
    course_type: CourseType = CourseType.paid
    price: Optional[float] = None
    thumbnail: Optional[str] = None

    @model_validator(mode="after")
    def _validate_price_matches_type(self):
        # كورس مجاني: مفيش سعر ومفيش داعي لكود اشتراك — متاح مباشرة لأي طالب في المرحلة.
        # كورس مدفوع: لازم سعر بالجنيه المصري أكبر من صفر عشان يتباع بكود.
        if self.course_type == CourseType.free:
            self.price = None
        else:
            if self.price is None or self.price <= 0:
                raise ValueError("لازم تحدد سعر الكورس بالجنيه المصري لأنه كورس مدفوع")
        return self

class UnitCreate(BaseModel):
    title: str = Field(..., min_length=2)
    order: int = 1

class LectureCreate(BaseModel):
    title: str = Field(..., min_length=2)
    description: Optional[str] = None
    video_url: str
    pdf_url: Optional[str] = None
    order: int = 1
    lecture_type: LectureType = LectureType.paid
    duration_minutes: Optional[int] = None

class LectureUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    video_url: Optional[str] = None
    pdf_url: Optional[str] = None
    order: Optional[int] = None
    lecture_type: Optional[LectureType] = None
    duration_minutes: Optional[int] = None

class LectureResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None
    pdf_url: Optional[str] = None
    order: int
    lecture_type: LectureType
    duration_minutes: Optional[int] = None
    is_enrolled: bool = False

class UnitResponse(BaseModel):
    id: str
    title: str
    order: int
    lectures: List[LectureResponse] = []

class CourseResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    grade: str
    course_type: CourseType = CourseType.paid
    price: Optional[float] = None
    thumbnail: Optional[str] = None
    units: List[UnitResponse] = []
    is_enrolled: bool = False

class CourseListItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    grade: str
    course_type: CourseType = CourseType.paid
    price: Optional[float] = None
    thumbnail: Optional[str] = None
    lectures_count: int = 0
    is_enrolled: bool = False