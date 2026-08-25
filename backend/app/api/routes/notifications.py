from fastapi import APIRouter, Depends
from typing import List
from datetime import datetime, timezone
from ...core.database import get_db
from ...core.dependencies import get_current_user, get_current_teacher_or_assistant
from ...schemas.notification import NotificationCreate, NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def notification_helper(n, user_id: str) -> dict:
    return {
        "id": str(n["_id"]),
        "title": n["title"],
        "body": n["body"],
        "notification_type": n["notification_type"],
        "is_read": user_id in n.get("read_by", []),
        "created_at": n["created_at"],
    }

def _visible_notifications_query(current_user) -> dict:
    """كويري الإشعارات اللي المستخدم مسموح يشوفها.

    الطالب يشوف بس الإشعارات اللي اتبعتت *بعد* ما حسابه اتعمل — الإشعارات
    الأقدم من تاريخ إنشاء الحساب مش بتظهرله. (لو مفيش created_at لأي سبب،
    مابنطبّقش الفلتر عشان ما نخفيش كل الإشعارات بالغلط.)
    """
    user_id = str(current_user["_id"])
    grade = current_user.get("grade")
    query: dict = {
        "$or": [
            {"target_user_id": user_id},
            {"target_grade": grade},
            {"target_grade": None, "target_user_id": None},
        ]
    }
    created_at = current_user.get("created_at")
    if created_at:
        query["created_at"] = {"$gte": created_at}
    return query


@router.post("/", status_code=201)
async def create_notification(data: NotificationCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    notif_doc = {
        "title": data.title,
        "body": data.body,
        "notification_type": data.notification_type,
        "target_grade": data.target_grade,
        "target_user_id": data.target_user_id,
        "read_by": [],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.notifications.add(notif_doc)
    return {"id": str(result.inserted_id), "message": "تم إرسال الإشعار"}

@router.get("/", response_model=List[NotificationResponse])
async def get_my_notifications(current_user=Depends(get_current_user), db=Depends(get_db)):
    user_id = str(current_user["_id"])
    query = _visible_notifications_query(current_user)
    notifications = await db.notifications.query(query).sort("created_at", -1).to_list(100)
    return [notification_helper(n, user_id) for n in notifications]

# ====== الثابتة أولاً — قبل /{notification_id} ======

@router.patch("/read-all")
async def mark_all_read(current_user=Depends(get_current_user), db=Depends(get_db)):
    user_id = str(current_user["_id"])
    query = _visible_notifications_query(current_user)
    await db.notifications.set_fields_many(
        query,
        {"$addToSet": {"read_by": user_id}}
    )
    return {"message": "تم تحديد كل الإشعارات كمقروءة"}

@router.get("/unread-count")
async def get_unread_count(current_user=Depends(get_current_user), db=Depends(get_db)):
    user_id = str(current_user["_id"])
    query = _visible_notifications_query(current_user)
    # كمان لازم تكون لسه مش مقروءة
    query["read_by"] = {"$nin": [user_id]}
    count = await db.notifications.count(query)
    return {"unread_count": count}

# ====== /{notification_id} الأخير دايماً ======

@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    user_id = str(current_user["_id"])
    await db.notifications.set_fields(
        {"_id": notification_id},
        {"$addToSet": {"read_by": user_id}}
    )
    return {"message": "تم تحديد الإشعار كمقروء"}