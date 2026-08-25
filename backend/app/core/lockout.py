"""
حماية ضد تخمين كلمة المرور (brute-force) بقفل تدريجي مخزّن في قاعدة البيانات.

ليه في قاعدة البيانات مش في الذاكرة؟ عشان يشتغل صح على serverless (Vercel)
اللي بيكون فيه أكتر من instance والذاكرة بتتصفّر — العداد لازم يكون مشترك.

السياسة تصاعدية: كل ما المحاولات الفاشلة تزيد، مدة القفل تكبر. وبينفتح
تلقائيًا بعد ما المدة تعدّي، وبيتصفّر خالص عند أول دخول ناجح أو لو عدّت
ساعة من غير محاولات (عشان مانعاقبش مستخدم شرعي نسي وافتكر).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from fastapi import HTTPException

# بعد كام محاولة فاشلة يبدأ القفل، ومدة كل مستوى (بالثواني)
_LOCK_TIERS = [
    (5, 60),        # المحاولة الخامسة: قفل دقيقة
    (7, 5 * 60),    # 7+: قفل 5 دقايق
    (9, 15 * 60),   # 9+: قفل ربع ساعة
    (12, 60 * 60),  # 12+: قفل ساعة
]
# لو عدّت المدة دي من غير أي محاولة، نصفّر العداد
_DECAY_AFTER = timedelta(hours=1)


def _aware(dt):
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return None
    if isinstance(dt, datetime):
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return None


def _lock_seconds_for(attempts: int) -> int:
    secs = 0
    for threshold, duration in _LOCK_TIERS:
        if attempts >= threshold:
            secs = duration
    return secs


def ensure_not_locked(user: dict) -> None:
    """يرفع 429 لو الحساب مقفول حاليًا بسبب محاولات فاشلة كتير."""
    locked_until = _aware(user.get("locked_until"))
    if not locked_until:
        return
    now = datetime.now(timezone.utc)
    if now < locked_until:
        remaining = int((locked_until - now).total_seconds())
        minutes = max(1, round(remaining / 60))
        raise HTTPException(
            status_code=429,
            detail=f"اتقفل الدخول مؤقتًا بسبب محاولات كتير غلط — حاول بعد حوالي {minutes} دقيقة.",
            headers={"Retry-After": str(remaining)},
        )


async def register_failure(db, user: dict) -> None:
    """يزوّد عداد المحاولات الفاشلة ويحدّد مدة القفل التصاعدية."""
    now = datetime.now(timezone.utc)
    last = _aware(user.get("last_failed_login"))
    attempts = int(user.get("failed_login_attempts") or 0)
    if last and (now - last) > _DECAY_AFTER:
        attempts = 0  # مرّت فترة طويلة — نبدأ من جديد
    attempts += 1

    update = {"failed_login_attempts": attempts, "last_failed_login": now}
    lock_secs = _lock_seconds_for(attempts)
    if lock_secs:
        update["locked_until"] = now + timedelta(seconds=lock_secs)
    await db.users.set_fields({"_id": user["_id"]}, {"$set": update})


async def reset_failures(db, user: dict) -> None:
    """يصفّر العداد عند نجاح الدخول."""
    if user.get("failed_login_attempts") or user.get("locked_until"):
        await db.users.set_fields(
            {"_id": user["_id"]},
            {"$set": {"failed_login_attempts": 0, "locked_until": None}},
        )
