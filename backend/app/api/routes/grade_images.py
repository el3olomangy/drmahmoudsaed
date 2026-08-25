from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ...core.database import get_db
from ...core.dependencies import get_current_teacher

router = APIRouter(prefix="/grade-images", tags=["Grade Images"])

VALID_GRADES = [
    "first_preparatory", "second_preparatory", "third_preparatory",
    "first_secondary", "second_secondary", "third_secondary",
]

class GradeImageUpdate(BaseModel):
    image_url: str

@router.get("/")
async def get_all_grade_images(db=Depends(get_db)):
    """جيب صور كل المراحل — بدون login"""
    docs = await db.grade_images.query().to_list(20)
    result = {}
    for doc in docs:
        result[doc["grade"]] = doc.get("image_url", "")
    return result

@router.patch("/{grade}")
async def update_grade_image(
    grade: str,
    data: GradeImageUpdate,
    current_user=Depends(get_current_teacher),
    db=Depends(get_db)
):
    """تحديث صورة مرحلة معينة — مدرس فقط"""
    if grade not in VALID_GRADES:
        raise HTTPException(status_code=400, detail="مرحلة غير صالحة")

    await db.grade_images.set_fields(
        {"grade": grade},
        {"$set": {"grade": grade, "image_url": data.image_url}},
        upsert=True,
    )
    return {"message": "تم تحديث الصورة", "grade": grade, "image_url": data.image_url}