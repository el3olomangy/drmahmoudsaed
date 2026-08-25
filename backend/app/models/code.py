from datetime import datetime, timezone


def code_doc(code_str: str, data, expires_at) -> dict:
    return {
        "code": code_str,
        "code_type": data.code_type,
        "status": "active",
        "course_id": data.course_id,
        "bundle_ids": data.bundle_ids,
        "used_by": None,
        "used_at": None,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    }