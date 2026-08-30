"""نظام الـ Gamification (XP + Levels) — مركزي وخفيف.

كل الأرقام (XP المطلوب لكل Level + XP كل نشاط) موجودة هنا في مكان واحد،
فتقدر تغيّرها من غير ما تلمس أي Logic في باقي المنصة.

المبادئ:
- الطالب ميخسرش XP أبدًا، وليفله ميقلّش أبدًا.
- الـ Level والـ Title بيتحسبوا من total_xp (مش متخزّنين).
- كل XP مربوط بإنجاز حقيقي، وبيتسجّل بـ reference فريد يمنع التكرار (ledger).
"""

from datetime import datetime, timezone


# ============================================================
#   الإعدادات المركزية (عدّل من هنا بس)
# ============================================================

# (رقم الـ Level، اللقب، أقل XP للوصول له) — مرتّبة تصاعديًا
LEVELS = [
    (1, "📚 طالب بصمجي", 0),
    (2, "🧠 طالب متفوق", 250),
    (3, "🔬 عالم ناشئ", 600),
    (4, "🧪 عالم مخضرم", 1200),
    (5, "⚗️ عالم العلوم", 2000),
    (6, "👑 علومنجي", 3000),
]

# XP كل نشاط
XP = {
    "lecture_watched": 5,      # إكمال مشاهدة محاضرة

    "homework_base": 10,       # تسليم واجب
    "homework_80": 5,          # بونس 80%+
    "homework_100": 5,         # بونس 100%

    "quiz_base": 10,           # كويز محاضرة
    "quiz_80": 5,
    "quiz_100": 5,

    "unit_completed": 25,      # إكمال كل الـ Unit (مرة واحدة)

    "final_base": 30,          # الامتحان الشامل (Final)
}

# بونس الـ Final حسب النسبة: (أقل نسبة، البونس) — بيتاخد أعلى شريحة مطابقة
FINAL_TIERS = [
    (100, 30),
    (90, 20),
    (80, 15),
    (70, 10),
    (50, 5),
]


# ============================================================
#   حساب الـ Level والتقدّم
# ============================================================

def compute_level(total_xp) -> dict:
    """يحسب الـ Level والـ Title والتقدّم داخل الـ Level من إجمالي الـ XP."""
    xp = max(0, int(total_xp or 0))

    current = LEVELS[0]
    nxt = None
    for i, lvl in enumerate(LEVELS):
        if xp >= lvl[2]:
            current = lvl
            nxt = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
        else:
            break

    level_num, title, current_min = current
    is_max = nxt is None

    if is_max:
        next_min = None
        into = xp - current_min
        span = 0
        remaining = 0
        percent = 100
    else:
        next_min = nxt[2]
        into = xp - current_min
        span = next_min - current_min
        remaining = max(0, next_min - xp)
        percent = round(into / span * 100) if span > 0 else 0

    return {
        "level": level_num,
        "title": title,
        "total_xp": xp,
        "current_level_min_xp": current_min,
        "next_level_min_xp": next_min,          # None لو أعلى Level
        "next_level_title": nxt[1] if nxt else None,
        "xp_into_level": into,
        "xp_for_this_level": span,              # المسافة بين الـ Level الحالي واللي بعده
        "xp_remaining": remaining,              # للانتقال للـ Level اللي بعده
        "progress_percent": max(0, min(100, percent)),
        "is_max_level": is_max,
    }


# ============================================================
#   حساب XP كل نشاط
# ============================================================

def homework_xp(score) -> int:
    """XP الواجب الأوتوماتيك (max 20)."""
    s = float(score or 0)
    total = XP["homework_base"]
    if s >= 80:
        total += XP["homework_80"]
    if s >= 100:
        total += XP["homework_100"]
    return total


def quiz_xp(score) -> int:
    """XP كويز المحاضرة (max 20)."""
    s = float(score or 0)
    total = XP["quiz_base"]
    if s >= 80:
        total += XP["quiz_80"]
    if s >= 100:
        total += XP["quiz_100"]
    return total


def final_xp(score) -> int:
    """XP الامتحان الشامل (max 60): 30 أساسي + بونس حسب النسبة."""
    s = float(score or 0)
    bonus = 0
    for min_pct, b in FINAL_TIERS:
        if s >= min_pct:
            bonus = b
            break
    return XP["final_base"] + bonus


# ============================================================
#   الـ Ledger (منع تكرار الـ XP) + إضافة XP
# ============================================================

def _dedup_key(student_id: str, reference_id: str) -> str:
    return f"{student_id}:{reference_id}"


async def _bump_total(db, student_id: str, delta: int) -> dict:
    """يزوّد total_xp للطالب ذرّيًا ويرجّع الـ level قبل وبعد (للـ level-up)."""
    user = await db.users.get_one({"_id": student_id})
    before = int((user or {}).get("total_xp", 0) or 0)
    await db.users.set_fields({"_id": student_id}, {"$inc": {"total_xp": delta}})
    after = before + delta
    lvl_before = compute_level(before)
    lvl_after = compute_level(after)
    return {
        "total_xp": after,
        "leveled_up": lvl_after["level"] > lvl_before["level"],
        "new_level": lvl_after["level"],
        "new_title": lvl_after["title"],
    }


