from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from ...core.database import is_valid_id, new_id
from datetime import datetime, timezone, timedelta
from ...core.database import get_db
from ...core.dependencies import get_current_user, get_current_teacher, get_current_teacher_or_assistant
from ...core.notify import notify_course_audience
from ...schemas.exam import ExamCreate, ExamSubmit, SaveAnswerRequest, SubmitAttemptRequest
from ...models.exam import (
    exam_doc as build_exam_doc,
    question_doc as build_question_doc,
    attempt_doc as build_attempt_doc,
)

router = APIRouter(prefix="/exams", tags=["Exams"])


def validate_object_id(id_str: str) -> str:
    if not is_valid_id(id_str):
        raise HTTPException(status_code=422, detail="ID غير صالح")
    return id_str


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


def _is_closed(exam: dict) -> bool:
    available_until = exam.get("available_until")
    if not available_until:
        return False
    return datetime.now(timezone.utc) > _to_aware(available_until)


def _grade_answers(exam: dict, answers_list: list) -> dict:
    """يصحّح إجابات الطالب ويرجّع كل اللي محتاجينه لتخزين النتيجة.

    answers_list: قائمة dicts موحّدة، كل عنصر فيه:
      question_id, selected_choice, essay_answer, essay_answer_image_url, essay_answer_image_path
    الأسئلة المقالية بتتصحّح يدويًا من المدرس بعدين، هنا بس بنحسب اختيار-من-متعدد.
    """
    total_points = sum(q["points"] for q in exam["questions"])
    earned_points = 0
    answers_log = []
    questions_map = {str(q["_id"]): q for q in exam["questions"]}

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
    passed = score >= exam["pass_score"]
    return {
        "answers_log": answers_log,
        "earned_points": earned_points,
        "total_points": total_points,
        "score": score,
        "passed": passed,
    }


def _draft_to_answers_list(draft_answers: dict) -> list:
    """يحوّل مسودة الإجابات المخزّنة {question_id: {...}} لقائمة موحّدة للتصحيح."""
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


