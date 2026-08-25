from datetime import datetime, timezone


def _is_free(course: dict) -> bool:
    return course.get("course_type", "paid") == "free"


async def get_enrolled_students(db, course: dict) -> list:
    """الطلاب المشتركين فعليًا في كورس (مرحلة الكورس + مسجلين فيه فعلاً)."""
    grade = course.get("grade")
    course_id_str = str(course["_id"])
    students = await db.users.query({"role": "student", "grade": grade}).to_list(5000)
    return [
        s for s in students
        if course_id_str in [str(c) for c in s.get("enrolled_courses", [])]
    ]


async def notify_course_audience(
    db, course: dict, title: str, body: str, notification_type: str
) -> None:
    """
    يبعت إشعار لجمهور كورس معين:
    - كورس مجاني: إشعار واحد (broadcast) لكل طلاب المرحلة، لأن الكل يقدر يشوفه أصلاً.
    - كورس مدفوع: إشعار منفصل لكل طالب مشترك فعليًا في الكورس ده بس.
    """
    now = datetime.now(timezone.utc)
    if _is_free(course):
        await db.notifications.add({
            "title": title,
            "body": body,
            "notification_type": notification_type,
            "target_grade": course.get("grade"),
            "target_user_id": None,
            "read_by": [],
            "created_at": now,
        })
        return

    students = await get_enrolled_students(db, course)
    for student in students:
        await db.notifications.add({
            "title": title,
            "body": body,
            "notification_type": notification_type,
            "target_grade": None,
            "target_user_id": str(student["_id"]),
            "read_by": [],
            "created_at": now,
        })


async def notify_grade_broadcast(
    db, grade: str, title: str, body: str, notification_type: str
) -> None:
    """إشعار عام لكل طلاب مرحلة دراسية معينة (مثلاً: كورس جديد اتضاف للمرحلة)."""
    await db.notifications.add({
        "title": title,
        "body": body,
        "notification_type": notification_type,
        "target_grade": grade,
        "target_user_id": None,
        "read_by": [],
        "created_at": datetime.now(timezone.utc),
    })
