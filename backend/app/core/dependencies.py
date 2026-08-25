from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .security import decode_token
from datetime import datetime, timezone
from .database import get_db

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db)
):
    token = credentials.credentials
    payload = decode_token(token, token_type="access")

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token غير صالح أو منتهي"
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token غير صالح")

    user = await db.users.get_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="المستخدم مش موجود")

    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="الحساب موقوف")

    # تحقق من تسجيل الخروج الإجباري
    force_logout_at = user.get("force_logout_at")
    if force_logout_at:
        token_iat = payload.get("iat")
        if token_iat:
            token_time = datetime.fromtimestamp(token_iat, tz=timezone.utc)
            logout_time = force_logout_at if force_logout_at.tzinfo else force_logout_at.replace(tzinfo=timezone.utc)
            if token_time < logout_time:
                raise HTTPException(status_code=401, detail="تم تسجيل خروجك بواسطة المدرس")

    return user

async def get_current_teacher(current_user=Depends(get_current_user)):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="محتاج صلاحية مدرس")
    return current_user

async def get_current_student(current_user=Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="محتاج صلاحية طالب")
    return current_user

async def get_current_teacher_or_assistant(current_user=Depends(get_current_user)):
    if current_user["role"] not in ["teacher", "assistant"]:
        raise HTTPException(status_code=403, detail="محتاج صلاحية مدرس أو مساعد")
    return current_user

# ====== helper: المساعد يشوف بس — مش يعدل ======
def require_teacher_for_write(current_user, action: str = "هذا الإجراء"):
    """استخدمه جوا route بيقبل teacher_or_assistant لو العملية كتابة حساسة"""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail=f"{action} — محتاج صلاحية مدرس")