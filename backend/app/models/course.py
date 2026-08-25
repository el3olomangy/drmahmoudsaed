from datetime import datetime, timezone


def course_doc(data) -> dict:
    return {
        "title": data.title,
        "description": data.description,
        "grade": data.grade,
        "course_type": getattr(data, "course_type", "paid"),
        "price": data.price,
        "thumbnail": data.thumbnail,
        "lectures_count": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }


def unit_doc(data, course_id: str) -> dict:
    return {
        "title": data.title,
        "order": data.order,
        "course_id": course_id,
        "is_published": True,
        "created_at": datetime.now(timezone.utc),
    }


def lecture_doc(data, unit_id: str, course_id: str) -> dict:
    return {
        "title": data.title,
        "description": data.description,
        "video_url": data.video_url,
        "pdf_url": data.pdf_url,
        "order": data.order,
        "lecture_type": data.lecture_type,
        "duration_minutes": data.duration_minutes,
        "unit_id": unit_id,
        "course_id": course_id,
        "is_published": True,
        "published_at": None,
        "created_at": datetime.now(timezone.utc),
    }