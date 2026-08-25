# Firebase Setup — خطوات التشغيل

## 1) لا تضع Service Account داخل المشروع
الملف السري الذي تم توفيره للاختبار **غير موجود داخل هذه النسخة**. لا ترفعه إلى GitHub.

### للتطوير المحلي — الطريقة الأسهل
ضع ملف Service Account في مكان آمن خارج مجلد المشروع، ثم أضف في `backend/.env`:

```env
FIREBASE_SERVICE_ACCOUNT_FILE=C:/secure/firebase-service-account.json
FIREBASE_PROJECT_ID=drmahmoudsaed-c3ad0
FIREBASE_DATABASE_URL=https://drmahmoudsaed-c3ad0-default-rtdb.europe-west1.firebasedatabase.app
FIREBASE_STORAGE_BUCKET=drmahmoudsaed-c3ad0.firebasestorage.app
SECRET_KEY=ضع_مفتاح_JWT_قوي_هنا
ALLOWED_ORIGINS=["http://localhost:3000"]
```

بديلًا عن الملف يمكنك استخدام `FIREBASE_CLIENT_EMAIL` و`FIREBASE_PRIVATE_KEY` كمتغيرات بيئة. عند نسخ المفتاح الخاص إلى منصة استضافة، حافظ على `\n` داخله؛ الكود يحوله تلقائيًا إلى أسطر صحيحة.

## 2) Firebase Realtime Database
من Firebase Console افتح **Realtime Database > Rules**، وانسخ محتوى `firebase-database-rules.json` ثم Publish. القواعد تمنع الوصول المباشر من المتصفح لأن القراءة والكتابة تتم من FastAPI باستخدام Admin SDK، وتحتوي كذلك على `.indexOn` للاستعلامات المستخدمة.

## 3) Firebase Storage
فعّل Firebase Storage للمشروع. الرفع من المنصة أصبح يذهب إلى Storage بدل القرص المحلي للسيرفر. تأكد أن `FIREBASE_STORAGE_BUCKET` يطابق اسم Bucket الظاهر في Firebase Console.

## 4) تشغيل Backend محليًا
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
افتح `/health` ويجب أن تحصل على `{"status":"ok"}`.

## 5) تشغيل Frontend
أنشئ `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```
ثم:
```bash
cd frontend
npm install
npm run dev
```

## 6) Vercel
أضف Environment Variables التالية في Project Settings > Environment Variables:
`FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `ALLOWED_ORIGINS`, و`NEXT_PUBLIC_API_URL`.

لا ترفع JSON إلى Vercel. استخدم `FIREBASE_CLIENT_EMAIL` و`FIREBASE_PRIVATE_KEY`. ضع عنوان واجهة الموقع الحقيقي داخل `ALLOWED_ORIGINS`، واضبط `NEXT_PUBLIC_API_URL` على عنوان `/api/v1` المنشور.

## 7) ملاحظة البيانات القديمة
هذه النسخة لا تحتوي Dump من MongoDB ولا بيانات اعتماد للقاعدة القديمة، لذلك لم يتم نسخ **البيانات الموجودة خارج ملفات المشروع** إلى Firebase. الكود نفسه لم يعد يعتمد على MongoDB. إذا كانت لديك بيانات إنتاج مهمة في MongoDB، يجب تصديرها قبل إيقاف القاعدة القديمة ثم تنفيذ استيراد مراقب إلى الهيكل الموضح في تقرير الهجرة.
