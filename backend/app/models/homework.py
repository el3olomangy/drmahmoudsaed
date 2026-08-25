from ..core.database import new_id
from datetime import datetime, timezone


def homework_doc(data, questions_docs: list) -> dict:
    deadline = None
    if getattr(data, "deadline", None):
        try:
            deadline = datetime.fromisoformat(data.deadline.replace("Z", "+00:00"))
        except Exception:
            deadline = None

    scheduled_at = None
    if getattr(data, "scheduled_at", None):
        try:
            scheduled_at = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
        except Exception:
            scheduled_at = None

    return {
        "title": data.title,
        "lecture_id": data.lecture_id,
        "unit_id": getattr(data, "unit_id", None),
        "course_id": data.course_id,
        "pass_score": data.pass_score,
        "show_result_immediately": data.show_result_immediately,
        "scheduled_at": scheduled_at,
        "deadline": deadline,
        "deadline_notified": False,
        "questions": questions_docs,
        "is_published": True,
        "created_at": datetime.now(timezone.utc),
    }


def homework_attempt_doc(homework_id: str, student_id: str, session_token: str,
                         started_at: datetime) -> dict:
    """وثيقة جلسة واجب لطالب واحد.

    الواجب مالوش مؤقّت شخصي (بيتحكم فيه الـ deadline العام للواجب كله)،
    فمفيش expires_at هنا. draft_answers بتتحدّث مع كل إجابة (auto-save).
    session_token بيمنع الحل من أكتر من جهاز في نفس الوقت.
    """
    return {
        "homework_id": homework_id,
        "student_id": student_id,
        "session_token": session_token,
        "started_at": started_at,
        "draft_answers": {},          # {question_id: {...إجابة...}}
        "last_saved_at": started_at,
        "status": "in_progress",      # in_progress | submitted
        "auto_submitted": False,      # True لو السيرفر سلّمه تلقائيًا عند الـ deadline
    }


def homework_question_doc(q) -> dict:
    # نستبعد أي اختيار نصه فاضي أو مسافات بس — الطالب يشوف الاختيارات المكتوبة فقط
    choices = [
        {"text": c.text.strip(), "is_correct": c.is_correct}
        for c in (q.choices or [])
        if c.text and c.text.strip()
    ]
    return {
        "_id": new_id(),
        "text": q.text,
        "question_type": q.question_type,
        "choices": choices,
        "correct_answer": q.correct_answer,
        "points": q.points,
        "image_url": getattr(q, "image_url", None),
        "image_path": getattr(q, "image_path", None),
    }