async def award_xp(db, student_id: str, kind: str, reference_id: str,
                   xp: int, meta: dict = None) -> dict:
    """يضيف XP مرة واحدة فقط لكل reference (idempotent).

    kind: lecture_watched | homework | quiz | final_exam | unit_completed
    reference_id: مفتاح الإنجاز الفريد (مثلاً lecture:<id>)
    """
    result = {"awarded": 0, "duplicate": False, "leveled_up": False}
    if not student_id or xp <= 0:
        return result

    dedup = _dedup_key(student_id, reference_id)
    existing = await db.xp_events.get_one({"dedup_key": dedup})
    if existing:
        result["duplicate"] = True
        return result

    await db.xp_events.add({
        "student_id": student_id,
        "kind": kind,
        "reference_id": reference_id,
        "dedup_key": dedup,
        "xp": xp,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc),
    })
    bump = await _bump_total(db, student_id, xp)
    result.update({"awarded": xp, **bump})
    return result


async def award_or_topup_xp(db, student_id: str, kind: str, reference_id: str,
                            target_xp: int, meta: dict = None) -> dict:
    """للامتحانات: لو الإنجاز اتسجّل قبل كده بـ XP أقل (مثلاً قبل تصحيح المقالي)،
    بنزوّد الفرق بس عشان الدرجة الأعلى — الطالب ميخسرش XP أبدًا."""
    result = {"awarded": 0, "duplicate": False, "leveled_up": False}
    if not student_id or target_xp <= 0:
        return result

    dedup = _dedup_key(student_id, reference_id)
    existing = await db.xp_events.get_one({"dedup_key": dedup})

    if not existing:
        return await award_xp(db, student_id, kind, reference_id, target_xp, meta)

    prev = int(existing.get("xp", 0) or 0)
    if target_xp <= prev:
        result["duplicate"] = True
        return result

    diff = target_xp - prev
    await db.xp_events.set_fields(
        {"_id": existing["_id"]},
        {"$set": {"xp": target_xp, "meta": meta or existing.get("meta", {}),
                  "updated_at": datetime.now(timezone.utc)}},
    )
    bump = await _bump_total(db, student_id, diff)
    result.update({"awarded": diff, "topped_up": True, **bump})
    return result


# ============================================================
#   إكمال الـ Unit (بونس مرة واحدة)
# ============================================================

async def maybe_award_unit_completion(db, student_id: str, unit_id: str,
                                      course_id: str = None) -> dict:
    """يمنح بونس إكمال الـ Unit لو الطالب خلّص كل متطلباتها:
    كل المحاضرات اتشافت + كل الواجبات والكويزات المربوطة بالـ Unit اتسلّمت.
    بيتمنح مرة واحدة بس لكل Unit.
    """
    none = {"awarded": 0, "duplicate": False, "leveled_up": False}
    if not unit_id:
        return none

    # لو اتمنح قبل كده، نبطّل بدري
    dedup = _dedup_key(student_id, f"unit:{unit_id}")
    if await db.xp_events.get_one({"dedup_key": dedup}):
        return none

    # 1) كل محاضرات الـ Unit
    lectures = await db.lectures.query({"unit_id": unit_id}).to_list(500)
    lecture_ids = [str(l["_id"]) for l in lectures]
    if not lecture_ids:
        return none  # Unit من غير محاضرات — مفيش إكمال نحسبه

    watched = await db.lecture_progress.query({
        "user_id": student_id,
        "lecture_id": {"$in": lecture_ids},
        "watched": True,
    }).to_list(1000)
    if len({d["lecture_id"] for d in watched}) < len(lecture_ids):
        return none  # لسه فيه محاضرات مش متشافة

    # 2) الواجبات المربوطة بالـ Unit (بالـ unit_id أو بمحاضرة جواها)
    hw_by_unit = await db.homeworks.query({"unit_id": unit_id}).to_list(500)
    hw_by_lec = await db.homeworks.query({"lecture_id": {"$in": lecture_ids}}).to_list(500)
    homeworks = {str(h["_id"]): h for h in (hw_by_unit + hw_by_lec)}
    for hid in homeworks:
        if not await db.homework_results.get_one({"homework_id": hid, "student_id": student_id}):
            return none  # واجب لسه مش متسلّم

    # 3) كويزات المحاضرات المربوطة بالـ Unit (استبعاد الـ Final اللي من غير محاضرة)
    ex_by_unit = await db.exams.query({"unit_id": unit_id}).to_list(500)
    ex_by_lec = await db.exams.query({"lecture_id": {"$in": lecture_ids}}).to_list(500)
    quizzes = {str(e["_id"]): e for e in (ex_by_unit + ex_by_lec) if e.get("lecture_id")}
    for qid in quizzes:
        if not await db.exam_results.get_one({"exam_id": qid, "student_id": student_id}):
            return none  # كويز لسه مش متعمل

    # خلّص كل حاجة → امنح البونس
    return await award_xp(
        db, student_id, "unit_completed", f"unit:{unit_id}",
        XP["unit_completed"], {"unit_id": unit_id, "course_id": course_id},
    )
