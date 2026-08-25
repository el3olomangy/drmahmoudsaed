"""
Rate limiting مركزي للمنصة.

- Limiter واحد مشترك بين كل الـ routes (بدل نسخة في كل ملف) عشان الحدود
  تكون متسّقة والاستثناء يتظبط في مكان واحد.
- key_func بيقرأ عنوان العميل الحقيقي من X-Forwarded-For — ضروري ورا بروكسي/CDN
  زي Vercel، وإلا كل المستخدمين هيتحسبوا كأنهم IP واحد (IP البروكسي).

ملاحظة: التخزين هنا in-memory (لكل instance). ده كافي كخط دفاع أول ضد
الـ flooding. الحماية الأساسية ضد تخمين كلمة المرور مبنية على قفل تدريجي
مخزّن في قاعدة البيانات (شوف auth.py) عشان يشتغل حتى على serverless بأكثر من
instance.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def client_ip(request: Request) -> str:
    """يرجّع أقرب IP حقيقي للعميل مع احترام سلسلة البروكسي."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # أول عنوان في القائمة هو العميل الأصلي
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip, default_limits=[])
