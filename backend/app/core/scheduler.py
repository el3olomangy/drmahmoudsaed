import asyncio
from datetime import datetime, timezone
from .database import get_db

CHECK_INTERVAL_SECONDS = 300  # كل 5 دقايق


def _is_free_course(course: dict) -> bool:
    return course.get("course_type", "paid") == "free"


async def _notify_missed_homework(db, hw: dict, now: datetime) -> None:
    """يبعت إشعار 'لم تقم بتسليم الواجب' لكل طالب مسلمش الواجب ده قبل ما موعده يفوت."""
    course_id = hw.get("course_id")
    course = await db.courses.get_one({"_id": course_id}) if course_id else None

    if not course:
        # الكورس اتمسح أو مش موجود — سيب الواجب من غير ما نبعت حاجة، وعلّمه إنه اتفحص
        await db.homeworks.set_fields(
            {"_id": hw["_id"]}, {"$set": {"deadline_notified": True}}
        )
        return

    grade = course.get("grade")
    is_free = _is_free_course(course)
    homework_id_str = str(hw["_id"])

    students = await db.users.query({"role": "student", "grade": grade}).to_list(5000)
    results = await db.homework_results.query(
        {"homework_id": homework_id_str}
    ).to_list(5000)
    submitted_ids = {r["student_id"] for r in results}

    for student in students:
        student_id = str(student["_id"])
        if student_id in submitted_ids:
            continue
        # لو الكورس مدفوع، ابعت بس للطلاب المشتركين فيه فعلاً
        if not is_free:
            enrolled = [str(c) for c in student.get("enrolled_courses", [])]
            if str(course_id) not in enrolled:
                continue

        await db.notifications.add({
            "title": "لم تقم بتسليم الواجب",
            "body": f"انتهى موعد تسليم واجب \"{hw['title']}\" ولسه معملتش تسليم.",
            "notification_type": "assignment_missed",
            "target_grade": None,
            "target_user_id": student_id,
            "read_by": [],
            "created_at": now,
        })

    await db.homeworks.set_fields(
        {"_id": hw["_id"]}, {"$set": {"deadline_notified": True}}
    )


async def _notify_missed_assignment(db, a: dict, now: datetime) -> None:
    """يبعت إشعار 'لم تقم بتسليم الواجب' لكل طالب مسلمش الواجب (النصي) ده قبل ما موعده يفوت."""
    course_id = a.get("course_id")
    course = await db.courses.get_one({"_id": course_id}) if course_id else None

    if not course:
        await db.assignments.set_fields(
            {"_id": a["_id"]}, {"$set": {"deadline_notified": True}}
        )
        return

    grade = course.get("grade")
    is_free = _is_free_course(course)
    assignment_id_str = str(a["_id"])

    students = await db.users.query({"role": "student", "grade": grade}).to_list(5000)
    submissions = await db.assignment_submissions.query(
        {"assignment_id": assignment_id_str}
    ).to_list(5000)
    submitted_ids = {s["student_id"] for s in submissions}

    for student in students:
        student_id = str(student["_id"])
        if student_id in submitted_ids:
            continue
        if not is_free:
            enrolled = [str(c) for c in student.get("enrolled_courses", [])]
            if str(course_id) not in enrolled:
                continue

        await db.notifications.add({
            "title": "لم تقم بتسليم الواجب",
            "body": f"انتهى موعد تسليم واجب \"{a['title']}\" ولسه معملتش تسليم.",
            "notification_type": "assignment_missed",
            "target_grade": None,
            "target_user_id": student_id,
            "read_by": [],
            "created_at": now,
        })

    await db.assignments.set_fields(
        {"_id": a["_id"]}, {"$set": {"deadline_notified": True}}
    )


async def _notify_missed_exam(db, exam: dict, now: datetime) -> None:
    """يبعت إشعار 'لم تقم بتسليم الاختبار' لكل طالب مسلمش الاختبار ده قبل ما موعده يفوت."""
    course_id = exam.get("course_id")
    course = await db.courses.get_one({"_id": course_id}) if course_id else None

    if not course:
        await db.exams.set_fields(
            {"_id": exam["_id"]}, {"$set": {"deadline_notified": True}}
        )
        return

    grade = course.get("grade")
    is_free = _is_free_course(course)
    exam_id_str = str(exam["_id"])

    students = await db.users.query({"role": "student", "grade": grade}).to_list(5000)
    results = await db.exam_results.query(
        {"exam_id": exam_id_str}
    ).to_list(5000)
    submitted_ids = {r["student_id"] for r in results}

    for student in students:
        student_id = str(student["_id"])
        if student_id in submitted_ids:
            continue
        if not is_free:
            enrolled = [str(c) for c in student.get("enrolled_courses", [])]
            if str(course_id) not in enrolled:
                continue

        await db.notifications.add({
            "title": "لم تقم بتسليم الاختبار",
            "body": f"انتهى موعد تسليم اختبار \"{exam['title']}\" ولسه معملتش تسليم.",
            "notification_type": "exam_missed",
            "target_grade": None,
            "target_user_id": student_id,
            "read_by": [],
            "created_at": now,
        })

    await db.exams.set_fields(
        {"_id": exam["_id"]}, {"$set": {"deadline_notified": True}}
    )


