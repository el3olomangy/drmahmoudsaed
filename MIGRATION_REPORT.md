# MIGRATION REPORT

## ما تم تغييره
- الإبقاء على **FastAPI + Python** وواجهات API الحالية قدر الإمكان.
- استبدال طبقة MongoDB بطبقة Firebase Admin SDK لـ **Realtime Database**.
- إزالة `motor`, `pymongo`, `bson` و`ObjectId` من كود التشغيل والـdependencies.
- الإبقاء على JWT الحالي (Access/Refresh tokens) والأدوار `student`, `teacher`, `assistant` بدل تغيير Authentication بلا داعٍ.
- تحويل IDs الجديدة إلى IDs نصية مستقرة مع الحفاظ على شكل قصير متوافق مع الـFrontend والعلاقات الحالية.
- نقل رفع الصور من Local File System إلى Firebase Storage؛ لم تعد الصور المهمة تعتمد على قرص Vercel المؤقت.
- جعل CORS قابلًا للضبط من Environment Variables.
- إضافة `.env.example`, `firebase-database-rules.json`, `FIREBASE_SETUP.md`, و`vercel.json`.

## هيكل Realtime Database
الهيكل مسطح لتجنب deep nesting:

```text
/users/{userId}
/courses/{courseId}
/units/{unitId}                  -> course_id
/lectures/{lectureId}            -> unit_id, course_id
/exams/{examId}                  -> course_id, lecture_id, questions[]
/exam_results/{resultId}         -> exam_id, student_id
/assignments/{assignmentId}      -> course_id, lecture_id
/assignment_submissions/{id}     -> assignment_id, student_id
/lecture_progress/{id}           -> user_id, lecture_id
/codes/{codeId}
/notifications/{notificationId}
/activity_log/{activityId}
/token_blacklist/{tokenId}
/grade_images/{id}
```
العلاقات تحفظ كـIDs نصية بدل nesting عميق. الاستعلامات الشائعة تبدأ بفلتر RTDB server-side على child مفهرس ثم تطبق الشروط المركبة على المجموعة المرشحة فقط.

## Authentication والصلاحيات
JWT لم يتغير. صلاحيات teacher/student/assistant ما زالت في FastAPI، وFirebase Admin SDK يعمل على السيرفر فقط. قواعد RTDB تمنع القراءة والكتابة المباشرة من العميل، لذلك لا يستطيع الـFrontend تجاوز Business Logic أو الصلاحيات.

## MongoDB الذي تم حذفه
- اتصال Motor وMongo client.
- `MONGODB_URL` و`DATABASE_NAME`.
- `ObjectId`/`bson`.
- عمليات MongoDB المباشرة وأداة `fix_old_results.py` القديمة.
- dependencies: `motor`, `pymongo`.

## Environment Variables
راجع `.env.example`. الأسرار الحقيقية غير موجودة في المشروع النهائي. Service Account JSON غير مضمن.

## Rules / Indexes
استخدم `firebase-database-rules.json`. يحتوي على deny-by-default للوصول المباشر وعلى `.indexOn` للمفاتيح الشائعة مثل phone/role/grade/course_id/lecture_id/student_id/exam_id/created_at.

## الأداء
- الوصول بـID مباشر إلى `/collection/id` بدل scan.
- الاستعلامات ذات equality predicate تستخدم `order_by_child(...).equal_to(...)` في RTDB.
- العمليات المتزامنة blocking في Admin SDK مغلفة بـ`asyncio.to_thread` حتى لا توقف event loop في FastAPI.
- لا توجد listeners دائمة داخل Backend.
- تم الحفاظ على حدود القوائم الموجودة، مع بنية تسمح بإضافة cursor pagination لاحقًا دون تغيير نموذج البيانات.

## الملفات والفيديو
الصور انتقلت إلى Firebase Storage. الفيديوهات تظل URLs داخل بيانات المحاضرة ولا يتم تخزين ملفات الفيديو الكبيرة داخل FastAPI؛ وهذا مناسب للبنية المطلوبة. يفضل خدمة فيديو/Storage/CDN مخصصة للفيديوهات الكبيرة.

## الاختبارات التي أمكن تنفيذها هنا
- Python compile لجميع ملفات `backend/app`: ناجح.
- فحص مصدر Backend للتأكد من عدم وجود MongoDB/Motor/PyMongo/ObjectId وعمليات MongoDB المحددة: ناجح.
- لم يكن `node_modules` موجودًا في الـZIP، لذلك تعذر تشغيل `next build` دون تنزيل dependencies.
- بيئة التنفيذ الحالية لا تسمح بتنزيل `firebase-admin` من الإنترنت، لذلك تعذر إجراء اتصال حي بـFirebase من داخل بيئة الاختبار نفسها. المشروع يضيف dependency الصحيحة في `requirements.txt` ويجب تنفيذ اختبار الاتصال بعد `pip install -r requirements.txt` في بيئة لديها إنترنت.

## خطوة يدوية مهمة: بيانات MongoDB القديمة
ملف المشروع المرفق لا يحتوي Mongo dump أو بيانات اتصال MongoDB، لذلك لا يمكن نقل سجلات الإنتاج القديمة بأمان أو اختلاقها. **لا توقف MongoDB القديم إذا كان يحتوي بيانات إنتاج قبل أخذ Export/Backup.** الكود النهائي نفسه يستخدم Firebase كقاعدة البيانات الأساسية.

## ملاحظة Firebase Authentication
Firebase Authentication قد يكون خيارًا جيدًا مستقبلًا لتقليل مسؤولية إدارة كلمات المرور والتوكنات، لكن لم يتم فرضه لأن النظام الحالي JWT ويحتوي Business Logic مرتبطًا به، ولأن المطلوب كان عدم تغيير نظام الدخول دون سبب.
