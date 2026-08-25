from fastapi import APIRouter, HTTPException, Depends, Request, File, UploadFile
from pydantic import BaseModel
from typing import List, Optional
from ...core.database import is_valid_id
from ...core.ratelimit import limiter
from datetime import datetime, timezone
from ...core.database import get_db
from ...core.dependencies import get_current_user, get_current_teacher, get_current_teacher_or_assistant
from ...core.security import get_password_hash
from ...services import bunny_storage

router = APIRouter(prefix="/users", tags=["Users"])
def validate_object_id(id_str: str) -> str:
    if not is_valid_id(id_str):
        raise HTTPException(status_code=422, detail="ID غير صالح")
    return id_str


def user_helper(user) -> dict:
    """بيانات الطالب — بدون أي بيانات حساسة"""
    return {
        "id": str(user["_id"]),
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "phone": user["phone"],
        "parent_phone": user.get("parent_phone"),
        "grade": user.get("grade"),
        "governorate": user.get("governorate"),
        "gender": user.get("gender"),
        "role": user["role"],
        "is_active": user.get("is_active", True),
        "enrolled_courses": user.get("enrolled_courses", []),
        "avatar_url": user.get("avatar_url"),
        # device_id و password و avatar_path مش بيتبعتوا أبداً
    }


class ProfileUpdate(BaseModel):
    # الطالب يقدر يعدّل اسمه الأول والأخير بس من هنا — الصورة الشخصية
    # ليها endpoint منفصل (/users/me/avatar) لأنها بترفع فعليًا على Bunny.
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AssistantCreate(BaseModel):
    first_name: str
    last_name: str
    phone: str
    password: str


class ResetPasswordByAdmin(BaseModel):
    new_password: str


# ====== /me أولًا ======

@router.get("/me/profile")
async def get_my_profile(current_user=Depends(get_current_user)):
    return user_helper(current_user)


@router.patch("/me/profile")
async def update_my_profile(data: ProfileUpdate, current_user=Depends(get_current_user), db=Depends(get_db)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="مفيش بيانات صالحة للتحديث")
    await db.users.set_fields(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )
    return {"message": "تم تحديث البيانات"}


# ====== الصورة الشخصية (كل مستخدم يعدّل بتاعته بس) ======

