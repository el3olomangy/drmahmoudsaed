from fastapi import APIRouter, HTTPException, Depends
from typing import List
from ...core.database import is_valid_id
from ...core.database import get_db
from ...core.dependencies import get_current_user, get_current_teacher, get_current_teacher_or_assistant
from ...core.notify import notify_course_audience, notify_grade_broadcast
from ...schemas.course import (
    CourseCreate, CourseResponse, CourseListItem,
    UnitCreate, UnitResponse, LectureCreate, LectureUpdate, LectureResponse
)

router = APIRouter(prefix="/courses", tags=["Courses"])

def is_free_course(course: dict) -> bool:
    # كورسات قديمة اتعملت قبل إضافة course_type تتعامل كأنها مدفوعة (كان ليها سعر ومحتاجة كود أصلاً)
    return course.get("course_type", "paid") == "free"


def course_helper(course, enrolled_ids=[], is_enrolled=False) -> dict:
    # الكورس المجاني متاح لأي طالب في مرحلته من غير كود — فبيتحسب "مشترك" تلقائيًا
    free = is_free_course(course)
    return {
        "id": str(course["_id"]),
        "title": course["title"],
        "description": course.get("description"),
        "grade": course["grade"],
        "course_type": course.get("course_type", "paid"),
        "price": course.get("price"),
        "thumbnail": course.get("thumbnail"),
        "lectures_count": course.get("lectures_count", 0),
        "is_enrolled": free or str(course["_id"]) in enrolled_ids or is_enrolled,
    }

# ====== الكورسات ======

@router.get("/", response_model=List[CourseListItem])
async def get_courses(current_user=Depends(get_current_user), db=Depends(get_db)):
    enrolled = [str(c) for c in current_user.get("enrolled_courses", [])]

    # المدرس والمساعد يشوفوا كل الكورسات
    # الطالب يشوف كورسات مرحلته بس + الكورسات اللي هو مشترك فيها
    if current_user.get("role") in ["teacher", "assistant"]:
        query = {}
    else:
        student_grade = current_user.get("grade")
        enrolled_oids = [
            c for c in enrolled if is_valid_id(c)
        ]
        if student_grade:
            query = {
                "$or": [
                    {"grade": student_grade},
                    {"_id": {"$in": enrolled_oids}},
                ]
            }
        else:
            query = {}  # لو مفيش grade — يشوف الكل

    courses = await db.courses.query(query).to_list(100)
    return [course_helper(c, enrolled) for c in courses]

@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    course = await db.courses.get_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="الكورس مش موجود")

    enrolled = [str(c) for c in current_user.get("enrolled_courses", [])]
    # كورس مجاني = متاح فورًا لأي طالب في مرحلته من غير كود اشتراك
    is_free = is_free_course(course)
    is_enrolled = is_free or course_id in enrolled

    units_raw = await db.units.query({"course_id": course_id}).sort("order", 1).to_list(100)
    units = []
    for unit in units_raw:
        lectures_raw = await db.lectures.query({"unit_id": str(unit["_id"])}).sort("order", 1).to_list(100)
        lectures = []
        for lec in lectures_raw:
            # المحاضرة "المجانية" تتشاف بدون اشتراك (معاينة) — غير كده لازم يكون الطالب مشترك
            # أو يكون الكورس نفسه مجاني بالكامل
            can_view_content = (
                is_enrolled
                or current_user.get("role") in ["teacher", "assistant"]
                or lec.get("lecture_type") == "free"
            )
            lectures.append(LectureResponse(
                id=str(lec["_id"]),
                title=lec["title"],
                description=lec.get("description"),
                video_url=lec.get("video_url") if can_view_content else None,
                pdf_url=lec.get("pdf_url") if can_view_content else None,
                order=lec["order"],
                lecture_type=lec["lecture_type"],
                duration_minutes=lec.get("duration_minutes"),
                is_enrolled=is_enrolled,
            ))
        units.append(UnitResponse(
            id=str(unit["_id"]),
            title=unit["title"],
            order=unit["order"],
            lectures=lectures,
        ))

    return CourseResponse(
        id=str(course["_id"]),
        title=course["title"],
        description=course.get("description"),
        grade=course["grade"],
        course_type=course.get("course_type", "paid"),
        price=course.get("price"),
        thumbnail=course.get("thumbnail"),
        units=units,
        is_enrolled=is_enrolled,
    )

