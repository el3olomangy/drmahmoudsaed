from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import uuid, io
from urllib.parse import quote
from PIL import Image as PILImage
from firebase_admin import storage
from ...core.dependencies import get_current_teacher_or_assistant
from ...core.config import settings

router = APIRouter(prefix="/upload", tags=["Upload"])
ALLOWED_TYPES={"image/jpeg","image/png","image/webp","image/gif"}; MAX_SIZE_MB=5

@router.post("/image")
async def upload_image(file: UploadFile=File(...), current_user=Depends(get_current_teacher_or_assistant)):
    if file.content_type not in ALLOWED_TYPES: raise HTTPException(400,"نوع الملف مش مدعوم — ارفع صورة JPG أو PNG أو WebP")
    content=await file.read()
    if len(content)>MAX_SIZE_MB*1024*1024: raise HTTPException(400,f"حجم الصورة أكبر من {MAX_SIZE_MB}MB")
    try:
        img=PILImage.open(io.BytesIO(content)).convert("RGB")
        if img.width>1200 or img.height>1200: img.thumbnail((1200,1200),PILImage.LANCZOS)
        out=io.BytesIO(); img.save(out,format="JPEG",quality=85,optimize=True); compressed=out.getvalue()
    except Exception: raise HTTPException(400,"الملف مش صورة صالحة")
    if not settings.FIREBASE_STORAGE_BUCKET: raise HTTPException(503,"Firebase Storage غير مُعد")
    filename=f"images/{uuid.uuid4().hex}.jpg"; token=uuid.uuid4().hex
    bucket=storage.bucket(settings.FIREBASE_STORAGE_BUCKET); blob=bucket.blob(filename)
    blob.metadata={"firebaseStorageDownloadTokens":token}; blob.upload_from_string(compressed,content_type="image/jpeg"); blob.patch()
    url=f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quote(filename,safe='')}?alt=media&token={token}"
    return {"url":url}

@router.delete("/image/{filename:path}")
async def delete_image(filename:str,current_user=Depends(get_current_teacher_or_assistant)):
    if not settings.FIREBASE_STORAGE_BUCKET: raise HTTPException(503,"Firebase Storage غير مُعد")
    clean=filename if filename.startswith("images/") else f"images/{filename}"
    try: storage.bucket(settings.FIREBASE_STORAGE_BUCKET).blob(clean).delete()
    except Exception: pass
    return {"message":"تم الحذف"}
