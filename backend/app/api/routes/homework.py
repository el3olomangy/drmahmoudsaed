from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from ...core.database import is_valid_id, new_id
from datetime import datetime, timezone
from ...core.database import get_db
from ...core.dependencies import get_current_user, get_current_teacher, get_current_teacher_or_assistant
from ...core.notify import notify_course_audience
from ...schemas.homework import HomeworkCreate, HomeworkSubmit, HSaveAnswerRequest, HSubmitAttemptRequest
from ...models.homework import (
    homework_doc as build_homework_doc,
    homework_question_doc as build_question_doc,
    homework_attempt_doc as build_attempt_doc,
)

router = APIRouter(prefix="/homework", tags=["Homework"])


def validate_object_id(id_str: str) -> str:
    if not is_valid_id(id_str):
        raise HTTPException(status_code=422, detail="ID غير صالح")
    return id_str


def _is_expired(hw: dict) -> bool:
    deadline = hw.get("deadline")
    if not deadline:
        return False
    dl = deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > dl


def question_helper(q) -> dict:
    return {
        "id": str(q["_id"]),
        "text": q["text"],
        "question_type": q["question_type"],
        # الطالب يشوف بس الاختيارات اللي مكتوب فيها نص فعلي — أي اختيار فاضي (بيانات قديمة مثلًا) بيتجاهل
        "choices": [
            {"id": str(i), "text": c["text"]}
            for i, c in enumerate(q.get("choices", []))
            if c.get("text") and c["text"].strip()
        ],
        "points": q["points"],
        "image_url": q.get("image_url"),
    }