@router.post("/", response_model=CourseListItem, status_code=201)
async def create_course(data: CourseCreate, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    course_doc = {
        "title": data.title,
        "description": data.description,
        "grade": data.grade,
        "course_type": data.course_type,
        "price": data.price,
        "thumbnail": data.thumbnail,
        "lectures_count": 0,
        "is_active": True,
    }
    result = await db.courses.add(course_doc)
    course_doc["_id"] = result.inserted_id

    await notify_grade_broadcast(
        db,
        data.grade,
        f"كورس جديد: {data.title}",
        "تم إضافة كورس جديد لمرحلتك — يلا شوفه دلوقتي.",
        "new_course",
    )

    return course_helper(course_doc)

@router.put("/{course_id}", response_model=CourseListItem)
async def update_course(course_id: str, data: CourseCreate, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    course = await db.courses.get_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="الكورس مش موجود")

    # لو الكورس بقى مجاني، السعر لازم يتمسح فعليًا من قاعدة البيانات (مش مجرد يتجاهله exclude_none)
    update_data = data.model_dump(exclude_none=True)
    update_data["course_type"] = data.course_type
    update_data["price"] = data.price

    # لو تحويل الكورس من مدفوع لمجاني وهو فيه أكواد نشطة لسه — نمنع، عشان الأكواد دي هتفضل موجودة بلا فايدة
    if data.course_type == "free" and course.get("course_type", "paid") != "free":
        active_codes = await db.codes.count({"course_id": course_id, "status": "active"})
        if active_codes > 0:
            raise HTTPException(
                status_code=400,
                detail=f"مينفعش تحول الكورس لمجاني وفيه {active_codes} كود اشتراك نشط لسه — عطّل أو احذف الأكواد دي الأول"
            )

    await db.courses.set_fields(
        {"_id": course_id},
        {"$set": update_data}
    )
    updated = await db.courses.get_one({"_id": course_id})
    return course_helper(updated)

@router.delete("/{course_id}")
async def delete_course(course_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    course = await db.courses.get_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="الكورس مش موجود")
    await db.courses.remove_one({"_id": course_id})
    return {"message": "تم حذف الكورس"}

# ====== الوحدات ======

@router.post("/{course_id}/units", response_model=UnitResponse, status_code=201)
async def create_unit(course_id: str, data: UnitCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    course = await db.courses.get_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="الكورس مش موجود")
    unit_doc = {"title": data.title, "order": data.order, "course_id": course_id}
    result = await db.units.add(unit_doc)
    return UnitResponse(id=str(result.inserted_id), title=data.title, order=data.order)

# ====== المحاضرات ======

@router.post("/{course_id}/units/{unit_id}/lectures", response_model=LectureResponse, status_code=201)
async def create_lecture(course_id: str, unit_id: str, data: LectureCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    unit = await db.units.get_one({"_id": unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="الوحدة مش موجودة")
    lecture_doc = {
        "title": data.title,
        "description": data.description,
        "video_url": data.video_url,
        "pdf_url": data.pdf_url,
        "order": data.order,
        "lecture_type": data.lecture_type,
        "duration_minutes": data.duration_minutes,
        "unit_id": unit_id,
        "course_id": course_id,
    }
    result = await db.lectures.add(lecture_doc)
    await db.courses.set_fields({"_id": course_id}, {"$inc": {"lectures_count": 1}})

    course = await db.courses.get_one({"_id": course_id})
    if course:
        await notify_course_audience(
            db,
            course,
            f"محاضرة جديدة: {data.title}",
            f"تم رفع محاضرة جديدة في كورس \"{course.get('title', '')}\" — يلا شوفها دلوقتي.",
            "new_lecture",
        )

    return LectureResponse(
        id=str(result.inserted_id),
        title=data.title,
        description=data.description,
        video_url=data.video_url,
        pdf_url=data.pdf_url,
        order=data.order,
        lecture_type=data.lecture_type,
        duration_minutes=data.duration_minutes,
    )

# ====== تعديل وحذف المحاضرة ======

@router.delete("/{course_id}/units/{unit_id}/lectures/{lecture_id}")
async def delete_lecture(course_id: str, unit_id: str, lecture_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    lec = await db.lectures.get_one({"_id": lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="المحاضرة مش موجودة")
    await db.lectures.remove_one({"_id": lecture_id})
    await db.courses.set_fields({"_id": course_id}, {"$inc": {"lectures_count": -1}})
    return {"message": "تم حذف المحاضرة"}


@router.patch("/{course_id}/units/{unit_id}/lectures/{lecture_id}")
async def update_lecture(course_id: str, unit_id: str, lecture_id: str, data: LectureUpdate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    lec = await db.lectures.get_one({"_id": lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="المحاضرة مش موجودة")
    # نحدث بس الحقول اللي اتبعتت فعلاً من الفرونت (حتى لو القيمة null، عشان نقدر نمسح فيديو/PDF مثلاً)
    update_data = data.model_dump(exclude_unset=True)
    await db.lectures.set_fields({"_id": lecture_id}, {"$set": update_data})
    updated = await db.lectures.get_one({"_id": lecture_id})
    return LectureResponse(
        id=str(updated["_id"]),
        title=updated["title"],
        description=updated.get("description"),
        video_url=updated.get("video_url"),
        pdf_url=updated.get("pdf_url"),
        order=updated["order"],
        lecture_type=updated["lecture_type"],
        duration_minutes=updated.get("duration_minutes"),
    )


# ====== حذف الوحدة ======

@router.delete("/{course_id}/units/{unit_id}")
async def delete_unit(course_id: str, unit_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    unit = await db.units.get_one({"_id": unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="الوحدة مش موجودة")
    # احسب عدد المحاضرات اللي هتتحذف
    lec_count = await db.lectures.count({"unit_id": unit_id})
    await db.lectures.remove_many({"unit_id": unit_id})
    await db.units.remove_one({"_id": unit_id})
    if lec_count > 0:
        await db.courses.set_fields({"_id": course_id}, {"$inc": {"lectures_count": -lec_count}})
    return {"message": "تم حذف الوحدة ومحاضراتها"}