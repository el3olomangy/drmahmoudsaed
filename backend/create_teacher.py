"""
سكريبت لمرة واحدة: إنشاء حساب المدرس (صاحب المنصة) مباشرة في Firebase.

طريقة الاستخدام:
1) انسخ الملف ده جوه مجلد backend/ بتاع المشروع (بجانب app/).
2) تأكد إن backend/.env فيه بيانات Firebase (نفس اللي شغّل بيها الـ API عادي):
   FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL,
   وإما FIREBASE_SERVICE_ACCOUNT_FILE أو (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)
3) عدّل بيانات المدرس تحت (الاسم / رقم الهاتف / كلمة المرور) في قسم CONFIG.
4) من داخل مجلد backend شغّل:
      python create_teacher.py
5) هتلاقي رسالة تأكيد فيها الـ ID بتاع الحساب. بعدها سجّل دخول عادي من صفحة تسجيل الدخول
   في الموقع برقم الهاتف وكلمة المرور اللي حطيتهم.

ملاحظة: السكريبت بيرفض ينشئ حساب مدرس جديد لو فيه رقم هاتف مطابق موجود بالفعل،
عشان محدش يشغّله غلط مرتين.
"""

import asyncio
import sys
import os

# يضيف مجلد backend لمسار البحث عشان يقدر يستورد app.*
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import connect_db, get_db
from app.core.security import get_password_hash
from datetime import datetime, timezone

# ====================== CONFIG — عدّل البيانات دي ======================
TEACHER_FIRST_NAME = "محمود"
TEACHER_LAST_NAME = "سعيد"
TEACHER_PHONE = "01000507105"        # رقم هاتف مصري 11 رقم — هيبقى Username الدخول
TEACHER_PASSWORD = "admin112004"     # غيّرها لكلمة مرور قوية قبل التشغيل
# =========================================================================


async def main():
    print("جاري الاتصال بـ Firebase...")
    await connect_db()
    db = get_db()

    existing = await db.users.get_one({"phone": TEACHER_PHONE})
    if existing:
        print(f"⚠️  رقم الهاتف {TEACHER_PHONE} مستخدم بالفعل لحساب موجود (role={existing.get('role')}).")
        print("عدّل TEACHER_PHONE في السكريبت أو احذف الحساب القديم يدويًا من Firebase Console لو غلط.")
        return

    teacher_doc = {
        "first_name": TEACHER_FIRST_NAME,
        "last_name": TEACHER_LAST_NAME,
        "phone": TEACHER_PHONE,
        "parent_phone": None,
        "password": get_password_hash(TEACHER_PASSWORD),
        "gender": None,
        "grade": None,
        "governorate": None,
        "role": "teacher",
        "device_id": None,
        "is_active": True,
        "enrolled_courses": [],
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.users.add(teacher_doc)

    print("\n✅ تم إنشاء حساب المدرس بنجاح")
    print(f"   ID: {result.inserted_id}")
    print(f"   رقم الهاتف (Username): {TEACHER_PHONE}")
    print("   سجّل دخول من صفحة تسجيل الدخول في الموقع بنفس الرقم وكلمة المرور.")
    print("   ملحوظة: المدرس والمساعد مش مربوطين بجهاز واحد زي الطالب، فتقدر تدخل من أي جهاز.")


if __name__ == "__main__":
    asyncio.run(main())