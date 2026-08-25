import bcrypt
from jose import jwt
from datetime import datetime, timedelta, timezone
from .config import settings
from .database import get_db


def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    # iat لازم يتحط عشان فحص "تسجيل الخروج الإجباري" في get_current_user يشتغل صح
    # (من غيره التوكن يفضل شغال لحد ما ينتهي طبيعيًا حتى لو المدرس عمل force logout)
    to_encode.update({"exp": expire, "iat": now, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": now, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str, token_type: str = "access"):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return payload
    except Exception:
        return None


async def blacklist_token(token: str) -> None:
    """يضيف التوكن في الـ blacklist مع تاريخ انتهائه"""
    payload = decode_token(token, token_type="refresh")
    expires_at = None
    if payload and payload.get("exp"):
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    else:
        # لو التوكن مش صالح خليه يتمسح بعد يوم
        expires_at = datetime.now(timezone.utc) + timedelta(days=1)

    db = get_db()
    await db.token_blacklist.set_fields(
        {"token": token},
        {"$set": {"token": token, "expires_at": expires_at}},
        upsert=True,
    )


async def is_token_blacklisted(token: str) -> bool:
    """يتحقق إن التوكن اتحط في الـ blacklist"""
    db = get_db()
    doc = await db.token_blacklist.get_one({"token": token})
    return doc is not None