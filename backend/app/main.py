from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from slowapi.errors import RateLimitExceeded
from .core.database import connect_db, close_db
from .core.config import settings
from .core.ratelimit import limiter
from .core.scheduler import run_assignment_deadline_checker
from .api.routes import auth, courses, codes, exams, notifications, users, progress, upload, stats, assignments, grade_images, homework, media, center, cron

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    scheduler_task = None
    # على الاستضافة الدائمة الـ loop بيشتغل عادي. على Vercel (serverless) بنطفّيه
    # ونستخدم Vercel Cron ينده /api/v1/cron/deadline-checks بدله.
    if settings.ENABLE_BACKGROUND_SCHEDULER:
        scheduler_task = asyncio.create_task(run_assignment_deadline_checker())
    yield
    if scheduler_task:
        scheduler_task.cancel()
    await close_db()

app = FastAPI(
    title="El3olomangy API",
    description="منصة العلومنجي التعليمية",
    version="1.0.0",
    lifespan=lifespan
)

# ====== Rate limiting (مركزي ومربوط على مستوى التطبيق) ======
# ربط الـ limiter في state + مُعالج استثناء بيرجّع رسالة عربية واضحة (429)
# بدل الرد الافتراضي، وبيضيف هيدر Retry-After.
from fastapi import Request as _FRequest
from fastapi.responses import JSONResponse as _JSONResponse


async def _rate_limit_handler(request: _FRequest, exc: RateLimitExceeded):
    retry_after = getattr(exc, "retry_after", None)
    headers = {"Retry-After": str(retry_after)} if retry_after else {}
    return _JSONResponse(
        status_code=429,
        content={"detail": "محاولات كتير في وقت قصير — استنى شوية وحاول تاني."},
        headers=headers,
    )


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

ALLOWED_ORIGINS = settings.ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Device-ID"],
)

# Security Headers Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(courses.router, prefix="/api/v1")
app.include_router(codes.router, prefix="/api/v1")
app.include_router(exams.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(progress.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(assignments.router, prefix="/api/v1")
app.include_router(grade_images.router, prefix="/api/v1")
app.include_router(homework.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(media.webhook_router, prefix="/api/v1")
app.include_router(center.router, prefix="/api/v1")
app.include_router(cron.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "El3olomangy API is running 🚀"}

@app.get("/health")
async def health():
    return {"status": "ok"}