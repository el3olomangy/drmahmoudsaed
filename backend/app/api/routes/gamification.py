"""واجهات الـ Gamification: بروفايل الطالب (Level/XP)، XP لكل كورس،
لوحة المتصدرين (عامة للزوار)، وتحكّم الطالب في ظهوره في الترتيب.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional

from ...core.database import get_db, is_valid_id
from ...core.dependencies import get_current_user
from ...core.gamification import compute_level, LEVELS

router = APIRouter(prefix="/gamification", tags=["Gamification"])


def _default_avatar(gender: Optional[str]) -> str:
    """أفاتار افتراضي حسب النوع لو الطالب مرفعش صورة."""
    g = (gender or "").lower()
    if g in ("female", "f", "أنثى", "بنت"):
        return "female"
    return "male"


def _student_card(user: dict, rank: int = None) -> dict:
    total_xp = int(user.get("total_xp", 0) or 0)
    lvl = compute_level(total_xp)
    card = {
        "id": str(user["_id"]),
        "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "avatar_url": user.get("avatar_url"),
        "default_avatar": _default_avatar(user.get("gender")),
        "grade": user.get("grade"),
        "total_xp": total_xp,
        "level": lvl["level"],
        "title": lvl["title"],
    }
    if rank is not None:
        card["rank"] = rank
    return card


# ============================================================
#   بروفايل الطالب الحالي
# ============================================================

@router.get("/me")
async def my_gamification(current_user=Depends(get_current_user), db=Depends(get_db)):
    """كل بيانات الـ Gamification للطالب الحالي: Level، Title، XP، التقدّم."""
    total_xp = int(current_user.get("total_xp", 0) or 0)
    lvl = compute_level(total_xp)
    return {
        **lvl,
        "name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        "avatar_url": current_user.get("avatar_url"),
        "default_avatar": _default_avatar(current_user.get("gender")),
        # الظهور في الترتيب — غياب المفتاح معناه ظاهر (Default ON)
        "leaderboard_visible": current_user.get("leaderboard_visible", True) is not False,
    }


@router.get("/me/course/{course_id}")
async def my_course_xp(course_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    """XP الطالب في كورس معيّن (بيتجمع من أحداث الـ XP)."""
    student_id = str(current_user["_id"])
    events = await db.xp_events.query({"student_id": student_id}).to_list(5000)
    course_xp = sum(
        int(e.get("xp", 0) or 0)
        for e in events
        if (e.get("meta") or {}).get("course_id") == course_id
    )
    return {"course_id": course_id, "course_xp": course_xp}


@router.get("/me/rank")
async def my_rank(current_user=Depends(get_current_user), db=Depends(get_db)):
    """ترتيب الطالب الحالي وسط طلاب نفس مرحلته (حسب الـ XP).

    بيحسب الترتيب بين كل طلاب الصف اللي عندهم XP أكبر من صفر. لو الطالب لسه
    مجمّعش XP، بيرجّع ranked=False. محصّن ضد الأخطاء (بيرجّع ranked=False لو حصل خطأ).
    """
    grade = current_user.get("grade")
    my_xp = int(current_user.get("total_xp", 0) or 0)
    lvl = compute_level(my_xp)

    base = {
        "grade": grade,
        "total_xp": my_xp,
        "level": lvl["level"],
        "title": lvl["title"],
    }

    if not grade or my_xp <= 0:
        return {"ranked": False, "rank": None, "total_ranked": 0, **base}

    try:
        students = await db.users.query({"grade": grade}).to_list(50000)
    except Exception as e:
        print(f"[my_rank] failed: {e}")
        return {"ranked": False, "rank": None, "total_ranked": 0, **base}

    peers = [
        int(s.get("total_xp", 0) or 0)
        for s in students
        if s.get("role") == "student" and int(s.get("total_xp", 0) or 0) > 0
    ]
    higher = sum(1 for xp in peers if xp > my_xp)
    return {
        "ranked": True,
        "rank": higher + 1,          # التعادل بياخد نفس المركز
        "total_ranked": len(peers),
        **base,
    }


class VisibilityUpdate(BaseModel):
    visible: bool


@router.patch("/me/visibility")
async def set_visibility(data: VisibilityUpdate, current_user=Depends(get_current_user), db=Depends(get_db)):
    """الطالب يتحكّم في ظهوره في لوحة المتصدرين."""
    await db.users.set_fields(
        {"_id": current_user["_id"]},
        {"$set": {"leaderboard_visible": bool(data.visible)}},
    )
    return {"leaderboard_visible": bool(data.visible)}


# ============================================================
#   لوحة المتصدرين (عامة — للزوار)
# ============================================================

@router.get("/leaderboard")
async def leaderboard(
    grade: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db=Depends(get_db),
):
    """أعلى الطلاب بالـ XP. عامة (من غير تسجيل دخول) — بترجّع بيانات عامة بس:
    الاسم، الصورة/الأفاتار، الصف، Level، Title، XP، الترتيب.

    بتحترم خصوصية الطالب: اللي قافل ظهوره في الترتيب مايظهرش.
    فلترة اختيارية بالصف.

    ملاحظة: لو حصل أي خطأ في القراءة، بترجّع قائمة فاضية (200) عشان
    ماتكسرش الصفحة الرئيسية — الأخطاء بتتسجّل في لوج السيرفر.
    """
    try:
        students = await db.users.query({"role": "student"}).to_list(50000)
    except Exception as e:
        print(f"[leaderboard] failed to load students: {e}")
        return {"grade": grade, "count": 0, "students": []}

    ranked = []
    for s in students:
        try:
            if s.get("leaderboard_visible", True) is False:
                continue
            if int(s.get("total_xp", 0) or 0) <= 0:
                continue
            if grade and s.get("grade") != grade:
                continue
            ranked.append(s)
        except Exception:
            continue

    ranked.sort(key=lambda u: int(u.get("total_xp", 0) or 0), reverse=True)
    ranked = ranked[:limit]

    cards = []
    for i, s in enumerate(ranked):
        try:
            cards.append(_student_card(s, rank=i + 1))
        except Exception:
            continue

    return {"grade": grade, "count": len(cards), "students": cards}


@router.get("/levels")
async def levels_info():
    """جدول الـ Levels (للعرض/التوضيح لو محتاجه الفرونت)."""
    return {
        "levels": [
            {"level": n, "title": t, "min_xp": m} for (n, t, m) in LEVELS
        ]
    }
