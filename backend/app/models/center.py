"""بناة وثائق نظام السنتر (حضور + مدفوعات)."""

from datetime import datetime, timezone
from ..core.database import new_id


def stage_doc(name: str, created_by: str) -> dict:
    """مرحلة دراسية (مثلاً: تالتة ثانوي)."""
    return {
        "name": name,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
    }


def group_doc(stage_id: str, name: str, created_by: str) -> dict:
    """مجموعة داخل مرحلة (مثلاً: مجموعة السبت 4 عصرًا)."""
    return {
        "stage_id": stage_id,
        "name": name,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
    }


def student_doc(group_id: str, stage_id: str, name: str, student_number: str,
                parent_phone: str, monthly_fee: float, qr_token: str,
                created_by: str) -> dict:
    """طالب سنتر — مجرد بيانات، مش حساب دخول للمنصة."""
    return {
        "group_id": group_id,
        "stage_id": stage_id,
        "name": name,
        "student_number": student_number,
        "parent_phone": parent_phone,
        "monthly_fee": monthly_fee,
        "qr_token": qr_token,          # التوكن اللي بيتحط في الـ QR
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
    }


def attendance_doc(student_id: str, group_id: str, stage_id: str, date_str: str,
                   recorded_by: str, was_paid: bool) -> dict:
    """تسجيل حضور طالب في يوم معيّن (سجل واحد لكل طالب في اليوم)."""
    return {
        "student_id": student_id,
        "group_id": group_id,
        "stage_id": stage_id,
        "date": date_str,              # YYYY-MM-DD (بتوقيت القاهرة)
        "recorded_by": recorded_by,
        "was_paid": was_paid,          # هل كان دافع وقت الحضور؟ (لقطة للتقارير)
        "created_at": datetime.now(timezone.utc),
    }


def payment_doc(student_id: str, month: str, amount: float, recorded_by: str,
                note: str = None) -> dict:
    """دفعة اشتراك شهري لطالب."""
    return {
        "student_id": student_id,
        "month": month,                # YYYY-MM
        "amount": amount,
        "note": note,
        "recorded_by": recorded_by,
        "paid_at": datetime.now(timezone.utc),
    }


def generate_qr_token() -> str:
    """توكن فريد للـ QR — بندمج معرّفين عشان يبقى أصعب في التخمين."""
    return f"{new_id()}{new_id()}"
