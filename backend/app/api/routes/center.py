"""نظام السنتر: مراحل ← مجموعات ← طلاب، حضور بالـ QR، ومدفوعات شهرية.

كل الـ endpoints بتقبل المعلم والمساعد بنفس الصلاحية (get_current_teacher_or_assistant).
منفصل تمامًا عن طلاب المنصة الأونلاين.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta

from ...core.database import get_db, is_valid_id
from ...core.dependencies import get_current_teacher_or_assistant
from ...schemas.center import (
    StageCreate, StageUpdate, GroupCreate, GroupUpdate,
    StudentCreate, StudentUpdate, PaymentCreate,
    ScanRequest, ScanBatchRequest, ManualAttendanceRequest,
)
from ...models.center import (
    stage_doc, group_doc, student_doc, attendance_doc, payment_doc,
    generate_qr_token,
)

router = APIRouter(prefix="/center", tags=["Center"])


# ====== توقيت القاهرة (للتاريخ والشهر) ======
try:
    from zoneinfo import ZoneInfo
    CAIRO_TZ = ZoneInfo("Africa/Cairo")
except Exception:
    CAIRO_TZ = timezone(timedelta(hours=2))  # احتياطي لو الـ tzdata مش متوفرة


def _cairo_now() -> datetime:
    return datetime.now(CAIRO_TZ)


def _today_str() -> str:
    return _cairo_now().strftime("%Y-%m-%d")


def _current_month() -> str:
    return _cairo_now().strftime("%Y-%m")


def _date_from_client(client_time: Optional[str]) -> str:
    """يستخرج تاريخ اليوم (بتوقيت القاهرة) من وقت جهاز اللي سجّل — للأوفلاين."""
    if not client_time:
        return _today_str()
    try:
        dt = datetime.fromisoformat(client_time.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(CAIRO_TZ).strftime("%Y-%m-%d")
    except Exception:
        return _today_str()


def _oid(value: str, what: str = "المعرّف"):
    if not is_valid_id(value):
        raise HTTPException(status_code=400, detail=f"{what} غير صالح")
    return value


# ====== helpers ======

async def _is_paid(db, student_id: str, month: str) -> bool:
    rec = await db.center_payments.get_one({"student_id": student_id, "month": month})
    return rec is not None


async def _sessions_count(db, student_id: str, month: str) -> int:
    """عدد الحصص (أيام الحضور) للطالب في شهر معيّن.

    الحصة = يوم حضور واحد (تسجيل واحد لكل طالب في اليوم). العدّ بيتفلتر على
    الشهر، فبالتالي مع بداية كل شهر جديد بيرجع صفر تلقائيًا من غير أي مسح،
    والداتا القديمة بتفضل محفوظة للتقارير.
    """
    records = await db.center_attendance.query({"student_id": student_id}).to_list(20000)
    return sum(1 for r in records if str(r.get("date", "")).startswith(month))


async def _student_out(db, student: dict, month: Optional[str] = None,
                       sessions: Optional[int] = None) -> dict:
    month = month or _current_month()
    paid = await _is_paid(db, str(student["_id"]), month)
    if sessions is None:
        sessions = await _sessions_count(db, str(student["_id"]), month)
    return {
        "id": str(student["_id"]),
        "name": student["name"],
        "student_number": student["student_number"],
        "parent_phone": student["parent_phone"],
        "monthly_fee": student["monthly_fee"],
        "qr_token": student["qr_token"],
        "group_id": student["group_id"],
        "stage_id": student.get("stage_id"),
        "paid_current_month": paid,
        "sessions_this_month": sessions,
        "current_month": month,
    }


# ============================================================
#   المراحل
# ============================================================

@router.post("/stages", status_code=201)
async def create_stage(data: StageCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    doc = stage_doc(data.name.strip(), str(current_user["_id"]))
    res = await db.center_stages.add(doc)
    return {"id": str(res.inserted_id), **doc}


@router.get("/stages")
async def list_stages(current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    stages = await db.center_stages.query({}).to_list(500)
    out = []
    for s in stages:
        groups_count = await db.center_groups.count({"stage_id": str(s["_id"])})
        out.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "groups_count": groups_count,
        })
    out.sort(key=lambda x: x["name"])
    return out


@router.put("/stages/{stage_id}")
async def update_stage(stage_id: str, data: StageUpdate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(stage_id, "المرحلة")
    stage = await db.center_stages.get_one({"_id": stage_id})
    if not stage:
        raise HTTPException(status_code=404, detail="المرحلة مش موجودة")
    await db.center_stages.set_fields({"_id": stage_id}, {"$set": {"name": data.name.strip()}})
    return {"message": "تم التعديل"}


@router.delete("/stages/{stage_id}")
async def delete_stage(stage_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(stage_id, "المرحلة")
    groups_count = await db.center_groups.count({"stage_id": stage_id})
    if groups_count > 0:
        raise HTTPException(status_code=400, detail="امسح أو انقل المجموعات اللي في المرحلة الأول")
    await db.center_stages.remove_one({"_id": stage_id})
    return {"message": "تم حذف المرحلة"}


# ============================================================
#   المجموعات
# ============================================================

@router.post("/groups", status_code=201)
async def create_group(data: GroupCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(data.stage_id, "المرحلة")
    stage = await db.center_stages.get_one({"_id": data.stage_id})
    if not stage:
        raise HTTPException(status_code=404, detail="المرحلة مش موجودة")
    doc = group_doc(data.stage_id, data.name.strip(), str(current_user["_id"]))
    res = await db.center_groups.add(doc)
    return {"id": str(res.inserted_id), **doc}


@router.get("/stages/{stage_id}/groups")
async def list_groups(stage_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(stage_id, "المرحلة")
    groups = await db.center_groups.query({"stage_id": stage_id}).to_list(500)
    out = []
    for g in groups:
        students_count = await db.center_students.count({"group_id": str(g["_id"])})
        out.append({
            "id": str(g["_id"]),
            "name": g["name"],
            "stage_id": g["stage_id"],
            "students_count": students_count,
        })
    out.sort(key=lambda x: x["name"])
    return out


@router.put("/groups/{group_id}")
async def update_group(group_id: str, data: GroupUpdate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(group_id, "المجموعة")
    group = await db.center_groups.get_one({"_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="المجموعة مش موجودة")
    fields = {}
    if data.name is not None:
        fields["name"] = data.name.strip()
    if data.stage_id is not None:
        _oid(data.stage_id, "المرحلة")
        if not await db.center_stages.get_one({"_id": data.stage_id}):
            raise HTTPException(status_code=404, detail="المرحلة مش موجودة")
        fields["stage_id"] = data.stage_id
    if fields:
        await db.center_groups.set_fields({"_id": group_id}, {"$set": fields})
    return {"message": "تم التعديل"}


@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(group_id, "المجموعة")
    students_count = await db.center_students.count({"group_id": group_id})
    if students_count > 0:
        raise HTTPException(status_code=400, detail="انقل أو امسح الطلاب اللي في المجموعة الأول")
    await db.center_groups.remove_one({"_id": group_id})
    return {"message": "تم حذف المجموعة"}


# ============================================================
#   الطلاب
# ============================================================

@router.post("/students", status_code=201)
async def create_student(data: StudentCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(data.group_id, "المجموعة")
    group = await db.center_groups.get_one({"_id": data.group_id})
    if not group:
        raise HTTPException(status_code=404, detail="المجموعة مش موجودة")

    qr_token = generate_qr_token()
    doc = student_doc(
        group_id=data.group_id,
        stage_id=group["stage_id"],
        name=data.name.strip(),
        student_number=data.student_number.strip(),
        parent_phone=data.parent_phone.strip(),
        monthly_fee=data.monthly_fee,
        qr_token=qr_token,
        created_by=str(current_user["_id"]),
    )
    res = await db.center_students.add(doc)
    student = {"_id": res.inserted_id, **doc}
    return await _student_out(db, student)


@router.get("/students-all")
async def all_students_for_offline(current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    """كل الطلاب مرة واحدة — عشان الموبايل يخزّنهم محليًا ويشتغل أوفلاين."""
    students = await db.center_students.query({}).to_list(20000)
    month = _current_month()

    # حضور الشهر كله مرة واحدة ونعدّ حصص كل طالب
    attendance = await db.center_attendance.query({}).to_list(200000)
    counts: dict = {}
    for a in attendance:
        if str(a.get("date", "")).startswith(month):
            sid = a["student_id"]
            counts[sid] = counts.get(sid, 0) + 1

    out = []
    for s in students:
        paid = await _is_paid(db, str(s["_id"]), month)
        out.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "student_number": s["student_number"],
            "parent_phone": s["parent_phone"],
            "qr_token": s["qr_token"],
            "group_id": s["group_id"],
            "stage_id": s.get("stage_id"),
            "paid_current_month": paid,
            "sessions_this_month": counts.get(str(s["_id"]), 0),
        })
    return {"month": month, "count": len(out), "students": out}


@router.get("/groups/{group_id}/students")
async def list_students(group_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(group_id, "المجموعة")
    students = await db.center_students.query({"group_id": group_id}).to_list(2000)
    month = _current_month()

    # نجيب حضور المجموعة كله مرة واحدة ونعدّ حصص كل طالب في الشهر الحالي
    # بدل ما نعمل استعلام لكل طالب لوحده.
    attendance = await db.center_attendance.query({"group_id": group_id}).to_list(50000)
    counts: dict = {}
    for a in attendance:
        if str(a.get("date", "")).startswith(month):
            sid = a["student_id"]
            counts[sid] = counts.get(sid, 0) + 1

    out = [await _student_out(db, s, month, counts.get(str(s["_id"]), 0)) for s in students]
    out.sort(key=lambda x: x["name"])
    return out


@router.get("/students/{student_id}")
async def get_student(student_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(student_id, "الطالب")
    student = await db.center_students.get_one({"_id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    data = await _student_out(db, student)

    # آخر الحضور وآخر المدفوعات
    attendance = await db.center_attendance.query({"student_id": student_id}).to_list(500)
    attendance.sort(key=lambda a: a.get("date", ""), reverse=True)
    payments = await db.center_payments.query({"student_id": student_id}).to_list(500)
    payments.sort(key=lambda p: p.get("month", ""), reverse=True)

    data["attendance"] = [
        {"date": a["date"], "was_paid": a.get("was_paid", False)} for a in attendance
    ]
    data["payments"] = [
        {"id": str(p["_id"]), "month": p["month"], "amount": p["amount"], "note": p.get("note")}
        for p in payments
    ]
    return data


@router.put("/students/{student_id}")
async def update_student(student_id: str, data: StudentUpdate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(student_id, "الطالب")
    student = await db.center_students.get_one({"_id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")

    fields = {}
    if data.name is not None:
        fields["name"] = data.name.strip()
    if data.student_number is not None:
        fields["student_number"] = data.student_number.strip()
    if data.parent_phone is not None:
        fields["parent_phone"] = data.parent_phone.strip()
    if data.monthly_fee is not None:
        fields["monthly_fee"] = data.monthly_fee
    if data.group_id is not None:
        _oid(data.group_id, "المجموعة")
        group = await db.center_groups.get_one({"_id": data.group_id})
        if not group:
            raise HTTPException(status_code=404, detail="المجموعة مش موجودة")
        fields["group_id"] = data.group_id
        fields["stage_id"] = group["stage_id"]

    if fields:
        await db.center_students.set_fields({"_id": student_id}, {"$set": fields})
    updated = await db.center_students.get_one({"_id": student_id})
    return await _student_out(db, updated)


@router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(student_id, "الطالب")
    student = await db.center_students.get_one({"_id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    # نمسح بيانات الطالب وحضوره ومدفوعاته
    await db.center_students.remove_one({"_id": student_id})
    await db.center_attendance.remove_many({"student_id": student_id})
    await db.center_payments.remove_many({"student_id": student_id})
    return {"message": "تم حذف الطالب"}


@router.post("/students/{student_id}/regenerate-qr")
async def regenerate_qr(student_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    """يولّد QR جديد للطالب (لو الكارت القديم ضاع)."""
    _oid(student_id, "الطالب")
    student = await db.center_students.get_one({"_id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")
    new_token = generate_qr_token()
    await db.center_students.set_fields({"_id": student_id}, {"$set": {"qr_token": new_token}})
    return {"qr_token": new_token}


# ============================================================
#   المدفوعات
# ============================================================

@router.post("/students/{student_id}/payments", status_code=201)
async def record_payment(student_id: str, data: PaymentCreate, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    _oid(student_id, "الطالب")
    student = await db.center_students.get_one({"_id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")

    month = data.month or _current_month()
    amount = data.amount if data.amount is not None else student["monthly_fee"]

    existing = await db.center_payments.get_one({"student_id": student_id, "month": month})
    if existing:
        raise HTTPException(status_code=400, detail=f"الطالب دافع شهر {month} خلاص")

    doc = payment_doc(student_id, month, amount, str(current_user["_id"]), data.note)
    res = await db.center_payments.add(doc)
    return {"id": str(res.inserted_id), "month": month, "amount": amount}


@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    """تراجع عن دفعة (لو اتسجّلت بالغلط)."""
    _oid(payment_id, "الدفعة")
    payment = await db.center_payments.get_one({"_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="الدفعة مش موجودة")
    await db.center_payments.remove_one({"_id": payment_id})
    return {"message": "تم التراجع عن الدفعة"}


# ============================================================
#   الاسكان (تسجيل الحضور)
# ============================================================

async def _do_scan(db, qr_token: str, recorded_by: str, date_str: str) -> dict:
    """يسجّل حضور طالب من توكن الـ QR. سجل واحد لكل طالب في اليوم."""
    student = await db.center_students.get_one({"qr_token": qr_token})
    if not student:
        return {"status": "not_found", "message": "الكود مش متعرّف عليه"}

    student_id = str(student["_id"])
    month = _current_month()
    paid = await _is_paid(db, student_id, month)
    student_info = {
        "id": student_id,
        "name": student["name"],
        "student_number": student["student_number"],
        "parent_phone": student["parent_phone"],
        "group_id": student["group_id"],
        "paid_current_month": paid,
    }

    existing = await db.center_attendance.get_one({"student_id": student_id, "date": date_str})
    if existing:
        sessions = await _sessions_count(db, student_id, month)
        return {"status": "already", "student": {**student_info, "sessions_this_month": sessions},
                "date": date_str, "message": "الطالب مسجّل حضور النهاردة خلاص"}

    doc = attendance_doc(student_id, student["group_id"], student.get("stage_id"),
                         date_str, recorded_by, paid)
    await db.center_attendance.add(doc)
    # نعدّ الحصص بعد التسجيل عشان الرقم يشمل الحصة اللي لسه اتسجّلت
    sessions = await _sessions_count(db, student_id, month)
    return {"status": "recorded", "student": {**student_info, "sessions_this_month": sessions},
            "date": date_str, "message": "تم تسجيل الحضور"}


@router.post("/scan")
async def scan(data: ScanRequest, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    """اسكان مباشر (فيه نت). بيرجّع بيانات الطالب وحالة الدفع."""
    date_str = _date_from_client(data.client_time)
    return await _do_scan(db, data.qr_token, str(current_user["_id"]), date_str)


@router.post("/scan/batch")
async def scan_batch(data: ScanBatchRequest, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    """رفع دفعة اسكانات اتعملت أوفلاين (تزامن لما النت يرجع)."""
    recorded_by = str(current_user["_id"])
    results = []
    for item in data.scans:
        date_str = _date_from_client(item.client_time)
        r = await _do_scan(db, item.qr_token, recorded_by, date_str)
        results.append({"qr_token": item.qr_token, **r})
    return {"processed": len(results), "results": results}


# ============================================================
#   الحضور اليومي (عرض أي يوم + تسجيل يدوي)
# ============================================================

@router.get("/attendance/day")
async def attendance_day(
    date: Optional[str] = Query(None),
    stage_id: Optional[str] = Query(None),
    group_id: Optional[str] = Query(None),
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db),
):
    """حضور يوم معيّن — بيرجّع الحاضرين والغايبين (مين مجاش) في النطاق المختار.

    لو مفيش تاريخ متبعت بياخد النهاردة. الغياب بيتحسب من طلاب النطاق ناقص الحاضرين.
    """
    date_str = date or _today_str()

    # نطاق الطلاب
    sfilters = {}
    if group_id:
        sfilters["group_id"] = group_id
    elif stage_id:
        sfilters["stage_id"] = stage_id
    students = await db.center_students.query(sfilters).to_list(20000)
    student_map = {str(s["_id"]): s for s in students}

    # الحاضرين في اليوم ده
    afilters = {"date": date_str}
    if group_id:
        afilters["group_id"] = group_id
    elif stage_id:
        afilters["stage_id"] = stage_id
    records = await db.center_attendance.query(afilters).to_list(20000)

    present = []
    present_ids = set()
    for r in records:
        sid = r["student_id"]
        present_ids.add(sid)
        st = student_map.get(sid)
        present.append({
            "student_id": sid,
            "name": st["name"] if st else "—",
            "student_number": st["student_number"] if st else "",
            "parent_phone": st["parent_phone"] if st else "",
            "group_id": r.get("group_id"),
            "was_paid": r.get("was_paid", False),
        })
    present.sort(key=lambda x: x["name"])

    # الغايبين = طلاب النطاق اللي مش في الحاضرين
    absent = []
    for s in students:
        if str(s["_id"]) not in present_ids:
            absent.append({
                "student_id": str(s["_id"]),
                "name": s["name"],
                "student_number": s["student_number"],
                "parent_phone": s["parent_phone"],
                "group_id": s["group_id"],
            })
    absent.sort(key=lambda x: x["name"])

    return {
        "date": date_str,
        "present_count": len(present),
        "absent_count": len(absent),
        "present": present,
        "absent": absent,
    }


@router.post("/attendance/manual")
async def manual_attendance(data: ManualAttendanceRequest, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    """تسجيل حضور طالب يدويًا (بالإيد) في يوم معيّن — من غير اسكان."""
    _oid(data.student_id, "الطالب")
    student = await db.center_students.get_one({"_id": data.student_id})
    if not student:
        raise HTTPException(status_code=404, detail="الطالب مش موجود")

    date_str = data.date or _today_str()
    student_id = str(student["_id"])
    month = date_str[:7]  # شهر التاريخ المختار
    paid = await _is_paid(db, student_id, month)

    existing = await db.center_attendance.get_one({"student_id": student_id, "date": date_str})
    if existing:
        return {"status": "already", "date": date_str, "message": "الطالب مسجّل حضور في اليوم ده خلاص"}

    doc = attendance_doc(student_id, student["group_id"], student.get("stage_id"),
                         date_str, str(current_user["_id"]), paid)
    await db.center_attendance.add(doc)
    return {"status": "recorded", "date": date_str, "paid_that_month": paid}


@router.delete("/attendance")
async def delete_attendance(
    student_id: str = Query(...),
    date: str = Query(...),
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db),
):
    """إلغاء حضور طالب في يوم معيّن (يبقى غايب)."""
    rec = await db.center_attendance.get_one({"student_id": student_id, "date": date})
    if not rec:
        raise HTTPException(status_code=404, detail="مفيش تسجيل حضور في اليوم ده")
    await db.center_attendance.remove_one({"_id": rec["_id"]})
    return {"message": "تم إلغاء الحضور"}


# ============================================================
#   التقارير
# ============================================================

@router.get("/reports/today")
async def report_today(
    stage_id: Optional[str] = Query(None),
    group_id: Optional[str] = Query(None),
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db),
):
    """مين حضر النهاردة (مع فلترة اختيارية بالمرحلة/المجموعة)."""
    date_str = _today_str()
    filters = {"date": date_str}
    if group_id:
        filters["group_id"] = group_id
    elif stage_id:
        filters["stage_id"] = stage_id

    records = await db.center_attendance.query(filters).to_list(5000)
    out = []
    for a in records:
        student = await db.center_students.get_one({"_id": a["student_id"]})
        if not student:
            continue
        out.append({
            "student_id": a["student_id"],
            "name": student["name"],
            "student_number": student["student_number"],
            "group_id": a["group_id"],
            "was_paid": a.get("was_paid", False),
        })
    out.sort(key=lambda x: x["name"])
    return {"date": date_str, "count": len(out), "students": out}


@router.get("/reports/unpaid")
async def report_unpaid(
    stage_id: Optional[str] = Query(None),
    group_id: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db),
):
    """الطلاب اللي مدفعوش الشهر (مع فلترة اختيارية)."""
    month = month or _current_month()
    filters = {}
    if group_id:
        filters["group_id"] = group_id
    elif stage_id:
        filters["stage_id"] = stage_id

    students = await db.center_students.query(filters).to_list(5000)
    unpaid = []
    for s in students:
        if not await _is_paid(db, str(s["_id"]), month):
            unpaid.append({
                "student_id": str(s["_id"]),
                "name": s["name"],
                "student_number": s["student_number"],
                "parent_phone": s["parent_phone"],
                "group_id": s["group_id"],
                "monthly_fee": s["monthly_fee"],
            })
    unpaid.sort(key=lambda x: x["name"])
    return {"month": month, "count": len(unpaid), "students": unpaid}


@router.get("/reports/monthly")
async def report_monthly(
    stage_id: Optional[str] = Query(None),
    group_id: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    current_user=Depends(get_current_teacher_or_assistant),
    db=Depends(get_db),
):
    """تقرير الشهر: جدول واحد لكل طالب فيه عدد الحصص اللي حضرها الشهر ده
    وحالة الدفع (دفع/مدفعش) — مع فلترة اختيارية بالمرحلة أو المجموعة.

    ده اللي بيجمع في مكان واحد: حضور الطلاب في كل مجموعة خلال الشهر +
    مين دفع ومين لسه ما دفعش.
    """
    month = month or _current_month()

    # نطاق الطلاب
    sfilters = {}
    if group_id:
        sfilters["group_id"] = group_id
    elif stage_id:
        sfilters["stage_id"] = stage_id
    students = await db.center_students.query(sfilters).to_list(20000)

    # حضور النطاق (كله) ونعدّ حصص الشهر لكل طالب
    afilters = {}
    if group_id:
        afilters["group_id"] = group_id
    elif stage_id:
        afilters["stage_id"] = stage_id
    attendance = await db.center_attendance.query(afilters).to_list(100000)
    counts: dict = {}
    for a in attendance:
        if str(a.get("date", "")).startswith(month):
            sid = a["student_id"]
            counts[sid] = counts.get(sid, 0) + 1

    # مدفوعات الشهر ده (استعلام واحد بالشهر) → خريطة student_id ← الدفعة
    payments = await db.center_payments.query({"month": month}).to_list(100000)
    paid_map = {p["student_id"]: p for p in payments}

    # أسماء المجموعات (عشان نعرضها في الجدول ونرتّب بيها)
    groups = await db.center_groups.query({}).to_list(5000)
    group_name = {str(g["_id"]): g["name"] for g in groups}

    rows = []
    total_sessions = 0
    paid_count = 0
    total_collected = 0.0
    for s in students:
        sid = str(s["_id"])
        sess = counts.get(sid, 0)
        pay = paid_map.get(sid)
        is_paid = pay is not None
        amount = (pay.get("amount") or 0) if pay else 0
        rows.append({
            "student_id": sid,
            "name": s["name"],
            "student_number": s["student_number"],
            "parent_phone": s["parent_phone"],
            "group_id": s["group_id"],
            "group_name": group_name.get(s["group_id"], "—"),
            "monthly_fee": s["monthly_fee"],
            "sessions": sess,
            "paid": is_paid,
            "amount_paid": amount,
        })
        total_sessions += sess
        if is_paid:
            paid_count += 1
            total_collected += amount

    rows.sort(key=lambda x: (x["group_name"], x["name"]))

    return {
        "month": month,
        "students_count": len(rows),
        "paid_count": paid_count,
        "unpaid_count": len(rows) - paid_count,
        "total_sessions": total_sessions,
        "total_collected": total_collected,
        "rows": rows,
    }


@router.get("/groups/{group_id}/summary")
async def group_summary(group_id: str, current_user=Depends(get_current_teacher_or_assistant), db=Depends(get_db)):
    """ملخّص مجموعة: عدد الطلاب، الحاضرين النهاردة، اللي مدفعوش."""
    _oid(group_id, "المجموعة")
    month = _current_month()
    today = _today_str()

    students = await db.center_students.query({"group_id": group_id}).to_list(5000)
    total = len(students)
    unpaid = 0
    for s in students:
        if not await _is_paid(db, str(s["_id"]), month):
            unpaid += 1

    present_today = await db.center_attendance.count({"group_id": group_id, "date": today})

    return {
        "students_count": total,
        "present_today": present_today,
        "unpaid_count": unpaid,
        "month": month,
        "date": today,
    }
