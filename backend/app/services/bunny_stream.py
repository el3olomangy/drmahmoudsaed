"""
Bunny.net Stream service — used exclusively for lecture videos.

Lecture videos must never be uploaded to normal Bunny Storage. This module
wraps Bunny's Stream API (create video, upload, status, delete) and never
sends BUNNY_STREAM_API_KEY to the frontend — every call happens from the
backend only.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import socket
import time
from dataclasses import dataclass
from typing import Optional

import requests
import urllib3.util.connection as urllib3_connection

from ..core.config import settings

logger = logging.getLogger("bunny.stream")

# إجبار الاتصال بـ Bunny على IPv4 فقط.
#
# سبب شائع جدًا لنفس النمط ده بالظبط (طلبات JSON صغيرة بتنجح فورًا، لكن أي
# طلب فيه نقل بيانات فعلي — زي رفع فيديو — بيعلّق ويوصل لـ write timeout):
# لو الـ DNS رجّع عنوان IPv6 لـ Bunny والشبكة/مزوّد الإنترنت عندك مش بيدعم
# IPv6 كويس (منتشر جدًا)، بيبدأ الاتصال لكن نقل البيانات بيتوقف تمامًا.
# إجبار IPv4 هنا بيتجنّب المشكلة دي تمامًا، وBunny بيدعم IPv4 عادي.
_original_allowed_gai_family = urllib3_connection.allowed_gai_family


def _force_ipv4_gai_family():
    return socket.AF_INET


urllib3_connection.allowed_gai_family = _force_ipv4_gai_family

BUNNY_STREAM_BASE = "https://video.bunnycdn.com/library"

# حالات المعالجة الفعلية اللي بيرجعها Bunny Stream (documented statuses)
# 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished, 5 Error, 6 UploadFailed
_BUNNY_STATUS_MAP = {
    0: "uploading",
    1: "processing",
    2: "processing",
    3: "processing",
    4: "ready",
    5: "failed",
    6: "failed",
}

# (connect, read/write) — الفيديوهات كبيرة الحجم فمهلتها أطول من الصور
_CONNECT_TIMEOUT = 10.0
_UPLOAD_READ_TIMEOUT = 60.0 * 30  # حتى ٣٠ دقيقة لرفع فيديوهات كبيرة
_METADATA_READ_TIMEOUT = 20.0

# لو حصل انقطاع اتصال أثناء رفع الفيديو (مش خطأ من Bunny نفسه، بس تعثّر شبكة
# لحظي)، بنعيد المحاولة تلقائيًا قبل ما نرجّع فشل نهائي للمستخدم.
# الشبكة عند بعض المستخدمين بتفشل بمعدل عالي نسبيًا (حوالي محاولة ناجحة من كل
# 3)، فرفعنا عدد المحاولات وخليناها بتاخد وقت أطول شوية بين كل محاولة والتانية
# (backoff تصاعدي) بدل ما نستسلم بسرعة.
_UPLOAD_MAX_RETRIES = 5
_UPLOAD_RETRY_BACKOFF_SECONDS = 4.0


class BunnyConfigError(Exception):
    pass


class BunnyStreamError(Exception):
    pass


class BunnyStreamNotFoundError(BunnyStreamError):
    pass


@dataclass
class VideoInfo:
    video_id: str
    library_id: str
    status: str  # uploading | processing | ready | failed
    title: Optional[str] = None
    length_seconds: Optional[float] = None


def _require_config() -> None:
    if not settings.bunny_stream_configured:
        raise BunnyConfigError("Bunny Stream غير مُعد — تحقق من متغيرات البيئة الخاصة به")


def _headers() -> dict:
    return {"AccessKey": settings.BUNNY_STREAM_API_KEY, "accept": "application/json"}


def _library_url(*parts: str) -> str:
    library_id = settings.BUNNY_STREAM_LIBRARY_ID
    suffix = "/".join(str(p).strip("/") for p in parts if p)
    return f"{BUNNY_STREAM_BASE}/{library_id}/videos" + (f"/{suffix}" if suffix else "")


def _map_status(raw_status) -> str:
    try:
        return _BUNNY_STATUS_MAP.get(int(raw_status), "processing")
    except (TypeError, ValueError):
        return "processing"


_TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload"
_TUS_EXPIRE_SECONDS = 60 * 60 * 6  # 6 ساعات — وقت كافي لرفع فيديوهات كبيرة على نت بطيء


def build_tus_upload_credentials(video_id: str) -> dict:
    """
    بيولّد "تصريح رفع" مؤقت وآمن للمتصفح يرفع بيه الفيديو مباشرة على Bunny
    (بروتوكول TUS) من غير ما الـ API key الأساسي يوصل للفرونت إند خالص.
    التوقيع = SHA256(library_id + api_key + expiration_time + video_id)
    """
    _require_config()
    library_id = str(settings.BUNNY_STREAM_LIBRARY_ID)
    api_key = settings.BUNNY_STREAM_API_KEY
    expiration_time = int(time.time()) + _TUS_EXPIRE_SECONDS
    signature_string = f"{library_id}{api_key}{expiration_time}{video_id}"
    signature = hashlib.sha256(signature_string.encode()).hexdigest()
    return {
        "endpoint": _TUS_ENDPOINT,
        "library_id": library_id,
        "video_id": video_id,
        "expiration_time": expiration_time,
        "signature": signature,
    }


def _create_video_sync(title: str) -> dict:
    _require_config()
    try:
        resp = requests.post(
            _library_url(),
            json={"title": title},
            headers={**_headers(), "Content-Type": "application/json"},
            timeout=(_CONNECT_TIMEOUT, _METADATA_READ_TIMEOUT),
        )
    except requests.exceptions.RequestException as exc:
        logger.error("bunny stream create video connection error: %s", exc)
        raise BunnyStreamError("تعذّر الاتصال بـ Bunny Stream — تحقق من الإنترنت وحاول تاني") from exc
    if resp.status_code not in (200, 201):
        logger.error("bunny stream create video failed status=%s", resp.status_code)
        raise BunnyStreamError(f"فشل إنشاء الفيديو على Bunny Stream (status {resp.status_code})")
    return resp.json()


def _upload_video_sync(video_id: str, content: bytes) -> None:
    _require_config()
    try:
        resp = requests.put(
            _library_url(video_id),
            data=content,
            headers={**_headers(), "Content-Type": "application/octet-stream"},
            timeout=(_CONNECT_TIMEOUT, _UPLOAD_READ_TIMEOUT),
        )
    except requests.exceptions.RequestException as exc:
        # بيحصل غالبًا لما الاتصال بالإنترنت يتقطع/يبطّأ أثناء رفع فيديو كبير —
        # مش خطأ في الكود، لازم نحوّله لرسالة واضحة بدل ما الـ request يعمل crash
        # من غير response كامل (وده اللي بيظهر في المتصفح كـ CORS error مضلِّل).
        logger.error("bunny stream upload connection error video_id=%s: %s", video_id, exc)
        raise BunnyStreamError(
            "انقطع الاتصال أثناء رفع الفيديو (مشكلة شبكة) — تحقق من ثبات الإنترنت وحاول تاني، "
            "ولو المشكلة بتتكرر مع فيديوهات كبيرة جرّب فيديو أصغر للتأكد"
        ) from exc
    if resp.status_code not in (200, 201):
        logger.error("bunny stream upload failed status=%s video_id=%s", resp.status_code, video_id)
        raise BunnyStreamError(f"فشل رفع الفيديو على Bunny Stream (status {resp.status_code})")


def _get_video_sync(video_id: str) -> dict:
    _require_config()
    try:
        resp = requests.get(
            _library_url(video_id),
            headers=_headers(),
            timeout=(_CONNECT_TIMEOUT, _METADATA_READ_TIMEOUT),
        )
    except requests.exceptions.RequestException as exc:
        logger.error("bunny stream get video connection error video_id=%s: %s", video_id, exc)
        raise BunnyStreamError("تعذّر الاتصال بـ Bunny Stream — تحقق من الإنترنت وحاول تاني") from exc
    if resp.status_code == 404:
        raise BunnyStreamNotFoundError("الفيديو غير موجود على Bunny Stream")
    if resp.status_code != 200:
        logger.error("bunny stream get video failed status=%s video_id=%s", resp.status_code, video_id)
        raise BunnyStreamError(f"فشل قراءة بيانات الفيديو (status {resp.status_code})")
    return resp.json()


def _delete_video_sync(video_id: str) -> bool:
    _require_config()
    try:
        resp = requests.delete(
            _library_url(video_id),
            headers=_headers(),
            timeout=(_CONNECT_TIMEOUT, _METADATA_READ_TIMEOUT),
        )
    except requests.exceptions.RequestException as exc:
        logger.error("bunny stream delete connection error video_id=%s: %s", video_id, exc)
        raise BunnyStreamError("تعذّر الاتصال بـ Bunny Stream — تحقق من الإنترنت وحاول تاني") from exc
    if resp.status_code in (200, 204, 404):
        return True
    logger.error("bunny stream delete failed status=%s video_id=%s", resp.status_code, video_id)
    return False


async def create_video(title: str) -> VideoInfo:
    logger.info("bunny stream video created title=%s", title)
    data = await asyncio.to_thread(_create_video_sync, title)
    video_id = data.get("guid") or data.get("videoId") or data.get("id")
    if not video_id:
        raise BunnyStreamError("رد Bunny Stream غير متوقع عند إنشاء الفيديو")
    return VideoInfo(video_id=video_id, library_id=str(settings.BUNNY_STREAM_LIBRARY_ID), status="uploading")


async def upload_video(video_id: str, content: bytes) -> None:
    logger.info("bunny stream video upload started video_id=%s size=%s", video_id, len(content))
    last_error: Optional[BunnyStreamError] = None
    for attempt in range(1, _UPLOAD_MAX_RETRIES + 2):  # أول محاولة + عدد الإعادات
        try:
            await asyncio.to_thread(_upload_video_sync, video_id, content)
            logger.info("bunny stream video upload succeeded video_id=%s attempt=%s", video_id, attempt)
            return
        except BunnyStreamError as exc:
            last_error = exc
            is_network_issue = isinstance(exc.__cause__, requests.exceptions.RequestException)
            if not is_network_issue or attempt > _UPLOAD_MAX_RETRIES:
                break
            logger.warning(
                "bunny stream upload attempt %s/%s failed video_id=%s — retrying in %ss: %s",
                attempt, _UPLOAD_MAX_RETRIES + 1, video_id, _UPLOAD_RETRY_BACKOFF_SECONDS, exc,
            )
            await asyncio.sleep(_UPLOAD_RETRY_BACKOFF_SECONDS * attempt)
    assert last_error is not None
    raise last_error


async def get_video(video_id: str) -> VideoInfo:
    data = await asyncio.to_thread(_get_video_sync, video_id)
    status = _map_status(data.get("status"))
    logger.info("bunny stream video status video_id=%s status=%s", video_id, status)
    return VideoInfo(
        video_id=video_id,
        library_id=str(settings.BUNNY_STREAM_LIBRARY_ID),
        status=status,
        title=data.get("title"),
        length_seconds=data.get("length"),
    )


async def get_video_status(video_id: str) -> str:
    info = await get_video(video_id)
    return info.status


async def delete_video(video_id: str) -> bool:
    ok = await asyncio.to_thread(_delete_video_sync, video_id)
    if not ok:
        logger.warning("bunny stream delete failed video_id=%s", video_id)
    return ok


def get_playback_iframe_url(video_id: str) -> str:
    """رابط تشغيل آمن (iframe) لا يحتاج أي مفتاح إداري في الفرونت إند."""
    _require_config()
    library_id = settings.BUNNY_STREAM_LIBRARY_ID
    return f"https://iframe.mediadelivery.net/embed/{library_id}/{video_id}"


def get_direct_playback_url(video_id: str) -> str:
    """رابط HLS مباشر (playlist.m3u8) عبر الـ CDN hostname الخاص بالـ Stream."""
    _require_config()
    hostname = settings.BUNNY_STREAM_CDN_HOSTNAME
    return f"https://{hostname}/{video_id}/playlist.m3u8"