def _to_aware(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _not_started_yet(hw: dict) -> bool:
    scheduled_at = hw.get("scheduled_at")
    if not scheduled_at:
        return False
    return datetime.now(timezone.utc) < _to_aware(scheduled_at)


def _remaining_seconds(hw: dict):
    """الثواني المتبقية لحد موعد التسليم — أو None لو الواجب مالوش موعد."""
    deadline = hw.get("deadline")
    if not deadline:
        return None
    delta = _to_aware(deadline) - datetime.now(timezone.utc)
    return max(0, int(delta.total_seconds()))


def _grade_answers(hw: dict, answers_list: list) -> dict:
    """يصحّح إجابات الطالب ويرجّع كل اللي محتاجينه لتخزين النتيجة."""
    total_points = sum(q["points"] for q in hw["questions"])
    earned_points = 0
    answers_log = []
    questions_map = {str(q["_id"]): q for q in hw["questions"]}

    for answer in answers_list:
        qid = answer.get("question_id")
        q = questions_map.get(qid)
        if not q:
            continue
        is_correct = False
        selected_text = None
        earned = 0
        selected_choice = answer.get("selected_choice")
        if q["question_type"] == "mcq" and q.get("choices"):
            for i, choice in enumerate(q["choices"]):
                if str(i) == str(selected_choice):
                    selected_text = choice.get("text")
                    if choice.get("is_correct"):
                        is_correct = True
                        earned = q["points"]
                        earned_points += earned
                    break
        answers_log.append({
            "question_id": qid,
            "selected_choice": selected_choice,
            "selected_text": selected_text,
            "essay_answer": answer.get("essay_answer"),
            "essay_answer_image_url": answer.get("essay_answer_image_url"),
            "essay_answer_image_path": answer.get("essay_answer_image_path"),
            "is_correct": is_correct,
            "earned_points": earned,
        })

    score = (earned_points / total_points * 100) if total_points > 0 else 0
    passed = score >= hw["pass_score"]
    return {
        "answers_log": answers_log,
        "earned_points": earned_points,
        "total_points": total_points,
        "score": score,
        "passed": passed,
    }


def _draft_to_answers_list(draft_answers: dict) -> list:
    out = []
    for qid, a in (draft_answers or {}).items():
        a = a or {}
        out.append({
            "question_id": qid,
            "selected_choice": a.get("selected_choice"),
            "essay_answer": a.get("essay_answer"),
            "essay_answer_image_url": a.get("essay_answer_image_url"),
            "essay_answer_image_path": a.get("essay_answer_image_path"),
        })
    return out


async def _store_homework_result(db, hw: dict, student_id: str, graded: dict, auto_submitted: bool = False) -> None:
    result_doc = {
        "homework_id": str(hw["_id"]),
        "student_id": student_id,
        "score": graded["score"],
        "passed": graded["passed"],
        "total_points": graded["total_points"],
        "earned_points": graded["earned_points"],
        "submitted_at": datetime.now(timezone.utc),
        "answers": graded["answers_log"],
        "essay_fully_reviewed": False,
        "auto_submitted": auto_submitted,
    }
    await db.homework_results.add(result_doc)


async def finalize_homework_attempt(db, hw: dict, attempt: dict, auto_submitted: bool = False) -> dict:
    """يسلّم جلسة واجب: يصحّح المسودة، يخزّن النتيجة، ويقفل الجلسة. آمن ضد التكرار."""
    student_id = attempt["student_id"]
    homework_id = str(hw["_id"])

    fresh = await db.homework_attempts.get_one({"_id": attempt["_id"]})
    if fresh and fresh.get("status") == "submitted":
        existing = await db.homework_results.get_one({"homework_id": homework_id, "student_id": student_id})
        if existing:
            return {"score": existing["score"], "passed": existing["passed"],
                    "earned_points": existing["earned_points"], "total_points": existing["total_points"]}

    existing = await db.homework_results.get_one({"homework_id": homework_id, "student_id": student_id})
    if existing:
        await db.homework_attempts.set_fields({"_id": attempt["_id"]}, {"$set": {"status": "submitted"}})
        return {"score": existing["score"], "passed": existing["passed"],
                "earned_points": existing["earned_points"], "total_points": existing["total_points"]}

    graded = _grade_answers(hw, _draft_to_answers_list((fresh or attempt).get("draft_answers")))
    await _store_homework_result(db, hw, student_id, graded, auto_submitted=auto_submitted)
    await db.homework_attempts.set_fields(
        {"_id": attempt["_id"]},
        {"$set": {"status": "submitted", "auto_submitted": auto_submitted,
                  "finalized_at": datetime.now(timezone.utc)}},
    )
    return {"score": graded["score"], "passed": graded["passed"],
            "earned_points": graded["earned_points"], "total_points": graded["total_points"]}


def _hw_immediate_or_hidden(hw: dict, result: dict) -> dict:
    # الدرجة والنسبة بترجع دايمًا (أوبشن المراجعة بقى بيتحكم في الإجابات بس)
    return {
        "message": "تم تسليم الواجب",
        "score": round(result["score"], 2),
        "passed": result["passed"],
        "earned_points": result["earned_points"],
        "total_points": result["total_points"],
    }


# ====== إنشاء واجب (المدرس والمساعد) ======

@router.post("/", status_code=201)
async def create_homework(data: HomeworkCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    for i, q in enumerate(data.questions):
        if not (q.text and q.text.strip()) and not q.image_url:
            raise HTTPException(400, f"السؤال {i + 1}: لازم نص أو صورة على الأقل")
    if data.scheduled_at and data.deadline:
        start = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
        end = datetime.fromisoformat(data.deadline.replace("Z", "+00:00"))
        if end <= start:
            raise HTTPException(400, "موعد التسليم لازم يكون بعد وقت البداية")
    questions_docs = [build_question_doc(q) for q in data.questions]
    doc = build_homework_doc(data, questions_docs)
    result = await db.homeworks.add(doc)

    course = await db.courses.get_one({"_id": data.course_id})
    if course:
        await notify_course_audience(
            db,
            course,
            f"واجب جديد: {data.title}",
            f"تم رفع واجب جديد في كورس \"{course.get('title', '')}\" — متنساش تسلّمه قبل الموعد.",
            "new_homework",
        )

    return {"id": str(result.inserted_id), "message": "تم إنشاء الواجب"}


# ====== routes الثابتة أولًا — قبل /{homework_id} ======

@router.post("/submit", response_model=dict)
async def submit_homework(data: HomeworkSubmit, current_user=Depends(get_current_user), db=Depends(get_db)):
    hw = await db.homeworks.get_one({"_id": validate_object_id(data.homework_id)})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")

    existing = await db.homework_results.get_one({
        "homework_id": data.homework_id,
        "student_id": str(current_user["_id"])
    })
    if existing:
        raise HTTPException(status_code=400, detail="سلّمت الواجب ده قبل كده")

    # امنع التسليم لو موعد التسليم فات
    if _is_expired(hw):
        raise HTTPException(status_code=400, detail="انتهى موعد تسليم الواجب")

    if _not_started_yet(hw):
        raise HTTPException(status_code=400, detail="الواجب لسه معداش ساعته")

    answers_list = [{
        "question_id": a.question_id,
        "selected_choice": a.selected_choice,
        "essay_answer": a.essay_answer,
        "essay_answer_image_url": a.essay_answer_image_url,
        "essay_answer_image_path": a.essay_answer_image_path,
    } for a in data.answers]
    graded = _grade_answers(hw, answers_list)
    await _store_homework_result(db, hw, str(current_user["_id"]), graded)
    score = graded["score"]
    passed = graded["passed"]
    earned_points = graded["earned_points"]
    total_points = graded["total_points"]

    # لو الطالب كان له جلسة مفتوحة، نقفلها
    open_attempt = await db.homework_attempts.get_one({
        "homework_id": data.homework_id, "student_id": str(current_user["_id"]), "status": "in_progress"
    })
    if open_attempt:
        await db.homework_attempts.set_fields({"_id": open_attempt["_id"]}, {"$set": {"status": "submitted"}})

    # الدرجة والنسبة بتظهر دايمًا للطالب بعد التسليم
    return {
        "message": "تم تسليم الواجب",
        "score": round(score, 2),
        "passed": passed,
        "earned_points": earned_points,
        "total_points": total_points,
    }


@router.post("/{homework_id}/start")
async def start_homework_attempt(homework_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    """يبدأ (أو يستأنف) جلسة واجب.

    الواجب مالوش مؤقّت شخصي — بس الـ deadline العام. بيرجّع session_token جديد كل مرة
    عشان يمنع الحل من أكتر من جهاز، وبيرجّع المسودة المحفوظة عشان الطالب يكمّل مكانه.
    """
    hw = await db.homeworks.get_one({"_id": validate_object_id(homework_id)})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")

    student_id = str(current_user["_id"])

    existing_result = await db.homework_results.get_one({"homework_id": homework_id, "student_id": student_id})
    if existing_result:
        raise HTTPException(status_code=400, detail="سلّمت الواجب ده قبل كده")

    if _is_expired(hw):
        raise HTTPException(status_code=400, detail="انتهى موعد تسليم الواجب")

    if _not_started_yet(hw):
        raise HTTPException(status_code=400, detail="الواجب لسه معداش ساعته")

    attempt = await db.homework_attempts.get_one({"homework_id": homework_id, "student_id": student_id})
    now = datetime.now(timezone.utc)

    if attempt and attempt.get("status") == "in_progress":
        # استئناف: نجدّد التوكن عشان نلغّي أي جهاز تاني
        new_token = new_id()
        await db.homework_attempts.set_fields(
            {"_id": attempt["_id"]}, {"$set": {"session_token": new_token}}
        )
        return {
            "session_token": new_token,
            "remaining_seconds": _remaining_seconds(hw),
            "draft_answers": attempt.get("draft_answers", {}),
            "resumed": True,
        }

    # جلسة جديدة
    session_token = new_id()
    doc = build_attempt_doc(homework_id, student_id, session_token, now)
    if attempt:
        await db.homework_attempts.set_fields({"_id": attempt["_id"]}, {"$set": doc})
    else:
        await db.homework_attempts.add(doc)

    return {
        "session_token": session_token,
        "remaining_seconds": _remaining_seconds(hw),
        "draft_answers": {},
        "resumed": False,
    }


@router.post("/{homework_id}/save-answer")
async def save_homework_answer(homework_id: str, data: HSaveAnswerRequest,
                               current_user=Depends(get_current_user), db=Depends(get_db)):
    """يحفظ إجابة سؤال واحد فورًا في مسودة الجلسة (auto-save)."""
    student_id = str(current_user["_id"])
    attempt = await db.homework_attempts.get_one({"homework_id": homework_id, "student_id": student_id})
    if not attempt or attempt.get("status") != "in_progress":
        raise HTTPException(status_code=400, detail="مفيش جلسة واجب مفتوحة")

    if attempt.get("session_token") != data.session_token:
        raise HTTPException(status_code=409, detail="الواجب مفتوح في مكان تاني")

    # الموعد فات؟ نرفض الحفظ (الـ scheduler هيسلّم المسودة تلقائيًا)
    hw = await db.homeworks.get_one({"_id": validate_object_id(homework_id)})
    if hw and _is_expired(hw):
        await finalize_homework_attempt(db, hw, attempt, auto_submitted=True)
        raise HTTPException(status_code=409, detail="انتهى موعد تسليم الواجب")

    entry = {
        "selected_choice": data.selected_choice,
        "essay_answer": data.essay_answer,
        "essay_answer_image_url": data.essay_answer_image_url,
        "essay_answer_image_path": data.essay_answer_image_path,
    }
    draft = dict(attempt.get("draft_answers") or {})
    draft[data.question_id] = entry
    await db.homework_attempts.set_fields(
        {"_id": attempt["_id"]},
        {"$set": {"draft_answers": draft, "last_saved_at": datetime.now(timezone.utc)}},
    )
    return {"saved": True}


@router.post("/{homework_id}/submit-attempt")
async def submit_homework_attempt(homework_id: str, data: HSubmitAttemptRequest,
                                  current_user=Depends(get_current_user), db=Depends(get_db)):
    """التسليم النهائي من الطالب (زر تسليم)."""
    hw = await db.homeworks.get_one({"_id": validate_object_id(homework_id)})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")

    student_id = str(current_user["_id"])

    existing_result = await db.homework_results.get_one({"homework_id": homework_id, "student_id": student_id})
    if existing_result:
        return _hw_immediate_or_hidden(hw, {
            "score": existing_result["score"], "passed": existing_result["passed"],
            "earned_points": existing_result["earned_points"], "total_points": existing_result["total_points"],
        })

    if _is_expired(hw):
        raise HTTPException(status_code=400, detail="انتهى موعد تسليم الواجب")

    attempt = await db.homework_attempts.get_one({"homework_id": homework_id, "student_id": student_id})
    if not attempt or attempt.get("status") != "in_progress":
        raise HTTPException(status_code=400, detail="مفيش جلسة واجب مفتوحة")

    if attempt.get("session_token") != data.session_token:
        raise HTTPException(status_code=409, detail="الواجب مفتوح في مكان تاني")

    result = await finalize_homework_attempt(db, hw, attempt, auto_submitted=False)
    return _hw_immediate_or_hidden(hw, result)


@router.get("/{homework_id}/my-attempt")
async def get_my_homework_attempt(homework_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    """حالة جلسة الطالب: submitted / active / none."""
    student_id = str(current_user["_id"])
    existing_result = await db.homework_results.get_one({"homework_id": homework_id, "student_id": student_id})
    if existing_result:
        return {"status": "submitted"}
    attempt = await db.homework_attempts.get_one({"homework_id": homework_id, "student_id": student_id})
    if not attempt or attempt.get("status") != "in_progress":
        return {"status": "none"}
    return {"status": "active"}


@router.get("/course/{course_id}")
async def get_course_homeworks(course_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    homeworks = await db.homeworks.query({"course_id": course_id}).to_list(100)
    return [{
        "id": str(h["_id"]),
        "title": h["title"],
        "lecture_id": h.get("lecture_id"),
        "pass_score": h.get("pass_score", 50),
        "scheduled_at": h.get("scheduled_at"),
        "deadline": h.get("deadline"),
        "is_expired": _is_expired(h),
        "not_started_yet": _not_started_yet(h),
        "show_result_immediately": h.get("show_result_immediately", True),
    } for h in homeworks]


@router.get("/results/{homework_id}")
async def get_homework_results(homework_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    results = await db.homework_results.query({"homework_id": homework_id}).to_list(500)

    hw = await db.homeworks.get_one({"_id": validate_object_id(homework_id)}) if is_valid_id(homework_id) else None
    questions_map = {}
    if hw:
        for q in hw.get("questions", []):
            qid = str(q["_id"])
            choices = q.get("choices", [])
            correct_text = next((c["text"] for c in choices if c.get("is_correct")), None)
            questions_map[qid] = {
                "text": q.get("text", ""),
                "type": q.get("question_type", "mcq"),
                "points": q.get("points", 1),
                "correct_answer": correct_text,
                "choices": choices,
                "image_url": q.get("image_url"),
            }

    output = []
    for r in results:
        student = await db.users.get_one({"_id": r["student_id"]}) if is_valid_id(r["student_id"]) else None
        student_name = f"{student['first_name']} {student['last_name']}" if student else "—"
        student_phone = student.get("phone", "—") if student else "—"

        answers_detail = []
        for ans in r.get("answers", []):
            qid = ans.get("question_id", "")
            q_info = questions_map.get(qid, {})
            choices = q_info.get("choices", [])

            selected_text = ans.get("selected_text")
            if not selected_text:
                sel = ans.get("selected_choice")
                if sel is not None:
                    try:
                        idx = int(sel)
                        if 0 <= idx < len(choices):
                            selected_text = choices[idx].get("text")
                    except (ValueError, TypeError):
                        selected_text = sel

            answers_detail.append({
                "question_id": qid,
                "question_text": q_info.get("text", ""),
                "question_type": q_info.get("type", "mcq"),
                "question_image": q_info.get("image_url"),
                "max_points": q_info.get("points", 1),
                "correct_answer": q_info.get("correct_answer"),
                "selected_text": selected_text,
                "essay_answer": ans.get("essay_answer"),
                "essay_answer_image": ans.get("essay_answer_image_url"),
                "is_correct": ans.get("is_correct", False),
                "earned_points": (
                    ans.get("essay_earned_points", 0)
                    if q_info.get("type") == "essay"
                    else ans.get("earned_points", 0)
                ),
                "essay_reviewed": ans.get("essay_reviewed", False),
                "teacher_comment": ans.get("teacher_comment", ""),
            })

        output.append({
            "id": str(r["_id"]),
            "student_id": r["student_id"],
            "student_name": student_name,
            "student_phone": student_phone,
            "score": r["score"],
            "passed": r["passed"],
            "earned_points": r.get("earned_points", 0),
            "total_points": r.get("total_points", 0),
            "submitted_at": r["submitted_at"],
            "essay_fully_reviewed": r.get("essay_fully_reviewed", False),
            "answers": answers_detail,
        })

    return output


# ====== Essay Review ======

@router.get("/review/{homework_id}")
async def get_homework_for_review(homework_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(homework_id)
    hw = await db.homeworks.get_one({"_id": oid})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")

    essay_questions = {
        str(q["_id"]): q for q in hw["questions"]
        if q["question_type"] == "essay"
    }
    if not essay_questions:
        return {"homework_id": homework_id, "title": hw["title"], "submissions": []}

    results = await db.homework_results.query({"homework_id": homework_id}).to_list(500)

    submissions = []
    for r in results:
        student = await db.users.get_one({"_id": r["student_id"]})
        student_name = f"{student['first_name']} {student['last_name']}" if student else "غير معروف"

        essay_answers = []
        for ans in r.get("answers", []):
            q = essay_questions.get(ans["question_id"])
            if not q:
                continue
            essay_answers.append({
                "question_id": ans["question_id"],
                "question_text": q["text"],
                "question_image": q.get("image_url"),
                "max_points": q["points"],
                "essay_answer": ans.get("essay_answer") or "",
                "essay_answer_image": ans.get("essay_answer_image_url"),
                "earned_points": ans.get("essay_earned_points"),
                "teacher_comment": ans.get("teacher_comment"),
                "reviewed": ans.get("essay_reviewed", False),
            })

        if essay_answers:
            submissions.append({
                "result_id": str(r["_id"]),
                "student_id": r["student_id"],
                "student_name": student_name,
                "score": r["score"],
                "passed": r["passed"],
                "submitted_at": r["submitted_at"],
                "essay_fully_reviewed": r.get("essay_fully_reviewed", False),
                "essay_answers": essay_answers,
            })

    return {"homework_id": homework_id, "title": hw["title"], "submissions": submissions}


class HEssayGrade(BaseModel):
    question_id: str
    earned_points: int
    teacher_comment: str = ""


class HReviewSubmit(BaseModel):
    result_id: str
    grades: List[HEssayGrade]


@router.post("/review")
async def submit_homework_essay_review(data: HReviewSubmit, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    result = await db.homework_results.get_one({"_id": data.result_id})
    if not result:
        raise HTTPException(status_code=404, detail="نتيجة الطالب مش موجودة")

    hw = await db.homeworks.get_one({"_id": validate_object_id(result["homework_id"])})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")

    questions_map = {str(q["_id"]): q for q in hw["questions"]}
    grades_map = {g.question_id: g for g in data.grades}

    updated_answers = []
    essay_earned = 0
    for ans in result["answers"]:
        q = questions_map.get(ans["question_id"])
        if q and q["question_type"] == "essay" and ans["question_id"] in grades_map:
            grade = grades_map[ans["question_id"]]
            pts = max(0, min(grade.earned_points, q["points"]))
            ans = {
                **ans,
                "essay_earned_points": pts,
                "teacher_comment": grade.teacher_comment,
                "essay_reviewed": True,
            }
            essay_earned += pts
        updated_answers.append(ans)

    old_essay_earned = sum(
        a.get("essay_earned_points", 0)
        for a in result["answers"]
        if questions_map.get(a["question_id"], {}).get("question_type") == "essay"
        and a.get("essay_reviewed")
    )
    mcq_earned = result["earned_points"] - old_essay_earned
    new_earned = mcq_earned + essay_earned
    total = result["total_points"]
    new_score = (new_earned / total * 100) if total > 0 else 0
    new_passed = new_score >= hw["pass_score"]

    # الواجب يعتبر "متصحح بالكامل" لما كل الأسئلة المقالية تتصحح — مش أول ما المدرس
    # يحفظ سؤال واحد بس (لو الواجب فيه أكتر من سؤال مقالي)
    essay_question_ids = {qid for qid, q in questions_map.items() if q["question_type"] == "essay"}
    reviewed_ids = {a["question_id"] for a in updated_answers if a.get("essay_reviewed")}
    fully_reviewed = essay_question_ids.issubset(reviewed_ids)

    await db.homework_results.set_fields(
        {"_id": data.result_id},
        {"$set": {
            "answers": updated_answers,
            "earned_points": new_earned,
            "score": new_score,
            "passed": new_passed,
            "essay_fully_reviewed": fully_reviewed,
            "reviewed_at": datetime.now(timezone.utc),
            "reviewed_by": str(current_user["_id"]),
        }}
    )

    if fully_reviewed:
        await db.notifications.add({
            "title": f"تم تصحيح واجب: {hw['title']}",
            "body": f"درجتك النهائية: {round(new_score)}% — {'ناجح ✓' if new_passed else 'لم تنجح'}. ادخل الواجب عشان تشوف التفاصيل.",
            "notification_type": "exam_reviewed",
            "target_user_id": result["student_id"],
            "target_grade": None,
            "read_by": [],
            "created_at": datetime.now(timezone.utc),
        })

    return {
        "message": "تم حفظ التصحيح",
        "new_score": round(new_score, 2),
        "new_passed": new_passed,
        "earned_points": new_earned,
        "essay_fully_reviewed": fully_reviewed,
    }


@router.get("/my-result/{homework_id}")
async def get_my_homework_result(homework_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    result = await db.homework_results.get_one({
        "homework_id": homework_id,
        "student_id": str(current_user["_id"])
    })
    if not result:
        raise HTTPException(status_code=404, detail="معملتش الواجب ده")

    questions_map = {}
    hw = await db.homeworks.get_one({"_id": validate_object_id(homework_id)})
    if hw:
        questions_map = {str(q["_id"]): q for q in hw["questions"]}

    # أوبشن "السماح للطلاب بمراجعة إجاباتهم" — الدرجة والنسبة بتظهر دايمًا،
    # وتفاصيل الإجابات بتظهر بس لو المدرس مفعّل الأوبشن.
    show_answers = bool(hw.get("show_result_immediately", True)) if hw else False
    has_essay = any(q.get("question_type") == "essay" for q in hw["questions"]) if hw else False

    essay_reviews = []
    if show_answers:
        for ans in result.get("answers", []):
            q = questions_map.get(ans["question_id"])
            if q and q["question_type"] == "essay" and ans.get("essay_reviewed"):
                essay_reviews.append({
                    "question_text": q["text"],
                    "essay_answer": ans.get("essay_answer", ""),
                    "essay_answer_image": ans.get("essay_answer_image_url"),
                    "earned_points": ans.get("essay_earned_points", 0),
                    "max_points": q["points"],
                    "teacher_comment": ans.get("teacher_comment", ""),
                })

    mcq_reviews = []
    if show_answers:
        for ans in result.get("answers", []):
            q = questions_map.get(ans["question_id"])
            if not q or q["question_type"] != "mcq":
                continue
            selected_raw = ans.get("selected_choice")
            choices = q.get("choices", [])
            selected_text = None
            if selected_raw is not None:
                try:
                    idx = int(selected_raw)
                    if 0 <= idx < len(choices):
                        selected_text = choices[idx]["text"]
                    else:
                        selected_text = selected_raw
                except (ValueError, TypeError):
                    match = next((c["text"] for c in choices if c["text"] == selected_raw), None)
                    selected_text = match or selected_raw
            correct_choice = next((c for c in choices if c.get("is_correct")), None)
            correct_text = correct_choice["text"] if correct_choice else None
            is_correct = ans.get("is_correct", False)
            mcq_reviews.append({
                "question_id": ans["question_id"],
                "question_text": q["text"],
                "points": q["points"],
                "selected_text": selected_text,
                "correct_text": correct_text,
                "is_correct": is_correct,
                "choices": [{"id": str(i), "text": c["text"], "is_correct": c.get("is_correct", False)} for i, c in enumerate(choices)],
            })

    return {
        "score": result["score"],
        "passed": result["passed"],
        "earned_points": result["earned_points"],
        "total_points": result["total_points"],
        "submitted_at": result["submitted_at"],
        "essay_fully_reviewed": result.get("essay_fully_reviewed", False),
        "show_answers": show_answers,
        "has_essay": has_essay,
        "essay_reviews": essay_reviews,
        "mcq_reviews": mcq_reviews,
        "answers": result.get("answers", []) if show_answers else [],
    }


# ====== تعديل وحذف الواجب ======

@router.delete("/{homework_id}")
async def delete_homework(homework_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    oid = validate_object_id(homework_id)
    hw = await db.homeworks.get_one({"_id": oid})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")
    await db.homeworks.remove_one({"_id": oid})
    await db.homework_results.remove_many({"homework_id": homework_id})
    await db.homework_attempts.remove_many({"homework_id": homework_id})
    return {"message": "تم حذف الواجب"}


class HomeworkUpdate(BaseModel):
    title: Optional[str] = None
    pass_score: Optional[int] = None
    show_result_immediately: Optional[bool] = None
    scheduled_at: Optional[str] = None
    deadline: Optional[str] = None


class HQuestionUpdate(BaseModel):
    text: str = ""
    question_type: str = "mcq"
    choices: List[dict] = []
    correct_answer: Optional[str] = None
    points: int = 1
    image_url: Optional[str] = None
    image_path: Optional[str] = None


class HomeworkFullUpdate(BaseModel):
    title: Optional[str] = None
    pass_score: Optional[int] = None
    show_result_immediately: Optional[bool] = None
    scheduled_at: Optional[str] = None
    deadline: Optional[str] = None
    questions: Optional[List[HQuestionUpdate]] = None


@router.patch("/{homework_id}")
async def update_homework(homework_id: str, data: HomeworkUpdate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(homework_id)
    hw = await db.homeworks.get_one({"_id": oid})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="مفيش بيانات للتحديث")
    if "deadline" in update_data:
        update_data["deadline"] = datetime.fromisoformat(update_data["deadline"].replace("Z", "+00:00"))
        # اتعدل الموعد — رجّع علم الإشعار عشان لو الموعد اتأجل مايتبعتش إشعار غلط
        update_data["deadline_notified"] = False
    if "scheduled_at" in update_data:
        if update_data["scheduled_at"]:
            update_data["scheduled_at"] = datetime.fromisoformat(update_data["scheduled_at"].replace("Z", "+00:00"))
        else:
            update_data["scheduled_at"] = None
    await db.homeworks.set_fields({"_id": oid}, {"$set": update_data})
    return {"message": "تم تحديث الواجب"}


@router.put("/{homework_id}")
async def full_update_homework(homework_id: str, data: HomeworkFullUpdate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(homework_id)
    hw = await db.homeworks.get_one({"_id": oid})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")

    update_data = {}
    if data.title is not None: update_data["title"] = data.title
    if data.pass_score is not None: update_data["pass_score"] = data.pass_score
    if data.show_result_immediately is not None: update_data["show_result_immediately"] = data.show_result_immediately

    if data.deadline is not None and data.deadline != "":
        update_data["deadline"] = datetime.fromisoformat(data.deadline.replace("Z", "+00:00"))
        update_data["deadline_notified"] = False

    if data.scheduled_at is not None:
        if data.scheduled_at == "":
            update_data["scheduled_at"] = None
        else:
            update_data["scheduled_at"] = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))

    questions_changed = False
    if data.questions is not None:
        questions_docs = []
        for q in data.questions:
            choices = [
                {"text": c.get("text", "").strip(), "is_correct": c.get("is_correct", False)}
                for c in q.choices
                if c.get("text") and c.get("text").strip()
            ]
            questions_docs.append({
                "_id": new_id(),
                "text": q.text,
                "question_type": q.question_type,
                "choices": choices,
                "correct_answer": q.correct_answer,
                "points": q.points,
                "image_url": q.image_url,
                "image_path": q.image_path,
            })
        update_data["questions"] = questions_docs
        questions_changed = True

    if not update_data:
        raise HTTPException(status_code=400, detail="مفيش بيانات للتحديث")

    await db.homeworks.set_fields({"_id": oid}, {"$set": update_data})

    deleted_results = 0
    if questions_changed:
        result = await db.homework_results.remove_many({"homework_id": homework_id})
        deleted_results = result.deleted_count
        # الأسئلة اتغيّرت — أي جلسات مفتوحة بقت على أسئلة قديمة، نلغّيها
        await db.homework_attempts.remove_many({"homework_id": homework_id})

    updated = await db.homeworks.get_one({"_id": oid})
    response = {
        "id": str(updated["_id"]),
        "title": updated["title"],
        "pass_score": updated["pass_score"],
        "show_result_immediately": updated.get("show_result_immediately", True),
        "deadline": updated.get("deadline"),
        "scheduled_at": updated.get("scheduled_at"),
        "questions": [{
            "id": str(q["_id"]),
            "text": q["text"],
            "question_type": q["question_type"],
            "choices": [{"text": c["text"], "is_correct": c["is_correct"]} for c in q.get("choices", [])],
            "points": q["points"],
            "image_url": q.get("image_url"),
            "image_path": q.get("image_path"),
        } for q in updated.get("questions", [])],
        "deleted_results": deleted_results,
        "message": f"تم التحديث{'، وتم مسح ' + str(deleted_results) + ' نتيجة للطلاب' if deleted_results > 0 else ''}",
    }
    return response


@router.get("/admin/{homework_id}")
async def get_homework_for_admin(homework_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(homework_id)
    hw = await db.homeworks.get_one({"_id": oid})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")
    return {
        "id": str(hw["_id"]),
        "title": hw["title"],
        "pass_score": hw.get("pass_score", 50),
        "show_result_immediately": hw.get("show_result_immediately", True),
        "scheduled_at": hw.get("scheduled_at"),
        "deadline": hw.get("deadline"),
        "is_expired": _is_expired(hw),
        "questions": [{
            "id": str(q["_id"]),
            "text": q["text"],
            "question_type": q["question_type"],
            "choices": [{"text": c["text"], "is_correct": c["is_correct"]} for c in q.get("choices", [])],
            "points": q["points"],
            "image_url": q.get("image_url"),
            "image_path": q.get("image_path"),
        } for q in hw.get("questions", [])],
    }


# ====== /{homework_id} الأخير دايمًا ======

@router.get("/{homework_id}")
async def get_homework(homework_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    oid = validate_object_id(homework_id)
    hw = await db.homeworks.get_one({"_id": oid})
    if not hw:
        raise HTTPException(status_code=404, detail="الواجب مش موجود")

    # الواجب اللي فات موعده — منعرضش الأسئلة خالص
    if _is_expired(hw):
        raise HTTPException(status_code=400, detail="انتهى موعد تسليم الواجب")

    if _not_started_yet(hw):
        raise HTTPException(status_code=403, detail="الواجب لسه معداش ساعته — استنى لحد وقت النزول")

    return {
        "id": str(hw["_id"]),
        "title": hw["title"],
        "scheduled_at": hw.get("scheduled_at"),
        "deadline": hw.get("deadline"),
        "is_expired": False,
        "questions": [question_helper(q) for q in hw.get("questions", [])],
    }
