from pydantic_settings import BaseSettings
from typing import List, Optional
class Settings(BaseSettings):
    FIREBASE_SERVICE_ACCOUNT_FILE: str | None = None
    FIREBASE_PROJECT_ID: str
    FIREBASE_DATABASE_URL: str
    FIREBASE_STORAGE_BUCKET: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    # ملاحظة: النوع str (مش List) عن قصد — عشان pydantic-settings مايحاولش يقراها
    # كـ JSON من متغير البيئة (ده كان بيكسر التطبيق كله لو القيمة مش JSON صالح).
    # بنقبل هنا JSON array أو نص مفصول بفواصل، والتحويل لقائمة في cors_origins.
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ====== المهام المجدولة (تسليم تلقائي للامتحانات/الواجبات المنتهية + إشعارات) ======
    # على استضافة دائمة (Railway/Render/VPS) سيبها True — الـ loop الخلفي بيشتغل عادي.
    # على Vercel (serverless) خليها false واستخدم Vercel Cron ينده:
    #   GET /api/v1/cron/deadline-checks  ومعاه هيدر Authorization: Bearer <CRON_SECRET>
    ENABLE_BACKGROUND_SCHEDULER: bool = True
    # سر بيتأكد إن اللي بينده مسار الـ cron هو Vercel Cron فعلاً (مش أي حد).
    CRON_SECRET: Optional[str] = None

    # ====== Bunny.net — Storage (images) ======
    # كل هذه القيم تُقرأ من الـ .env فقط ولا تصل أبدًا للـ Frontend
    BUNNY_STORAGE_ZONE: Optional[str] = None
    BUNNY_STORAGE_ACCESS_KEY: Optional[str] = None
    BUNNY_STORAGE_REGION_ENDPOINT: Optional[str] = None
    BUNNY_STORAGE_CDN_URL: Optional[str] = None

    # ====== Bunny.net — Stream (lecture videos) ======
    BUNNY_STREAM_LIBRARY_ID: Optional[str] = None
    BUNNY_STREAM_API_KEY: Optional[str] = None
    BUNNY_STREAM_CDN_HOSTNAME: Optional[str] = None
    # سر اختياري للتحقق من مصدر الـ webhook (لو تم ضبطه لاحقًا من Bunny Dashboard)
    BUNNY_STREAM_WEBHOOK_SECRET: Optional[str] = None

    class Config: env_file = ".env"

    @property
    def cors_origins(self) -> List[str]:
        """بترجّع نطاقات الـ CORS كقائمة — تقبل JSON array أو نص مفصول بفواصل."""
        raw = (self.ALLOWED_ORIGINS or "").strip()
        if not raw:
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        if raw.startswith("["):
            try:
                import json
                val = json.loads(raw)
                if isinstance(val, list):
                    items = [str(x).strip() for x in val if str(x).strip()]
                    if items:
                        return items
            except Exception:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def bunny_storage_configured(self) -> bool:
        return bool(self.BUNNY_STORAGE_ZONE and self.BUNNY_STORAGE_ACCESS_KEY and self.BUNNY_STORAGE_CDN_URL)

    @property
    def bunny_stream_configured(self) -> bool:
        return bool(self.BUNNY_STREAM_LIBRARY_ID and self.BUNNY_STREAM_API_KEY)
try:
    settings = Settings()
except Exception as e:
    import traceback
    print("=== SETTINGS ERROR ===")
    traceback.print_exc()
    raise