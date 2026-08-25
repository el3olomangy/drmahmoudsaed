from datetime import datetime, timezone
from ..schemas.user import UserRole


def user_doc(data, hashed_password: str) -> dict:
    return {
        "first_name": data.first_name,
        "last_name": data.last_name,
        "phone": data.phone,
        "parent_phone": data.parent_phone,
        "password": hashed_password,
        "gender": data.gender,
        "grade": data.grade,
        "governorate": data.governorate,
        "role": UserRole.student,
        "device_id": None,
        "is_active": True,
        "enrolled_courses": [],
        "created_at": datetime.now(timezone.utc),
    }


def user_public(user: dict) -> dict:
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
        "created_at": user.get("created_at"),
    }