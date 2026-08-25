"""
مسار الـ Cron — بديل الـ scheduler الخلفي على الاستضافة serverless (Vercel).

على Vercel الـ loop الخلفي مابيشتغلش لأن الفنكشن بيتجمّد بعد الطلب، فبنخلي
Vercel Cron ينده المسار ده كل شوية عشان:
  - يسلّم تلقائيًا جلسات الامتحان/الواجب اللي خلص وقتها (الطالب اللي قفل الصفحة).
  - يبعت إشعارات "لم تسلّم" للمواعيد المنتهية.

الأمان: لازم يجي هيدر Authorization: Bearer <CRON_SECRET> (أو X-Cron-Secret)
مطابق للسر المضبوط في البيئة. من غير ما CRON_SECRET يتضبط، المسار مقفول تمامًا.
"""
from __future__ import annotations

import hmac
from fastapi import APIRouter, HTTPException, Request

from ...core.config import settings
from ...core.database import get_db
from ...core.scheduler import run_all_checks_once

router = APIRouter(prefix="/cron", tags=["Cron"])


def _authorized(request: Request) -> bool:
    secret = settings.CRON_SECRET
    if not secret:
        # من غير سر مضبوط، المسار مقفول — أأمن من إنه يفضل مفتوح بالغلط
        return False
    provided = request.headers.get("x-cron-secret")
    if not provided:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            provided = auth[7:].strip()
    if not provided:
        return False
    # مقارنة ثابتة الوقت تمنع timing attacks
    return hmac.compare_digest(provided, secret)


@router.get("/deadline-checks")
@router.post("/deadline-checks")
async def deadline_checks(request: Request):
    if not _authorized(request):
        raise HTTPException(status_code=401, detail="غير مصرح")
    await run_all_checks_once(get_db())
    return {"status": "ok", "ran": "deadline-checks"}