async def _store_exam_result(db, exam: dict, student_id: str, graded: dict, auto_submitted: bool = False) -> None:
    """يخزّن نتيجة الامتحان (لو لسه مش متخزّنة)."""
    result_doc = {
        "exam_id": str(exam["_id"]),
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
    await db.exam_results.add(result_doc)

    # ===== XP: كويز محاضرة (فيه lecture_id) أو امتحان Final (من غير lecture_id) =====
    try:
        from ...core.gamification import (
            award_or_topup_xp, maybe_award_unit_completion, quiz_xp, final_xp,
        )
        exam_id = str(exam["_id"])
        score = graded.get("score", 0)
        is_final = not exam.get("lecture_id")
        meta = {
            "course_id": exam.get("course_id"),
            "unit_id": exam.get("unit_id"),
            "lecture_id": exam.get("lecture_id"),
            "title": exam.get("title"),
            "score": score,
        }
        if is_final:
            await award_or_topup_xp(db, student_id, "final_exam", f"final:{exam_id}", final_xp(score), meta)
        else:
            await award_or_topup_xp(db, student_id, "quiz", f"quiz:{exam_id}", quiz_xp(score), meta)
            await maybe_award_unit_completion(db, student_id, exam.get("unit_id"), exam.get("course_id"))
    except Exception:
        pass


async def finalize_attempt(db, exam: dict, attempt: dict, auto_submitted: bool = False) -> dict:
    """يسلّم جلسة امتحان: يصحّح المسودة، يخزّن النتيجة، ويقفل الجلسة.

    آمن ضد التكرار: لو الجلسة اتسلّمت قبل كده أو فيه نتيجة موجودة، مايعملش نتيجة تانية.
    بيرجّع dict فيه score/passed/... للاستخدام في الرد.
    """
    student_id = attempt["student_id"]
    exam_id = str(exam["_id"])

    # آمن ضد السباق: نعيد قراءة الجلسة، لو اتقفلت خلاص مانعملش حاجة تانية
    fresh = await db.exam_attempts.get_one({"_id": attempt["_id"]})
    if fresh and fresh.get("status") == "submitted":
        existing = await db.exam_results.get_one({"exam_id": exam_id, "student_id": student_id})
        if existing:
            return {
                "score": existing["score"], "passed": existing["passed"],
                "earned_points": existing["earned_points"], "total_points": existing["total_points"],
            }

    # لو فيه نتيجة متخزّنة أصلاً (مثلاً الـ scheduler سبقنا)، نقفل الجلسة ونرجّعها
    existing = await db.exam_results.get_one({"exam_id": exam_id, "student_id": student_id})
    if existing:
        await db.exam_attempts.set_fields({"_id": attempt["_id"]}, {"$set": {"status": "submitted"}})
        return {
            "score": existing["score"], "passed": existing["passed"],
            "earned_points": existing["earned_points"], "total_points": existing["total_points"],
        }

    graded = _grade_answers(exam, _draft_to_answers_list(fresh.get("draft_answers") if fresh else attempt.get("draft_answers")))
    await _store_exam_result(db, exam, student_id, graded, auto_submitted=auto_submitted)
    await db.exam_attempts.set_fields(
        {"_id": attempt["_id"]},
        {"$set": {"status": "submitted", "auto_submitted": auto_submitted,
                  "finalized_at": datetime.now(timezone.utc)}},
    )
    return {
        "score": graded["score"], "passed": graded["passed"],
        "earned_points": graded["earned_points"], "total_points": graded["total_points"],
    }


@router.post("/", status_code=201)
async def create_exam(data: ExamCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    for i, q in enumerate(data.questions):
        if not (q.text and q.text.strip()) and not q.image_url:
            raise HTTPException(400, f"السؤال {i + 1}: لازم نص أو صورة على الأقل")
    if data.scheduled_at and data.available_until:
        start = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
        end = datetime.fromisoformat(data.available_until.replace("Z", "+00:00"))
        if end <= start:
            raise HTTPException(400, "وقت النهاية لازم يكون بعد وقت البداية")
    questions_docs = [build_question_doc(q) for q in data.questions]
    doc = build_exam_doc(data, questions_docs)
    result = await db.exams.add(doc)

    course = await db.courses.get_one({"_id": data.course_id})
    if course:
        await notify_course_audience(
            db,
            course,
            f"اختبار جديد: {data.title}",
            f"تم رفع اختبار جديد في كورس \"{course.get('title', '')}\" — استعد له كويس.",
            "new_exam",
        )

    return {"id": str(result.inserted_id), "message": "تم إنشاء الاختبار"}


# ====== routes الثابتة أولًا — قبل /{exam_id} ======

@router.post("/submit", response_model=dict)
async def submit_exam(data: ExamSubmit, current_user=Depends(get_current_user), db=Depends(get_db)):
    exam = await db.exams.get_one({"_id": validate_object_id(data.exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")

    if _is_closed(exam):
        raise HTTPException(status_code=400, detail="انتهى وقت الاختبار")

    existing = await db.exam_results.get_one({
        "exam_id": data.exam_id,
        "student_id": str(current_user["_id"])
    })
    if existing:
        raise HTTPException(status_code=400, detail="عملت الاختبار ده قبل كده")

    answers_list = [{
        "question_id": a.question_id,
        "selected_choice": a.selected_choice,
        "essay_answer": a.essay_answer,
        "essay_answer_image_url": a.essay_answer_image_url,
        "essay_answer_image_path": a.essay_answer_image_path,
    } for a in data.answers]
    graded = _grade_answers(exam, answers_list)
    await _store_exam_result(db, exam, str(current_user["_id"]), graded)
    score = graded["score"]
    passed = graded["passed"]
    earned_points = graded["earned_points"]
    total_points = graded["total_points"]

    # لو الطالب كان له جلسة مفتوحة، نقفلها
    open_attempt = await db.exam_attempts.get_one({
        "exam_id": data.exam_id, "student_id": str(current_user["_id"]), "status": "in_progress"
    })
    if open_attempt:
        await db.exam_attempts.set_fields({"_id": open_attempt["_id"]}, {"$set": {"status": "submitted"}})

    # الدرجة والنسبة بتظهر دايمًا للطالب بعد التسليم (بغضّ النظر عن أوبشن مراجعة الإجابات)
    return {
        "message": "تم تسليم الاختبار",
        "score": round(score, 2),
        "passed": passed,
        "earned_points": earned_points,
        "total_points": total_points,
    }


def _attempt_expired(attempt: dict) -> bool:
    exp = attempt.get("expires_at")
    if not exp:
        return False
    return datetime.now(timezone.utc) > _to_aware(exp)


def _remaining_seconds(attempt: dict) -> int:
    exp = attempt.get("expires_at")
    if not exp:
        return 0
    delta = _to_aware(exp) - datetime.now(timezone.utc)
    return max(0, int(delta.total_seconds()))


@router.post("/{exam_id}/start")
async def start_exam_attempt(exam_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    """يبدأ (أو يستأنف) جلسة امتحان.

    - الوقت بيتحسب على السيرفر: expires_at = started_at + مدة الاختبار.
    - بيرجّع session_token جديد كل مرة — أي جهاز/تبويب قديم بالـ token القديم هيترفض،
      فبيمنع الحل من مكانين في نفس الوقت.
    - لو الطالب رجع بعد ما وقته خلص، بيتسلّم تلقائيًا فورًا.
    """
    exam = await db.exams.get_one({"_id": validate_object_id(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")

    student_id = str(current_user["_id"])

    # سلّم قبل كده؟
    existing_result = await db.exam_results.get_one({"exam_id": exam_id, "student_id": student_id})
    if existing_result:
        raise HTTPException(status_code=400, detail="عملت الاختبار ده قبل كده")

    # الاختبار نفسه قفل (available_until عدّى)؟
    if _is_closed(exam):
        raise HTTPException(status_code=400, detail="انتهى وقت الاختبار")

    attempt = await db.exam_attempts.get_one({"exam_id": exam_id, "student_id": student_id})
    now = datetime.now(timezone.utc)

    if attempt and attempt.get("status") == "in_progress":
        # جلسة شغالة — لو وقتها خلص نسلّمها تلقائيًا
        if _attempt_expired(attempt):
            await finalize_attempt(db, exam, attempt, auto_submitted=True)
            raise HTTPException(status_code=400, detail="انتهى وقت الاختبار")
        # استئناف: نجدّد الـ session_token عشان نلغّي أي جهاز تاني
        new_token = new_id()
        await db.exam_attempts.set_fields(
            {"_id": attempt["_id"]}, {"$set": {"session_token": new_token}}
        )
        return {
            "session_token": new_token,
            "remaining_seconds": _remaining_seconds(attempt),
            "duration_minutes": exam["duration_minutes"],
            "draft_answers": attempt.get("draft_answers", {}),
            "resumed": True,
        }

    # جلسة جديدة
    session_token = new_id()
    started_at = now
    expires_at = now + timedelta(minutes=exam["duration_minutes"])
    doc = build_attempt_doc(exam_id, student_id, session_token, started_at, expires_at)
    if attempt:
        # جلسة قديمة متسلّمة موجودة — نستبدلها (نادر، لكن للأمان)
        await db.exam_attempts.set_fields({"_id": attempt["_id"]}, {"$set": doc})
    else:
        await db.exam_attempts.add(doc)

    return {
        "session_token": session_token,
        "remaining_seconds": int((expires_at - now).total_seconds()),
        "duration_minutes": exam["duration_minutes"],
        "draft_answers": {},
        "resumed": False,
    }


@router.post("/{exam_id}/save-answer")
async def save_exam_answer(exam_id: str, data: SaveAnswerRequest,
                           current_user=Depends(get_current_user), db=Depends(get_db)):
    """يحفظ إجابة سؤال واحد فورًا في مسودة الجلسة (auto-save)."""
    student_id = str(current_user["_id"])
    attempt = await db.exam_attempts.get_one({"exam_id": exam_id, "student_id": student_id})
    if not attempt or attempt.get("status") != "in_progress":
        raise HTTPException(status_code=400, detail="مفيش جلسة امتحان مفتوحة")

    # الحل مفتوح في مكان تاني؟ (توكن مختلف)
    if attempt.get("session_token") != data.session_token:
        raise HTTPException(status_code=409, detail="الامتحان مفتوح في مكان تاني")

    # الوقت خلص؟ نسلّم تلقائيًا ونرفض الحفظ
    if _attempt_expired(attempt):
        exam = await db.exams.get_one({"_id": validate_object_id(exam_id)})
        if exam:
            await finalize_attempt(db, exam, attempt, auto_submitted=True)
        raise HTTPException(status_code=409, detail="انتهى وقت الاختبار")

    # نحدّث إجابة السؤال ده في المسودة (بنكتب المسودة كاملة — مفاتيح فيها / مش مدعومة في التخزين)
    entry = {
        "selected_choice": data.selected_choice,
        "essay_answer": data.essay_answer,
        "essay_answer_image_url": data.essay_answer_image_url,
        "essay_answer_image_path": data.essay_answer_image_path,
    }
    draft = dict(attempt.get("draft_answers") or {})
    draft[data.question_id] = entry
    await db.exam_attempts.set_fields(
        {"_id": attempt["_id"]},
        {"$set": {
            "draft_answers": draft,
            "last_saved_at": datetime.now(timezone.utc),
        }},
    )
    return {"saved": True, "remaining_seconds": _remaining_seconds(attempt)}


@router.post("/{exam_id}/submit-attempt")
async def submit_exam_attempt(exam_id: str, data: SubmitAttemptRequest,
                              current_user=Depends(get_current_user), db=Depends(get_db)):
    """التسليم النهائي من الطالب (زر إنهاء)."""
    exam = await db.exams.get_one({"_id": validate_object_id(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")

    student_id = str(current_user["_id"])

    # سلّم قبل كده؟
    existing_result = await db.exam_results.get_one({"exam_id": exam_id, "student_id": student_id})
    if existing_result:
        return _immediate_or_hidden(exam, {
            "score": existing_result["score"], "passed": existing_result["passed"],
            "earned_points": existing_result["earned_points"], "total_points": existing_result["total_points"],
        })

    attempt = await db.exam_attempts.get_one({"exam_id": exam_id, "student_id": student_id})
    if not attempt or attempt.get("status") != "in_progress":
        raise HTTPException(status_code=400, detail="مفيش جلسة امتحان مفتوحة")

    # التوكن لازم يطابق (نفس الجهاز اللي بيحل)
    if attempt.get("session_token") != data.session_token:
        raise HTTPException(status_code=409, detail="الامتحان مفتوح في مكان تاني")

    result = await finalize_attempt(db, exam, attempt, auto_submitted=False)
    return _immediate_or_hidden(exam, result)


@router.get("/{exam_id}/my-attempt")
async def get_my_attempt_status(exam_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    """حالة جلسة الطالب الحالية: submitted (سلّم) / active (بيحل) / none (لسه ما بدأش).

    بيتنادى وقت فتح الصفحة عشان نعرف نكمّل من مكان الطالب بعد أي ريفريش.
    مابيرجّعش الـ session_token — الاستئناف بيتم عبر /start اللي بيجدّد التوكن.
    """
    student_id = str(current_user["_id"])
    existing_result = await db.exam_results.get_one({"exam_id": exam_id, "student_id": student_id})
    if existing_result:
        return {"status": "submitted"}
    attempt = await db.exam_attempts.get_one({"exam_id": exam_id, "student_id": student_id})
    if not attempt or attempt.get("status") != "in_progress":
        return {"status": "none"}
    if _attempt_expired(attempt):
        exam = await db.exams.get_one({"_id": validate_object_id(exam_id)})
        if exam:
            await finalize_attempt(db, exam, attempt, auto_submitted=True)
        return {"status": "submitted"}
    return {"status": "active", "remaining_seconds": _remaining_seconds(attempt)}


def _immediate_or_hidden(exam: dict, result: dict) -> dict:
    """الدرجة والنسبة بترجع دايمًا للطالب بعد التسليم.

    (أوبشن show_result_immediately بقى بيتحكم في *مراجعة الإجابات* بس، مش في
    ظهور الدرجة — شوف get_my_result.)
    """
    return {
        "message": "تم تسليم الاختبار",
        "score": round(result["score"], 2),
        "passed": result["passed"],
        "earned_points": result["earned_points"],
        "total_points": result["total_points"],
    }


@router.get("/course/{course_id}")
async def get_course_exams(course_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    exams = await db.exams.query({"course_id": course_id}).to_list(100)
    return [{
        "id": str(e["_id"]),
        "title": e["title"],
        "duration_minutes": e["duration_minutes"],
        "lecture_id": e.get("lecture_id"),
        "pass_score": e.get("pass_score", 50),
        "scheduled_at": e.get("scheduled_at"),
        "available_until": e.get("available_until"),
        "is_closed": _is_closed(e),
        "show_result_immediately": e.get("show_result_immediately", True),
    } for e in exams]


@router.get("/results/{exam_id}")
async def get_exam_results(exam_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    results = await db.exam_results.query({"exam_id": exam_id}).to_list(500)

    # جيب الاختبار عشان نعرف الأسئلة والإجابات الصح
    exam = await db.exams.get_one({"_id": validate_object_id(exam_id)}) if is_valid_id(exam_id) else None
    questions_map = {}
    if exam:
        for q in exam.get("questions", []):
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

@router.get("/review/{exam_id}")
async def get_exam_for_review(exam_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(exam_id)
    exam = await db.exams.get_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")

    essay_questions = {
        str(q["_id"]): q for q in exam["questions"]
        if q["question_type"] == "essay"
    }
    if not essay_questions:
        return {"exam_id": exam_id, "title": exam["title"], "submissions": []}

    results = await db.exam_results.query({"exam_id": exam_id}).to_list(500)

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

    return {"exam_id": exam_id, "title": exam["title"], "submissions": submissions}


class EssayGrade(BaseModel):
    question_id: str
    earned_points: int
    teacher_comment: str = ""


class ReviewSubmit(BaseModel):
    result_id: str
    grades: List[EssayGrade]


@router.post("/review")
async def submit_essay_review(data: ReviewSubmit, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    result = await db.exam_results.get_one({"_id": data.result_id})
    if not result:
        raise HTTPException(status_code=404, detail="نتيجة الطالب مش موجودة")

    exam = await db.exams.get_one({"_id": validate_object_id(result["exam_id"])})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")

    questions_map = {str(q["_id"]): q for q in exam["questions"]}
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
    new_passed = new_score >= exam["pass_score"]

    # الاختبار يعتبر "متصحح بالكامل" لما كل الأسئلة المقالية تتصحح — مش أول ما المدرس
    # يحفظ سؤال واحد بس (لو الاختبار فيه أكتر من سؤال مقالي)
    essay_question_ids = {qid for qid, q in questions_map.items() if q["question_type"] == "essay"}
    reviewed_ids = {a["question_id"] for a in updated_answers if a.get("essay_reviewed")}
    fully_reviewed = essay_question_ids.issubset(reviewed_ids)

    await db.exam_results.set_fields(
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

    # ===== XP: زوّد الفرق لو الدرجة زادت بعد تصحيح المقالي (ماينقصش أبدًا) =====
    try:
        from ...core.gamification import award_or_topup_xp, quiz_xp, final_xp
        exam_id = str(exam["_id"])
        student_id = result["student_id"]
        is_final = not exam.get("lecture_id")
        meta = {
            "course_id": exam.get("course_id"),
            "unit_id": exam.get("unit_id"),
            "lecture_id": exam.get("lecture_id"),
            "title": exam.get("title"),
            "score": new_score,
        }
        if is_final:
            await award_or_topup_xp(db, student_id, "final_exam", f"final:{exam_id}", final_xp(new_score), meta)
        else:
            await award_or_topup_xp(db, student_id, "quiz", f"quiz:{exam_id}", quiz_xp(new_score), meta)
    except Exception:
        pass

    if fully_reviewed:
        await db.notifications.add({
            "title": f"تم تصحيح اختبار: {exam['title']}",
            "body": f"درجتك النهائية: {round(new_score)}% — {'ناجح ✓' if new_passed else 'لم تنجح'}. ادخل الاختبار عشان تشوف التفاصيل.",
            "notification_type": "exam_reviewed",
            "target_user_id": result["student_id"],
            "target_grade": None,
            "read_by": [],
            "created_at": datetime.now(timezone.utc),
        })

    return {
        "message": "تم حفظ التصحيح",
        "essay_fully_reviewed": fully_reviewed,
        "new_score": round(new_score, 2),
        "new_passed": new_passed,
        "earned_points": new_earned,
    }


@router.get("/my-result/{exam_id}")
async def get_my_result(exam_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    result = await db.exam_results.get_one({
        "exam_id": exam_id,
        "student_id": str(current_user["_id"])
    })
    if not result:
        raise HTTPException(status_code=404, detail="معملتش الاختبار ده")

    questions_map = {}
    exam = await db.exams.get_one({"_id": validate_object_id(exam_id)})
    if exam:
        questions_map = {str(q["_id"]): q for q in exam["questions"]}

    # أوبشن "السماح للطلاب بمراجعة إجاباتهم" — الدرجة والنسبة بتظهر دايمًا،
    # لكن تفاصيل الإجابات (إجابة الطالب + الإجابة الصح) بتظهر بس لو المدرس مفعّل الأوبشن.
    show_answers = bool(exam.get("show_result_immediately", True)) if exam else False
    has_essay = any(q.get("question_type") == "essay" for q in exam["questions"]) if exam else False

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
                "choices": [{"id": str(i), "text": c["text"], "is_correct": c.get("is_correct", False)} for i, c in enumerate(choices)],        })

    return {
        "score": result["score"],
        "passed": result["passed"],
        "earned_points": result["earned_points"],
        "total_points": result["total_points"],
        "submitted_at": result["submitted_at"],
        "essay_fully_reviewed": result.get("essay_fully_reviewed", False),
        # فلاج بيقول للواجهة تعرض زرار "مراجعة الإجابات" ولا لأ
        "show_answers": show_answers,
        # فيه سؤال مقالي أصلاً؟ (عشان رسالة "في انتظار التصحيح" ما تظهرش من غير داعي)
        "has_essay": has_essay,
        "essay_reviews": essay_reviews,
        "mcq_reviews": mcq_reviews,
        # الإجابات الخام كمان متحجوبة لو المراجعة مقفولة (منع تسريب)
        "answers": result.get("answers", []) if show_answers else [],
    }


# ====== تعديل وحذف الاختبار ======

@router.delete("/{exam_id}")
async def delete_exam(exam_id: str, current_user=Depends(get_current_teacher), db=Depends(get_db)):
    oid = validate_object_id(exam_id)
    exam = await db.exams.get_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")
    await db.exams.remove_one({"_id": oid})
    await db.exam_results.remove_many({"exam_id": exam_id})
    await db.exam_attempts.remove_many({"exam_id": exam_id})
    return {"message": "تم حذف الاختبار"}


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    duration_minutes: Optional[int] = None
    pass_score: Optional[int] = None
    show_result_immediately: Optional[bool] = None
    scheduled_at: Optional[str] = None
    available_until: Optional[str] = None


class QuestionUpdate(BaseModel):
    text: str = ""
    question_type: str = "mcq"
    choices: List[dict] = []
    correct_answer: Optional[str] = None
    points: int = 1
    image_url: Optional[str] = None
    image_path: Optional[str] = None


class ExamFullUpdate(BaseModel):
    title: Optional[str] = None
    duration_minutes: Optional[int] = None
    pass_score: Optional[int] = None
    show_result_immediately: Optional[bool] = None
    scheduled_at: Optional[str] = None
    available_until: Optional[str] = None
    questions: Optional[List[QuestionUpdate]] = None


@router.patch("/{exam_id}")
async def update_exam(exam_id: str, data: ExamUpdate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(exam_id)
    exam = await db.exams.get_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="مفيش بيانات للتحديث")
    if "scheduled_at" in update_data:
        if update_data["scheduled_at"]:
            update_data["scheduled_at"] = datetime.fromisoformat(update_data["scheduled_at"].replace("Z", "+00:00"))
        else:
            update_data["scheduled_at"] = None
    if "available_until" in update_data:
        if update_data["available_until"]:
            update_data["available_until"] = datetime.fromisoformat(update_data["available_until"].replace("Z", "+00:00"))
        else:
            update_data["available_until"] = None
        # اتعدل موعد الإغلاق — رجّع علم الإشعار عشان لو الموعد اتأجل مايتبعتش إشعار غلط
        update_data["deadline_notified"] = False
    await db.exams.set_fields({"_id": oid}, {"$set": update_data})
    return {"message": "تم تحديث الاختبار"}


@router.put("/{exam_id}")
async def full_update_exam(exam_id: str, data: ExamFullUpdate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(exam_id)
    exam = await db.exams.get_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")

    update_data = {}
    if data.title is not None: update_data["title"] = data.title
    if data.duration_minutes is not None: update_data["duration_minutes"] = data.duration_minutes
    if data.pass_score is not None: update_data["pass_score"] = data.pass_score
    if data.show_result_immediately is not None: update_data["show_result_immediately"] = data.show_result_immediately

    if data.scheduled_at is not None:
        if data.scheduled_at == "":
            update_data["scheduled_at"] = None
        else:
            update_data["scheduled_at"] = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))

    if data.available_until is not None:
        if data.available_until == "":
            update_data["available_until"] = None
        else:
            update_data["available_until"] = datetime.fromisoformat(data.available_until.replace("Z", "+00:00"))
        update_data["deadline_notified"] = False

    questions_changed = False
    if data.questions is not None:
        questions_docs = []
        for q in data.questions:
            # نفس القاعدة عند الإنشاء: الاختيار الفاضي أو المسافات بس ميتخزنش
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

    await db.exams.set_fields({"_id": oid}, {"$set": update_data})

    deleted_results = 0
    if questions_changed:
        result = await db.exam_results.remove_many({"exam_id": exam_id})
        deleted_results = result.deleted_count
        # الأسئلة اتغيّرت — أي جلسات مفتوحة بقت على أسئلة قديمة، نلغّيها
        await db.exam_attempts.remove_many({"exam_id": exam_id})

    updated = await db.exams.get_one({"_id": oid})
    response = {
        "id": str(updated["_id"]),
        "title": updated["title"],
        "duration_minutes": updated["duration_minutes"],
        "pass_score": updated["pass_score"],
        "show_result_immediately": updated.get("show_result_immediately", True),
        "scheduled_at": updated.get("scheduled_at"),
        "available_until": updated.get("available_until"),
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


@router.get("/admin/{exam_id}")
async def get_exam_for_admin(exam_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    oid = validate_object_id(exam_id)
    exam = await db.exams.get_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")
    return {
        "id": str(exam["_id"]),
        "title": exam["title"],
        "duration_minutes": exam["duration_minutes"],
        "pass_score": exam.get("pass_score", 50),
        "show_result_immediately": exam.get("show_result_immediately", True),
        "scheduled_at": exam.get("scheduled_at"),
        "available_until": exam.get("available_until"),
        "questions": [{
            "id": str(q["_id"]),
            "text": q["text"],
            "question_type": q["question_type"],
            "choices": [{"text": c["text"], "is_correct": c["is_correct"]} for c in q.get("choices", [])],
            "points": q["points"],
            "image_url": q.get("image_url"),
            "image_path": q.get("image_path"),
        } for q in exam.get("questions", [])],
    }


# ====== /{exam_id} الأخير دايمًا ======

@router.get("/{exam_id}")
async def get_exam(exam_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    oid = validate_object_id(exam_id)
    exam = await db.exams.get_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="الاختبار مش موجود")

    scheduled_at = exam.get("scheduled_at")
    if scheduled_at:
        now = datetime.now(timezone.utc)
        scheduled = scheduled_at if scheduled_at.tzinfo else scheduled_at.replace(tzinfo=timezone.utc)
        if now < scheduled:
            raise HTTPException(
                status_code=403,
                detail="الاختبار لسه معدتش ساعته — استنى لحد وقت النزول"
            )

    if _is_closed(exam):
        raise HTTPException(status_code=403, detail="انتهى وقت الاختبار")

    return {
        "id": str(exam["_id"]),
        "title": exam["title"],
        "duration_minutes": exam["duration_minutes"],
        "scheduled_at": exam.get("scheduled_at"),
        "available_until": exam.get("available_until"),
        "questions": [question_helper(q) for q in exam.get("questions", [])],
    }