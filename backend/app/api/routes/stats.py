from fastapi import APIRouter, Depends
from ...core.database import get_db
from ...core.dependencies import get_current_teacher_or_assistant
from ...core.database import is_valid_id
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/stats", tags=["Stats"])


# ====== ١ — إحصائيات عامة للمنصة ======

@router.get("/overview")
async def get_overview(
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db)
):
    """إحصائيات سريعة: طلاب، كورسات، أكواد، اختبارات"""

    total_students = await db.users.count({"role": "student"})
    active_students = await db.users.count({"role": "student", "is_active": True})
    total_courses = await db.courses.count({})
    active_courses = await db.courses.count({"is_active": True})
    total_codes = await db.codes.count({})
    used_codes = await db.codes.count({"status": "used"})
    active_codes = await db.codes.count({"status": "active"})
    total_exams = await db.exams.count({})
    total_results = await db.exam_results.count({})
    passed_results = await db.exam_results.count({"passed": True})

    # طلاب جدد آخر 7 أيام
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_students_this_week = await db.users.count({
        "role": "student",
        "created_at": {"$gte": week_ago}
    })

    return {
        "students": {
            "total": total_students,
            "active": active_students,
            "inactive": total_students - active_students,
            "new_this_week": new_students_this_week,
        },
        "courses": {
            "total": total_courses,
            "active": active_courses,
        },
        "codes": {
            "total": total_codes,
            "used": used_codes,
            "available": active_codes,
            "usage_rate": round(used_codes / total_codes * 100, 1) if total_codes > 0 else 0,
        },
        "exams": {
            "total": total_exams,
            "submissions": total_results,
            "pass_rate": round(passed_results / total_results * 100, 1) if total_results > 0 else 0,
        },
    }


# ====== ٢ — أكثر الكورسات اشتراكاً ======

@router.get("/top-courses")
async def get_top_courses(
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db)
):
    """الكورسات مرتبة من الأكثر للأقل اشتراكاً"""

    # جيب كل الطلاب واحسب عدد الاشتراكات لكل كورس
    students = await db.users.query(
        {"role": "student"},
        {"enrolled_courses": 1}
    ).to_list(5000)

    course_count = {}
    for student in students:
        for course_id in student.get("enrolled_courses", []):
            course_count[course_id] = course_count.get(course_id, 0) + 1

    if not course_count:
        return []

    # رتّب من الأكثر للأقل وخد أول 10
    sorted_courses = sorted(course_count.items(), key=lambda x: x[1], reverse=True)[:10]

    result = []
    for course_id, count in sorted_courses:
        if not is_valid_id(course_id):
            continue
        course = await db.courses.get_one({"_id": course_id})
        if course:
            result.append({
                "course_id": course_id,
                "title": course["title"],
                "grade": course.get("grade"),
                "subscribers": count,
            })

    return result


# ====== ٣ — آخر الطلاب المسجلين ======

@router.get("/recent-students")
async def get_recent_students(
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db)
):
    """آخر 20 طالب سجلوا في المنصة"""

    students = await db.users.query(
        {"role": "student"},
        {
            "first_name": 1, "last_name": 1,
            "phone": 1, "grade": 1,
            "governorate": 1, "is_active": 1,
            "enrolled_courses": 1, "created_at": 1
        }
    ).sort("created_at", -1).to_list(20)

    return [
        {
            "id": str(s["_id"]),
            "name": f"{s['first_name']} {s['last_name']}",
            "phone": s["phone"],
            "grade": s.get("grade"),
            "governorate": s.get("governorate"),
            "is_active": s.get("is_active", True),
            "courses_count": len(s.get("enrolled_courses", [])),
            "joined_at": s.get("created_at"),
        }
        for s in students
    ]


# ====== ٤ — إحصائيات اختبار معين ======

@router.get("/exam/{exam_id}")
async def get_exam_stats(
    exam_id: str,
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db)
):
    """تفاصيل نتائج اختبار معين"""

    if not is_valid_id(exam_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="ID غير صالح")
    oid = exam_id

    exam = await db.exams.get_one({"_id": oid})
    if not exam:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")

    results = await db.exam_results.query(
        {"exam_id": exam_id}
    ).to_list(5000)

    if not results:
        return {
            "exam_id": exam_id,
            "exam_title": exam["title"],
            "total_submissions": 0,
            "passed": 0,
            "failed": 0,
            "pass_rate": 0,
            "average_score": 0,
            "highest_score": 0,
            "lowest_score": 0,
        }

    scores = [r["score"] for r in results]
    passed = sum(1 for r in results if r.get("passed"))

    return {
        "exam_id": exam_id,
        "exam_title": exam["title"],
        "total_submissions": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "pass_rate": round(passed / len(results) * 100, 1),
        "average_score": round(sum(scores) / len(scores), 1),
        "highest_score": round(max(scores), 1),
        "lowest_score": round(min(scores), 1),
    }