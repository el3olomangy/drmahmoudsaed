"""
سكريبت لمرة واحدة: تغيير كلمة مرور حساب المدرس مباشرة في Firebase
(مفيد لو مفيش صفحة "تغيير كلمة المرور" في لوحة تحكم المدرس، زي حالتنا هنا).

طريقة الاستخدام:
1) انسخ الملف ده جوه مجلد backend/ بتاع المشروع (بجانب app/ و create_teacher.py).
2) عدّل TEACHER_PHONE و NEW_PASSWORD تحت في قسم CONFIG.
3) من داخل مجلد backend، في تيرمينال منفصل عن اللي فيه uvicorn شغال، شغّل:
      python update_teacher_password.py
4) بعد ما تشوف رسالة النجاح، سجّل دخول بنفس رقم الهاتف وكلمة المرور الجديدة.
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import connect_db, get_db
from app.core.security import get_password_hash

# ====================== CONFIG — عدّل البيانات دي ======================
TEACHER_PHONE = "01000507105"     # نفس رقم الهاتف بتاع الحساب اللي عايز تغيّر باسوردته
NEW_PASSWORD = "admin112004"  # كلمة المرور الجديدة
# =========================================================================


async def main():
    print("جاري الاتصال بـ Firebase...")
    await connect_db()
    db = get_db()

    user = await db.users.get_one({"phone": TEACHER_PHONE})
    if not user:
        print(f"❌ مفيش حساب برقم الهاتف {TEACHER_PHONE}.")
        print("تأكد إن الرقم مطابق تمامًا لرقم الحساب اللي عايز تعدّله.")
        return

    if user.get("role") != "teacher":
        print(f"⚠️  الحساب ده role='{user.get('role')}' مش 'teacher'. هيتم تعديل كلمة المرور بس تأكد إنه الحساب الصح.")

    new_hash = get_password_hash(NEW_PASSWORD)
    await db.users.set_fields(
        {"_id": user["_id"]},
        {"$set": {"password": new_hash}},
    )

    print("\n✅ تم تغيير كلمة المرور بنجاح")
    print(f"   رقم الهاتف: {TEACHER_PHONE}")
    print("   سجّل دخول تاني بكلمة المرور الجديدة اللي حطيتها في NEW_PASSWORD.")


if __name__ == "__main__":
    asyncio.run(main())
