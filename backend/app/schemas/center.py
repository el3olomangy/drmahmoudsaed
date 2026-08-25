"""نماذج نظام السنتر (حضور + مدفوعات) — منفصل تمامًا عن طلاب المنصة الأونلاين."""

from pydantic import BaseModel, Field
from typing import Optional, List


# ====== المراحل ======

class StageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class StageUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


# ====== المجموعات ======

class GroupCreate(BaseModel):
    stage_id: str
    name: str = Field(..., min_length=1, max_length=100)


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    stage_id: Optional[str] = None


# ====== الطلاب ======

class StudentCreate(BaseModel):
    group_id: str
    name: str = Field(..., min_length=1, max_length=150)
    student_number: str = Field(..., min_length=1, max_length=50)
    parent_phone: str = Field(..., min_length=1, max_length=30)
    monthly_fee: float = Field(..., ge=0)


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    student_number: Optional[str] = Field(None, min_length=1, max_length=50)
    parent_phone: Optional[str] = Field(None, min_length=1, max_length=30)
    monthly_fee: Optional[float] = Field(None, ge=0)
    group_id: Optional[str] = None


# ====== المدفوعات ======

class PaymentCreate(BaseModel):
    # الشهر بصيغة YYYY-MM (لو مش متبعت بياخد الشهر الحالي)
    month: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}$")
    # المبلغ (لو مش متبعت بياخد اشتراك الطالب الشهري)
    amount: Optional[float] = Field(None, ge=0)
    note: Optional[str] = Field(None, max_length=300)


# ====== الاسكان (تسجيل الحضور) ======

class ScanRequest(BaseModel):
    qr_token: str = Field(..., min_length=1)
    # وقت الاسكان من جهاز اللي بيسجّل (اختياري — مفيد للأوفلاين)
    client_time: Optional[str] = None


class ScanItem(BaseModel):
    qr_token: str = Field(..., min_length=1)
    client_time: Optional[str] = None


class ScanBatchRequest(BaseModel):
    """رفع دفعة من عمليات الاسكان اللي اتعملت أوفلاين (تزامن)."""
    scans: List[ScanItem] = Field(..., min_length=1)


# ====== الحضور اليدوي (بالإيد من غير اسكان) ======

class ManualAttendanceRequest(BaseModel):
    student_id: str
    # التاريخ بصيغة YYYY-MM-DD (لو مش متبعت بياخد النهاردة)
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
