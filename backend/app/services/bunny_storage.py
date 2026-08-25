"""
Bunny.net Storage service — used for images only (education stages, courses,
homework questions, exam questions). Lecture videos never go through this
service; they use Bunny Stream (see bunny_stream.py).

All secrets (BUNNY_STORAGE_ACCESS_KEY) live only in the backend .env and are
read through `settings`. Nothing here is imported by, or exposed to, the
frontend.
"""
from __future__ import annotations

import asyncio
import io
import logging
import uuid
from dataclasses import dataclass
from typing import Optional

import requests
from PIL import Image as PILImage, ImageOps

from ..core.config import settings

logger = logging.getLogger("bunny.storage")

# ====== حدود وإعدادات مركزية لكل صور المنصة ======
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE_MB = 8
MAX_IMAGE_DIMENSION = 6000  # يحمي من decompression-bomb / صور بأبعاد ضخمة
TARGET_MAX_DIMENSION = 1600  # أقصى بُعد بعد الـ resize (لا تُكبَّر الصور الأصغر)
WEBP_QUALITY = 82

# مسارات Bunny المسموح بها لكل فئة — الفرونت إند لا يختار المسار أبدًا
CATEGORY_PATHS = {
    "education_stage": "education-stages",
    "course": "courses",
    "homework_question": "questions/homework",
    "exam_question": "questions/exams",
    "user_avatar": "avatars/users",
    # صور إجابات الطالب على الأسئلة المقالية (اختبار/واجب) — الطالب يرفعها بنفسه
    "exam_answer": "answers/exams",
    "homework_answer": "answers/homework",
}

# الفئات اللي مسموح للطالب نفسه يرفع/يحذف فيها (باقي الفئات مدرس/مساعد بس)
STUDENT_ALLOWED_CATEGORIES = {"exam_answer", "homework_answer"}


class BunnyConfigError(Exception):
    """Bunny Storage غير مُعد بشكل صحيح في الـ environment."""


class BunnyStorageError(Exception):
    """خطأ أثناء التواصل مع Bunny Storage."""


@dataclass
class UploadedImage:
    category: str
    path: str
    url: str


def _require_config() -> None:
    if not settings.bunny_storage_configured:
        raise BunnyConfigError("Bunny Storage غير مُعد — تحقق من متغيرات البيئة الخاصة به")


def _connect_timeout_read_timeout() -> tuple[float, float]:
    # (connect, read) — الصور صغيرة نسبيًا فالمهلة قصيرة ومعقولة
    return (5.0, 30.0)


def validate_category(category: str) -> str:
    if category not in CATEGORY_PATHS:
        raise ValueError(f"فئة صورة غير معروفة: {category}")
    return category


def _validate_and_process_image(content: bytes) -> bytes:
    """يتحقق من صحة الصورة فعليًا (مش بس امتداد/MIME) ثم يحسّنها ويحولها WebP."""
    if len(content) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise ValueError(f"حجم الصورة أكبر من {MAX_IMAGE_SIZE_MB}MB")

    try:
        img = PILImage.open(io.BytesIO(content))
        img.load()  # يفشل هنا لو الملف تالف/مش صورة حقيقية
    except Exception:
        raise ValueError("الملف مش صورة صالحة")

    width, height = img.size
    if width <= 0 or height <= 0 or width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise ValueError("أبعاد الصورة غير مقبولة")

    # تصحيح الاتجاه حسب EXIF (لصور الموبايل) قبل أي تعديل آخر
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.mode else "RGB")

    # تصغير الصور الكبيرة فقط — لا نكبّر الصور الأصغر من الهدف
    if img.width > TARGET_MAX_DIMENSION or img.height > TARGET_MAX_DIMENSION:
        img.thumbnail((TARGET_MAX_DIMENSION, TARGET_MAX_DIMENSION), PILImage.LANCZOS)

    out = io.BytesIO()
    save_kwargs = {"format": "WEBP", "quality": WEBP_QUALITY, "method": 6}
    img.save(out, **save_kwargs)
    return out.getvalue()


def _put_object_sync(remote_path: str, data: bytes, content_type: str = "image/webp") -> None:
    _require_config()
    url = f"{settings.BUNNY_STORAGE_REGION_ENDPOINT.rstrip('/')}/{settings.BUNNY_STORAGE_ZONE}/{remote_path}"
    headers = {
        "AccessKey": settings.BUNNY_STORAGE_ACCESS_KEY,
        "Content-Type": content_type,
    }
    resp = requests.put(url, data=data, headers=headers, timeout=_connect_timeout_read_timeout())
    if resp.status_code not in (200, 201):
        logger.error("bunny storage upload failed status=%s path=%s", resp.status_code, remote_path)
        raise BunnyStorageError(f"فشل رفع الملف على Bunny Storage (status {resp.status_code})")


def _delete_object_sync(remote_path: str) -> bool:
    _require_config()
    url = f"{settings.BUNNY_STORAGE_REGION_ENDPOINT.rstrip('/')}/{settings.BUNNY_STORAGE_ZONE}/{remote_path}"
    headers = {"AccessKey": settings.BUNNY_STORAGE_ACCESS_KEY}
    resp = requests.delete(url, headers=headers, timeout=_connect_timeout_read_timeout())
    if resp.status_code in (200, 404):
        return True
    logger.error("bunny storage delete failed status=%s path=%s", resp.status_code, remote_path)
    return False


def _head_object_sync(remote_path: str) -> bool:
    _require_config()
    url = f"{settings.BUNNY_STORAGE_REGION_ENDPOINT.rstrip('/')}/{settings.BUNNY_STORAGE_ZONE}/{remote_path}"
    headers = {"AccessKey": settings.BUNNY_STORAGE_ACCESS_KEY}
    try:
        resp = requests.head(url, headers=headers, timeout=_connect_timeout_read_timeout())
        return resp.status_code == 200
    except requests.RequestException:
        return False


def get_public_url(path: str) -> str:
    _require_config()
    return f"{settings.BUNNY_STORAGE_CDN_URL.rstrip('/')}/{path.lstrip('/')}"


def is_safe_platform_path(path: str) -> bool:
    """يمنع path traversal ويتأكد إن المسار فعلًا تحت إحدى فئاتنا المعروفة."""
    if not path or path.startswith("/") or ".." in path:
        return False
    return any(path.startswith(prefix + "/") for prefix in CATEGORY_PATHS.values())


async def upload_image(file_bytes: bytes, category: str) -> UploadedImage:
    """يتحقق من الصورة، يحسّنها، يرفعها باسم UUID فريد، ويرجّع الرابط العام."""
    validate_category(category)
    processed = await asyncio.to_thread(_validate_and_process_image, file_bytes)
    remote_path = f"{CATEGORY_PATHS[category]}/{uuid.uuid4().hex}.webp"
    logger.info("bunny image upload started category=%s", category)
    await asyncio.to_thread(_put_object_sync, remote_path, processed, "image/webp")
    logger.info("bunny image upload succeeded category=%s path=%s", category, remote_path)
    return UploadedImage(category=category, path=remote_path, url=get_public_url(remote_path))


async def delete_image(path: str) -> bool:
    if not is_safe_platform_path(path):
        raise ValueError("مسار غير صالح للحذف")
    ok = await asyncio.to_thread(_delete_object_sync, path)
    if not ok:
        logger.warning("bunny image delete failed path=%s", path)
    return ok


async def file_exists(path: str) -> bool:
    if not is_safe_platform_path(path):
        return False
    return await asyncio.to_thread(_head_object_sync, path)
