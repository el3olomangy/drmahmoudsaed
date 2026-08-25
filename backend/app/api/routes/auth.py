from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from ...core.database import get_db
from ...core.ratelimit import limiter
from ...core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, decode_token,
    blacklist_token, is_token_blacklisted,
)
from ...core.dependencies import get_current_user
from ...core.lockout import ensure_not_locked, register_failure, reset_failures
from ...schemas.user import UserRegister, UserLogin, UserResponse, Token, UserRole
from ...models.user import user_doc

router = APIRouter(prefix="/auth", tags=["Authentication"])

class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# ====== تسجيل حساب جديد ======

@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, data: UserRegister):
    db = get_db()

    # بنتحقق بس من رقم الطالب — رقم ولي الأمر مسموح يتكرر
    existing = await db.users.get_one({"phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="رقم الهاتف مسجل بالفعل")

    hashed_password = get_password_hash(data.password)
    new_user = user_doc(data, hashed_password)
    result = await db.users.add(new_user)

    return UserResponse(
        id=str(result.inserted_id),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        role=UserRole.student,
        grade=data.grade,
        governorate=data.governorate,
        gender=data.gender,
    )


# ====== تسجيل الدخول ======

@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin):
    db = get_db()

    user = await db.users.get_one({"phone": data.phone})
    if not user:
        raise HTTPException(status_code=401, detail="رقم الهاتف أو كلمة المرور غلط")

    # قفل تدريجي ضد التخمين: لو الحساب مقفول حاليًا نرفض قبل ما نتحقق أصلًا
    ensure_not_locked(user)

    if not verify_password(data.password, user["password"]):
        # نسجّل المحاولة الفاشلة (بيزوّد العداد ويقفل تصاعديًا لو زادت)
        await register_failure(db, user)
        raise HTTPException(status_code=401, detail="رقم الهاتف أو كلمة المرور غلط")

    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="الحساب موقوف")

    # دخول ناجح — نصفّر عداد المحاولات الفاشلة
    await reset_failures(db, user)

    # Device Binding — للطلاب بس، الأدمن والمساعد يفتحوا من أي جهاز
    if user["role"] == "student":
        if user.get("device_id") and user["device_id"] != data.device_id:
            raise HTTPException(
                status_code=403,
                detail="الحساب مسجل على جهاز تاني — تواصل مع الدعم"
            )
        if not user.get("device_id"):
            await db.users.set_fields(
                {"_id": user["_id"]},
                {"$set": {"device_id": data.device_id}}
            )

    token_data = {"sub": str(user["_id"]), "role": user["role"]}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=str(user["_id"]),
            first_name=user["first_name"],
            last_name=user["last_name"],
            phone=user["phone"],
            role=user["role"],
            grade=user.get("grade"),
            governorate=user.get("governorate"),
            gender=user.get("gender"),
        )
    )


# ====== تجديد الـ Access Token ======

@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh_token(request: Request, data: RefreshRequest):
    if await is_token_blacklisted(data.refresh_token):
        raise HTTPException(status_code=401, detail="Refresh token منتهي أو تم تسجيل الخروج")

    payload = decode_token(data.refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Refresh token غير صالح أو منتهي")

    user_id = payload.get("sub")
    role = payload.get("role")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token غير صالح")

    db = get_db()
    user = await db.users.get_one({"_id": user_id})
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="الحساب غير موجود أو موقوف")

    # لو حصل تسجيل خروج إجباري / تغيير كلمة مرور بعد إصدار الـ refresh token، نرفضه
    force_logout_at = user.get("force_logout_at")
    if force_logout_at:
        token_iat = payload.get("iat")
        if token_iat:
            token_time = datetime.fromtimestamp(token_iat, tz=timezone.utc)
            logout_time = force_logout_at if force_logout_at.tzinfo else force_logout_at.replace(tzinfo=timezone.utc)
            if token_time < logout_time:
                raise HTTPException(status_code=401, detail="انتهت الجلسة — سجّل دخول تاني")

    await blacklist_token(data.refresh_token)
    new_access = create_access_token(data={"sub": user_id, "role": role})
    new_refresh = create_refresh_token(data={"sub": user_id, "role": role})

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


class LogoutRequest(BaseModel):
    refresh_token: str


# ====== تسجيل الخروج ======

@router.post("/logout")
async def logout(data: LogoutRequest, current_user=Depends(get_current_user)):
    await blacklist_token(data.refresh_token)
    return {"message": "تم تسجيل الخروج بنجاح"}


# ====== بيانات المستخدم الحالي ======

@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "first_name": current_user["first_name"],
        "last_name": current_user["last_name"],
        "phone": current_user["phone"],
        "role": current_user["role"],
        "grade": current_user.get("grade"),
        "governorate": current_user.get("governorate"),
        "gender": current_user.get("gender"),
        "is_active": current_user.get("is_active", True),
        "enrolled_courses": current_user.get("enrolled_courses", []),
        "avatar_url": current_user.get("avatar_url"),
    }


# ====== تغيير كلمة المرور ======

@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    if not verify_password(data.old_password, current_user["password"]):
        raise HTTPException(status_code=400, detail="كلمة المرور الحالية غلط")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور الجديدة لازم تكون 6 أحرف على الأقل")

    new_hash = get_password_hash(data.new_password)
    # تغيير كلمة المرور بيبطّل كل الجلسات القديمة على كل الأجهزة (أمان)
    await db.users.set_fields(
        {"_id": current_user["_id"]},
        {"$set": {"password": new_hash, "force_logout_at": datetime.now(timezone.utc)}}
    )
    return {"message": "تم تغيير كلمة المرور بنجاح — سجّل دخول تاني بكلمة السر الجديدة"}
