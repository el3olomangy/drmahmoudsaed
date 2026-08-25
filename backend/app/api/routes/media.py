"""
Media routes — Bunny.net integration.

Images (education_stage, course, homework_question, exam_question) go through
Bunny Storage. Lecture videos go through Bunny Stream exclusively. All
privileged Bunny calls happen here on the backend; no admin secret is ever
returned to the client.

Phase 3: الرفع بقى مباشر من المتصفح لـ Bunny عن طريق بروتوكول TUS
(resumable upload) بدل ما يعدي على الباك اند بتاعنا. السبب: أي استضافة
serverless (زي Vercel) بيكون فيها حد أقصى صغير جدًا لحجم جسم الطلب (٤.٥
ميجا على Vercel تحديدًا) ومدة تنفيذ قصيرة — مفيش طريقة نرفع فيديو حقيقي
من خلالها. الباك اند دوره بقى إنه بس يـ"وقّع" تصريح رفع مؤقت وآمن (بيتحقق
منه Bunny مباشرة) من غير ما يكشف الـ API key الأساسي للفرونت إند خالص.
مسار /videos/{video_id}/upload القديم اتسيب للتوافق بس مش مستخدم من
الفرونت إند الحالي.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile

from ...core.dependencies import get_current_teacher_or_assistant, get_current_user
from ...services import bunny_storage, bunny_stream
from ...core.config import settings

logger = logging.getLogger("media.routes")

router = APIRouter(prefix="/media", tags=["Media"])
webhook_router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

VALID_IMAGE_CATEGORIES = set(bunny_storage.CATEGORY_PATHS.keys())
# الطالب مسموح له بس يرفع صور إجابته على الأسئلة المقالية — أي فئة تانية (كورس/مرحلة/سؤال المدرس..) تفضل مدرس/مساعد بس
STUDENT_ALLOWED_CATEGORIES = bunny_storage.STUDENT_ALLOWED_CATEGORIES


def _category_from_path(path: str) -> str | None:
    for category, prefix in bunny_storage.CATEGORY_PATHS.items():
        if path.startswith(prefix + "/"):
            return category
    return None


# ============================================================
# IMAGES — Bunny Storage
# ============================================================

@router.post("/images")
async def upload_image(
    file: UploadFile = File(...),
    category: str = Form(...),
    current_user=Depends(get_current_user),
):
    if category not in VALID_IMAGE_CATEGORIES:
        raise HTTPException(400, f"فئة الصورة غير صحيحة. القيم المسموحة: {', '.join(sorted(VALID_IMAGE_CATEGORIES))}")

    # الطالب مسموح له يرفع بس صور إجابة الأسئلة المقالية — أي فئة تانية محتاجة مدرس/مساعد
    if current_user["role"] not in ("teacher", "assistant") and category not in STUDENT_ALLOWED_CATEGORIES:
        raise HTTPException(403, "غير مصرح لك برفع هذا النوع من الصور")

    if file.content_type not in bunny_storage.ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "نوع الملف مش مدعوم — ارفع صورة JPG أو PNG أو WebP")

    content = await file.read()
    if not content:
        raise HTTPException(400, "الملف فارغ")

    try:
        result = await bunny_storage.upload_image(content, category)
    except bunny_storage.BunnyConfigError:
        raise HTTPException(503, "خدمة رفع الصور غير مُفعّلة حاليًا (Bunny Storage غير مُعد)")
    except ValueError as e:
        raise HTTPException(400, str(e))
    except bunny_storage.BunnyStorageError:
        raise HTTPException(502, "فشل رفع الصورة — حاول مرة أخرى")

    return {
        "success": True,
        "media": {
            "type": "image",
            "category": result.category,
            "path": result.path,
            "url": result.url,
        },
    }


@router.delete("/images")
async def delete_image(
    path: str = Query(...),
    current_user=Depends(get_current_user),
):
    # الطالب مسموح له يحذف بس صور إجابته على الأسئلة المقالية (بيستبدلها مثلاً)
    if current_user["role"] not in ("teacher", "assistant"):
        category = _category_from_path(path)
        if category not in STUDENT_ALLOWED_CATEGORIES:
            raise HTTPException(403, "غير مصرح لك بحذف هذه الصورة")

    try:
        ok = await bunny_storage.delete_image(path)
    except ValueError:
        raise HTTPException(400, "مسار الصورة غير صالح")
    except bunny_storage.BunnyConfigError:
        raise HTTPException(503, "خدمة رفع الصور غير مُفعّلة حاليًا (Bunny Storage غير مُعد)")

    return {"success": ok}


# ============================================================
# LECTURE VIDEOS — Bunny Stream
# ============================================================

@router.post("/videos")
async def create_lecture_video(
    title: str = Query(...),
    current_user=Depends(get_current_teacher_or_assistant),
):
    """
    الخطوة الأولى: إنشاء سجل فيديو فارغ على Bunny Stream، وترجيع "تصريح رفع"
    مؤقت وآمن (TUS) عشان المتصفح يرفع ملف الفيديو مباشرة على Bunny من غير
    ما يمر على الباك اند بتاعنا خالص — ده ضروري لأي استضافة serverless
    (زي Vercel) بيكون فيها حد أقصى صغير لحجم الطلبات ومدة تنفيذها.
    """
    try:
        info = await bunny_stream.create_video(title=title or "Lecture Video")
        credentials = bunny_stream.build_tus_upload_credentials(info.video_id)
    except bunny_stream.BunnyConfigError:
        raise HTTPException(503, "خدمة الفيديو غير مُفعّلة حاليًا (Bunny Stream غير مُعد)")
    except bunny_stream.BunnyStreamError as exc:
        raise HTTPException(502, str(exc) or "فشل إنشاء الفيديو — حاول مرة أخرى")

    return {
        "success": True,
        "video": {"video_id": info.video_id, "library_id": info.library_id, "status": info.status},
        "tus_upload": credentials,
    }


@router.post("/videos/{video_id}/upload")
async def upload_lecture_video(
    video_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_teacher_or_assistant),
):
    """
    مسار احتياطي/قديم: رفع الفيديو عن طريق تمريره على الباك اند بدل الرفع
    المباشر بـ TUS. الفرونت إند الحالي بقى بيستخدم TUS مباشرة (شوف
    create_lecture_video) لأن المسار ده مش هيشتغل على استضافة serverless
    زي Vercel (حدود حجم الطلب ومدة التنفيذ). سايبينه هنا للتوافق فقط.
    """
    if not video_id or "/" in video_id or ".." in video_id:
        raise HTTPException(400, "معرّف فيديو غير صالح")

    content = await file.read()
    if not content:
        raise HTTPException(400, "الملف فارغ")

    try:
        await bunny_stream.upload_video(video_id, content)
    except bunny_stream.BunnyConfigError:
        raise HTTPException(503, "خدمة الفيديو غير مُفعّلة حاليًا (Bunny Stream غير مُعد)")
    except bunny_stream.BunnyStreamError as exc:
        raise HTTPException(502, str(exc) or "فشل رفع الفيديو — حاول مرة أخرى")

    return {"success": True, "video": {"video_id": video_id, "status": "processing"}}


@router.get("/videos/{video_id}/status")
async def get_lecture_video_status(
    video_id: str,
    current_user=Depends(get_current_teacher_or_assistant),
):
    if not video_id or "/" in video_id or ".." in video_id:
        raise HTTPException(400, "معرّف فيديو غير صالح")
    try:
        info = await bunny_stream.get_video(video_id)
    except bunny_stream.BunnyConfigError:
        raise HTTPException(503, "خدمة الفيديو غير مُفعّلة حاليًا (Bunny Stream غير مُعد)")
    except bunny_stream.BunnyStreamNotFoundError:
        raise HTTPException(404, "الفيديو غير موجود")
    except bunny_stream.BunnyStreamError as exc:
        raise HTTPException(502, str(exc) or "فشل معرفة حالة الفيديو")

    playback_url = None
    if info.status == "ready":
        try:
            playback_url = bunny_stream.get_playback_iframe_url(info.video_id)
        except bunny_stream.BunnyConfigError:
            playback_url = None

    return {
        "success": True,
        "video": {
            "video_id": info.video_id,
            "status": info.status,
            "title": info.title,
            "length_seconds": info.length_seconds,
            "playback_url": playback_url,
        },
    }


@router.delete("/videos/{video_id}")
async def delete_lecture_video(
    video_id: str,
    current_user=Depends(get_current_teacher_or_assistant),
):
    if not video_id or "/" in video_id or ".." in video_id:
        raise HTTPException(400, "معرّف فيديو غير صالح")
    try:
        ok = await bunny_stream.delete_video(video_id)
    except bunny_stream.BunnyConfigError:
        raise HTTPException(503, "خدمة الفيديو غير مُفعّلة حاليًا (Bunny Stream غير مُعد)")

    return {"success": ok}


# ============================================================
# WEBHOOK — Bunny Stream processing notifications
# ============================================================

@webhook_router.post("/bunny-stream")
async def bunny_stream_webhook(request: Request):
    """
    Webhook مستقبِل لتحديثات معالجة الفيديو من Bunny Stream.
    يُصمَّم ليكون idempotent وآمن حتى لو وصلت نفس الرسالة أكثر من مرة أو
    كان شكل الـ payload غير متوقع.

    ملاحظة: الـ URL النهائي المطلوب إدخاله في Bunny Dashboard هو:
        https://<your-deployed-domain>/api/v1/webhooks/bunny-stream
    وهو غير معروف الآن لأن دومين النشر لم يُحدَّد بعد.
    """
    if settings.BUNNY_STREAM_WEBHOOK_SECRET:
        provided = request.headers.get("X-Webhook-Secret") or request.query_params.get("secret")
        if provided != settings.BUNNY_STREAM_WEBHOOK_SECRET:
            raise HTTPException(401, "webhook secret غير صحيح")

    try:
        payload = await request.json()
    except Exception:
        logger.warning("bunny stream webhook: invalid JSON payload received")
        return {"received": True}

    video_id = payload.get("VideoGuid") or payload.get("videoGuid") or payload.get("guid")
    status = payload.get("Status") or payload.get("status")
    logger.info("bunny stream webhook received video_id=%s status=%s", video_id, status)

    # Phase 1: لا يوجد بعد ربط بمحاضرة داخل قاعدة البيانات — يُترك لـ Phase 2.
    # المعالجة هنا idempotent بطبيعتها لأنها لا تُغيّر أي حالة الآن، فقط تسجّل الاستقبال.
    return {"received": True}
