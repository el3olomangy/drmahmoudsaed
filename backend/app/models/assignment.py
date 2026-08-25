from datetime import datetime, timezone


def assignment_doc(data) -> dict:
    deadline = None
    if getattr(data, "deadline", None):
        try:
            deadline = datetime.fromisoformat(data.deadline.replace("Z", "+00:00"))
        except Exception:
            deadline = None

    return {
        "title": data.title,
        "description": data.description,
        "lecture_id": data.lecture_id,
        "course_id": data.course_id,
        "deadline": deadline,
        "is_published": True,
        "deadline_notified": False,
        "created_at": datetime.now(timezone.utc),
    }


def submission_doc(assignment_id: str, student_id: str, text_answer: str) -> dict:
    return {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "text_answer": text_answer,
        "grade": None,
        "teacher_note": None,
        "submitted_at": datetime.now(timezone.utc),
    }