@router.post("/me/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    if file.content_type not in bunny_storage.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="نوع الملف مش مدعوم — ارفع صورة JPG أو PNG أو WebP")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="الملف فارغ")

    try:
        result = await bunny_storage.upload_image(content, "user_avatar")
    except bunny_storage.BunnyConfigError:
        raise HTTPException(status_code=503, detail="خدمة رفع الصور غير مُفعّلة حاليًا")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except bunny_storage.BunnyStorageError:
        raise HTTPException(status_code=502, detail="فشل رفع الصورة — حاول مرة أخرى")

    old_path = current_user.get("avatar_path")

    await db.users.set_fields(
        {"_id": current_user["_id"]},
        {"$set": {"avatar_url": result.url, "avatar_path": result.path}},
    )

    # نحذف الصورة القديمة بعد نجاح رفع الجديدة تمامًا — فشل الحذف مش خطأ حرج
    if old_path and old_path != result.path:
        try:
            await bunny_storage.delete_image(old_path)
        except Exception:
            pass

    return {"message": "تم تحديث الصورة الشخصية", "avatar_url": result.url}


@router.delete("/me/avatar")
async def delete_my_avatar(current_user=Depends(get_current_user), db=Depends(get_db)):
    old_path = current_user.get("avatar_path")
    if old_path:
        try:
            await bunny_storage.delete_image(old_path)
        except Exception:
            pass

    await db.users.set_fields(
        {"_id": current_user["_id"]},
        {"$set": {"avatar_url": None, "avatar_path": None}},
    )
    return {"message": "تم حذف الصورة الشخصية"}


# ====== ولي الأمر ======

@router.get("/parent/{parent_phone}")
@limiter.limit("10/minute")
async def get_student_by_parent(request: Request, parent_phone: str, db=Depends(get_db)):
    student = await db.users.get_one({"parent_phone": parent_phone, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="مفيش طالب مرتبط بالرقم ده")

    enrolled_ids = student.get("enrolled_courses", [])
    courses = []
    if enrolled_ids:
        course_docs = await db.courses.query(
            {"_id": {"$in": [c for c in enrolled_ids if is_valid_id(c)]}},
            {"title": 1}
        ).to_list(100)
        courses = [{"id": str(c["_id"]), "title": c["title"]} for c in course_docs]

    return {
        "id": str(student["_id"]),
        "first_name": student["first_name"],
        "last_name": student["last_name"],
        "grade": student.get("grade"),
        "governorate": student.get("governorate"),
        "enrolled_courses": courses,
    }


# ====== تسجيل خروج إجباري ======

@router.post("/{student_id}/force-logout")
async def force_logout_student(
    student_id: str,
    current_user=Depends(get_current_teacher),
    db=Depends(get_db)
):
    oid = student_id if is_valid_id(student_id) else None
    if not oid:
        raise HTTPException(status_code=422, detail="ID غير صالح")
    student = await db.users.get_one({"_id": oid})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    await db.users.set_fields(
        {"_id": oid},
        {"$set": {"force_logout_at": datetime.now(timezone.utc)}}
    )
    return {"message": f"تم تسجيل خروج {student['first_name']} {student['last_name']} من كل الأجهزة"}


# ====== إنشاء مساعد (المدرس فقط) ======

@router.post("/assistants", status_code=201)
async def create_assistant(data: AssistantCreate, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    existing = await db.users.get_one({"phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="رقم الهاتف مسجل بالفعل")

    hashed = get_password_hash(data.password)
    result = await db.users.add({
        "first_name": data.first_name,
        "last_name": data.last_name,
        "phone": data.phone,
        "password": hashed,
        "role": "assistant",
        "is_active": True,
        "device_id": None,
        "enrolled_courses": [],
        "created_at": datetime.now(timezone.utc),
    })
    return {
        "id": str(result.inserted_id),
        "first_name": data.first_name,
        "last_name": data.last_name,
        "phone": data.phone,
        "role": "assistant",
    }


# ====== تغيير كلمة مرور طالب (المدرس والمساعد) ======

@router.patch("/{user_id}/reset-password")
async def reset_student_password(
    user_id: str,
    data: ResetPasswordByAdmin,
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db)
):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور لازم تكون 6 أحرف على الأقل")
    oid = validate_object_id(user_id)
    student = await db.users.get_one({"_id": oid})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    if student["role"] == "teacher":
        raise HTTPException(status_code=403, detail="مش هينفع تغير باسورد المدرس")
    # المساعد يقدر يغيّر باسورد الطلاب بس — مش باسورد مساعد تاني (حتى لو عرف الـ ID بتاعه)
    if current_user["role"] == "assistant" and student["role"] != "student":
        raise HTTPException(status_code=403, detail="المساعد يقدر يغيّر باسورد الطلاب بس")
    new_hash = get_password_hash(data.new_password)
    # إعادة تعيين كلمة المرور بتطرد الجلسات القديمة للطالب وتفكّ أي قفل محاولات
    await db.users.set_fields(
        {"_id": oid},
        {"$set": {
            "password": new_hash,
            "force_logout_at": datetime.now(timezone.utc),
            "failed_login_attempts": 0,
            "locked_until": None,
        }}
    )
    return {"message": f"تم تغيير كلمة مرور {student['first_name']} {student['last_name']} بنجاح"}


# ====== المدرس / المساعد ======

@router.get("/", response_model=List[dict])
async def get_all_students(current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    students = await db.users.query({"role": "student"}).to_list(1000)
    return [user_helper(s) for s in students]


@router.get("/assistants-list", response_model=List[dict])
async def get_all_assistants(current_user=Depends(get_current_teacher), db=Depends(get_db)):
    assistants = await db.users.query({"role": "assistant"}).to_list(100)
    return [user_helper(a) for a in assistants]


@router.get("/{user_id}")
async def get_student(user_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(user_id)
    student = await db.users.get_one({"_id": oid})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    return user_helper(student)


@router.patch("/{user_id}/toggle-active")
async def toggle_student_active(user_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(user_id)
    student = await db.users.get_one({"_id": oid})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    # المساعد يقدر يعطّل/يفعّل حساب طالب بس — مش حساب مدرس أو مساعد تاني
    if current_user["role"] == "assistant" and student["role"] != "student":
        raise HTTPException(status_code=403, detail="المساعد يقدر يعطّل حسابات الطلاب بس")
    new_status = not student.get("is_active", True)
    await db.users.set_fields({"_id": oid}, {"$set": {"is_active": new_status}})
    return {"message": "تم تغيير حالة الطالب", "is_active": new_status}


@router.patch("/{user_id}/reset-device")
async def reset_device(user_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    oid = validate_object_id(user_id)
    student = await db.users.get_one({"_id": oid})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    await db.users.set_fields({"_id": oid}, {"$set": {"device_id": None}})
    return {"message": "تم reset الجهاز"}


# ====== حذف طالب (المدرس فقط) ======

@router.delete("/{user_id}")
async def delete_student(user_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    oid = validate_object_id(user_id)
    student = await db.users.get_one({"_id": oid})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    if student["role"] == "teacher":
        raise HTTPException(status_code=403, detail="مش هينفع تحذف حساب مدرس")
    await db.users.remove_one({"_id": oid})
    return {"message": f"تم حذف حساب {student['first_name']} {student['last_name']}"}