async def _auto_submit_expired_homework_attempts(db, now: datetime) -> None:
    """يسلّم تلقائيًا أي مسودة واجب لسه مفتوحة بعد ما موعد التسليم فات.

    الطالب اللي بدأ يحل وحفظ مسودة بس نسي يضغط تسليم — بياخد درجته من مسودته
    بدل ما ياخد صفر. لازم تشتغل قبل إشعارات "لم تسلّم".
    """
    from ..api.routes.homework import finalize_homework_attempt

    pending = await db.homework_attempts.query({"status": "in_progress"}).to_list(2000)
    for attempt in pending:
        hw = await db.homeworks.get_one({"_id": attempt["homework_id"]})
        if not hw:
            await db.homework_attempts.set_fields(
                {"_id": attempt["_id"]}, {"$set": {"status": "submitted"}}
            )
            continue
        deadline = hw.get("deadline")
        if not deadline:
            continue  # واجب من غير موعد تسليم — مفيش تسليم تلقائي
        dl = deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)
        if now <= dl:
            continue
        try:
            await finalize_homework_attempt(db, hw, attempt, auto_submitted=True)
        except Exception as ex:
            print(f"[scheduler] فشل تسليم مسودة الواجب {attempt.get('_id')}: {ex}")


async def _check_expired_homeworks_once(db, now: datetime) -> None:
    pending = await db.homeworks.query(
        {"deadline_notified": {"$ne": True}}
    ).to_list(1000)

    for hw in pending:
        deadline = hw.get("deadline")
        if not deadline:
            continue
        dl = deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)
        if now <= dl:
            continue
        try:
            await _notify_missed_homework(db, hw, now)
        except Exception as ex:
            print(f"[scheduler] فشل فحص الواجب {hw.get('_id')}: {ex}")


async def _check_expired_assignments_once(db, now: datetime) -> None:
    pending = await db.assignments.query(
        {"deadline_notified": {"$ne": True}}
    ).to_list(1000)

    for a in pending:
        deadline = a.get("deadline")
        if not deadline:
            continue
        dl = deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)
        if now <= dl:
            continue
        try:
            await _notify_missed_assignment(db, a, now)
        except Exception as ex:
            print(f"[scheduler] فشل فحص الواجب {a.get('_id')}: {ex}")


async def _auto_submit_expired_exam_attempts(db, now: datetime) -> None:
    """يسلّم تلقائيًا أي جلسة امتحان خلص وقتها والطالب لسه ما سلّمش.

    ده الأمان اللي بيخلي الامتحان يتسلّم حتى لو الطالب قافل الصفحة أو النت عنده فصل.
    التصحيح بيتم من آخر مسودة اتحفظت على السيرفر.
    """
    # import موضعي لتجنّب الاستيراد الدائري مع طبقة الـ routes
    from ..api.routes.exams import finalize_attempt

    pending = await db.exam_attempts.query({"status": "in_progress"}).to_list(2000)
    for attempt in pending:
        exp = attempt.get("expires_at")
        if not exp:
            continue
        e = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if now <= e:
            continue  # لسه في وقت
        exam = await db.exams.get_one({"_id": attempt["exam_id"]})
        if not exam:
            # الاختبار اتمسح — نقفل الجلسة بس
            await db.exam_attempts.set_fields(
                {"_id": attempt["_id"]}, {"$set": {"status": "submitted"}}
            )
            continue
        try:
            await finalize_attempt(db, exam, attempt, auto_submitted=True)
        except Exception as ex:
            print(f"[scheduler] فشل تسليم جلسة الامتحان {attempt.get('_id')}: {ex}")


async def _check_expired_exams_once(db, now: datetime) -> None:
    pending = await db.exams.query(
        {"deadline_notified": {"$ne": True}}
    ).to_list(1000)

    for exam in pending:
        deadline = exam.get("available_until")
        if not deadline:
            continue
        dl = deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)
        if now <= dl:
            continue
        try:
            await _notify_missed_exam(db, exam, now)
        except Exception as ex:
            print(f"[scheduler] فشل فحص الاختبار {exam.get('_id')}: {ex}")


async def run_all_checks_once(db, now: datetime | None = None) -> None:
    """تشغيلة واحدة لكل الفحوصات — يستخدمها الـ loop الخلفي وكمان مسار الـ cron.

    الترتيب مهم: نسلّم جلسات الامتحان/الواجب المنتهية الأول (شبكة أمان للطالب
    اللي قافل الصفحة)، وبعدها نبعت إشعارات "لم تسلّم".
    """
    now = now or datetime.now(timezone.utc)
    await _auto_submit_expired_exam_attempts(db, now)
    await _auto_submit_expired_homework_attempts(db, now)
    await _check_expired_homeworks_once(db, now)
    await _check_expired_assignments_once(db, now)
    await _check_expired_exams_once(db, now)


async def run_assignment_deadline_checker() -> None:
    """Loop خلفي بيشتغل طول ما السيرفر شغال، بيفحص الواجبات والاختبارات المنتهية كل 5 دقايق."""
    while True:
        try:
            await run_all_checks_once(get_db())
        except Exception as e:
            print(f"[scheduler] error: {e}")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)