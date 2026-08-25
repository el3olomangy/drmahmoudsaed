from fastapi import APIRouter, HTTPException, Depends
from typing import List
from ...core.database import is_valid_id
from datetime import datetime, timedelta, timezone
import random
import string
from ...core.database import get_db
from ...core.dependencies import get_current_user, get_current_teacher, get_current_teacher_or_assistant
from ...schemas.code import CodeGenerate, CodeActivate, CodeResponse, CodeStatus, CodeType

router = APIRouter(prefix="/codes", tags=["Codes"])


def validate_object_id(id_str: str) -> str:
    if not is_valid_id(id_str):
        raise HTTPException(status_code=422, detail="ID غير صالح")
    return id_str


def generate_random_code(length=12) -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


def code_helper(code) -> dict:
    return {
        "id": str(code["_id"]),
        "code": code["code"],
        "code_type": code["code_type"],
        "status": code["status"],
        "course_id": code.get("course_id"),
        "bundle_ids": code.get("bundle_ids"),
        "used_by": code.get("used_by"),
        "used_at": code.get("used_at"),
        "expires_at": code.get("expires_at"),
        "created_at": code["created_at"],
    }


@router.post("/generate", response_model=List[CodeResponse], status_code=201)
async def generate_codes(data: CodeGenerate, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    if data.code_type == CodeType.course and not data.course_id:
        raise HTTPException(status_code=400, detail="لازم تحدد الكورس")
    if data.code_type == CodeType.bundle and not data.bundle_ids:
        raise HTTPException(status_code=400, detail="لازم تحدد الباقات")

    # الكورس المجاني متاح لأي طالب من غير كود أصلاً — مفيش داعي نولّد له أكواد
    if data.code_type == CodeType.course and data.course_id:
        course = await db.courses.get_one({"_id": data.course_id})
        if not course:
            raise HTTPException(status_code=404, detail="الكورس مش موجود")
        if course.get("course_type", "paid") == "free":
            raise HTTPException(status_code=400, detail="الكورس ده مجاني ومتاح لأي طالب من غير كود اشتراك")
    elif data.code_type == CodeType.bundle and data.bundle_ids:
        free_titles = []
        for cid in data.bundle_ids:
            c = await db.courses.get_one({"_id": cid})
            if c and c.get("course_type", "paid") == "free":
                free_titles.append(c.get("title", cid))
        if free_titles:
            raise HTTPException(
                status_code=400,
                detail=f"الكورسات دي مجانية ومش لازم تتحط في باقة بكود: {', '.join(free_titles)}"
            )

    expires_at = None
    if data.expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_days)

    codes = []
    for _ in range(data.quantity):
        code_str = generate_random_code()
        while await db.codes.get_one({"code": code_str}):
            code_str = generate_random_code()

        code_doc = {
            "code": code_str,
            "code_type": data.code_type,
            "status": CodeStatus.active,
            "course_id": data.course_id,
            "bundle_ids": data.bundle_ids,
            "used_by": None,
            "used_at": None,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.codes.add(code_doc)
        code_doc["_id"] = result.inserted_id
        codes.append(code_helper(code_doc))

    return codes


@router.get("/", response_model=List[CodeResponse])
async def get_codes(current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    codes = await db.codes.query().sort("created_at", -1).to_list(1000)
    return [code_helper(c) for c in codes]


@router.post("/activate", response_model=dict)
async def activate_code(data: CodeActivate, current_user=Depends(get_current_user), db=Depends(get_db)):
    code = await db.codes.get_one({"code": data.code.upper()})
    if not code:
        raise HTTPException(status_code=404, detail="الكود مش موجود")
    if code["status"] == CodeStatus.used:
        raise HTTPException(status_code=400, detail="الكود اتستخدم قبل كده")
    if code["status"] == CodeStatus.disabled:
        raise HTTPException(status_code=400, detail="الكود متعطل")
    if code.get("expires_at") and datetime.now(timezone.utc) > code["expires_at"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="الكود منتهي الصلاحية")

    user_id = str(current_user["_id"])

    courses_to_enroll = []
    if code["code_type"] == CodeType.course:
        courses_to_enroll = [code["course_id"]]
    elif code["code_type"] == CodeType.bundle:
        courses_to_enroll = code["bundle_ids"]

    enrolled = [str(c) for c in current_user.get("enrolled_courses", [])]

    # لو كورس واحد والطالب مشترك فيه — رفض
    if code["code_type"] == CodeType.course and courses_to_enroll[0] in enrolled:
        raise HTTPException(status_code=400, detail="انت مشترك في الكورس ده بالفعل")

    # لو باقة — اشترك في الكورسات الجديدة بس
    if code["code_type"] == CodeType.bundle:
        courses_to_enroll = [c for c in courses_to_enroll if c not in enrolled]
        if not courses_to_enroll:
            raise HTTPException(status_code=400, detail="انت مشترك في كل كورسات الباقة دي بالفعل")

    # حجز الكود بشكل ذرّي: نكتب "used" فقط لو حالته لسه زي ما قريناها.
    # لو حد تاني استهلكه في نفس اللحظة، الحجز هيفشل ونرفض — من غير سباق.
    claimed = await db.codes.compare_and_set(
        code["_id"],
        expected={"status": code["status"]},
        updates={"status": CodeStatus.used, "used_by": user_id, "used_at": datetime.now(timezone.utc)},
    )
    if not claimed:
        raise HTTPException(status_code=400, detail="الكود اتستخدم قبل كده")

    # تأكد إن الكورسات strings مش IDs
    courses_to_enroll = [str(c) for c in courses_to_enroll]

    await db.users.set_fields(
        {"_id": current_user["_id"]},
        {"$addToSet": {"enrolled_courses": {"$each": courses_to_enroll}}}
    )

    return {"message": "تم تفعيل الكود بنجاح", "enrolled_courses": courses_to_enroll}


@router.patch("/{code_id}/disable")
async def disable_code(code_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    oid = validate_object_id(code_id)
    code = await db.codes.get_one({"_id": oid})
    if not code:
        raise HTTPException(status_code=404, detail="الكود مش موجود")
    await db.codes.set_fields({"_id": oid}, {"$set": {"status": CodeStatus.disabled}})
    return {"message": "تم تعطيل الكود"}


@router.delete("/{code_id}")
async def delete_code(code_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    oid = validate_object_id(code_id)
    code = await db.codes.get_one({"_id": oid})
    if not code:
        raise HTTPException(status_code=404, detail="الكود مش موجود")
    await db.codes.remove_one({"_id": oid})
    return {"message": "تم حذف الكود"}


@router.patch("/{code_id}/revoke/{user_id}")
async def revoke_code_from_student(
    code_id: str, user_id: str,
    current_user=Depends(get_current_teacher), db=Depends(get_db)
):
    """
    سحب الكود من طالب معين وإعادة تفعيله للاستخدام من جديد
    """
    oid = validate_object_id(code_id)
    uid = validate_object_id(user_id)

    code = await db.codes.get_one({"_id": oid})
    if not code:
        raise HTTPException(status_code=404, detail="الكود مش موجود")

    if code.get("used_by") != str(user_id):
        raise HTTPException(status_code=400, detail="الكود ده ماتمش مستخدمش من الطالب ده")

    # الغي الاشتراك من الطالب
    courses_to_remove = []
    if code["code_type"] == CodeType.course and code.get("course_id"):
        courses_to_remove = [code["course_id"]]
    elif code["code_type"] == CodeType.bundle and code.get("bundle_ids"):
        courses_to_remove = code["bundle_ids"]

    if courses_to_remove:
        await db.users.set_fields(
            {"_id": uid},
            {"$pull": {"enrolled_courses": {"$in": courses_to_remove}}}
        )

    # أعد الكود لحالته الأصلية
    await db.codes.set_fields(
        {"_id": oid},
        {"$set": {"status": CodeStatus.active, "used_by": None, "used_at": None}}
    )

    return {"message": "تم سحب الكود من الطالب وإعادته للتفعيل"}