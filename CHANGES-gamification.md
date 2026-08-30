# إضافة: نظام Gamification (XP + Levels + Leaderboard) — خفيف ومربوط بإنجاز حقيقي

الملفات دي بتتحط فوق نفس مساراتها في المشروع (extract over). كله إضافات — مفيش أي حاجة شغّالة اتغيّرت سلوكها.

## القرارات المتفق عليها
- **البداية من صفر** (من غير backfill): الطلاب الحاليين بيبدأوا 0 XP، والـ XP بيتحسب من النشاط الجديد بس.
- **الـ Final Exam = أي امتحان مش مربوط بمحاضرة** (بدون `lecture_id`). أي امتحان مربوط بمحاضرة = كويز.
- **الـ Leaderboard**: عام على مستوى المنصة + فلترة اختيارية بالصف.

## اللي اتعمل

### الباك إند
- **ملف مركزي واحد** `backend/app/core/gamification.py` فيه:
  - جدول الـ 6 ليفلات + XP كل نشاط (كله قابل للتعديل من مكان واحد — `LEVELS` و `XP` و `FINAL_TIERS`).
  - `compute_level(total_xp)` — بيحسب الـ Level والـ Title والتقدّم داخل الـ Level (نسبة الشريط محسوبة من بداية الـ Level الحالي مش من صفر).
  - `award_xp` (إضافة مرة واحدة بـ reference فريد) و `award_or_topup_xp` (بتزوّد الفرق بس لو الدرجة زادت بعد تصحيح المقالي — الطالب ميخسرش XP أبدًا).
  - `maybe_award_unit_completion` — بونس +25 لما كل محاضرات الـ Unit تتشاف وكل واجباته وكويزاته تتسلّم (مرة واحدة).
- **نقاط الربط** (كلها ملفوفة في try/except فمستحيل تكسر أي وظيفة موجودة):
  - `progress.py` → +5 عند إكمال المحاضرة لأول مرة (نفس شرط `watched` الموجود).
  - `exams.py` `_store_exam_result` → كويز (20 max) أو Final (60 max) + top-up بعد تصحيح المقالي.
  - `homework.py` `_store_homework_result` → واجب (20 max) + top-up بعد التصحيح.
  - إكمال الـ Unit بيتفحص تلقائيًا بعد أي إنجاز مرتبط بالـ Unit.
- **راوتس جديدة** `backend/app/api/routes/gamification.py`:
  - `GET /gamification/me` — بروفايل الطالب (Level/Title/XP/التقدّم + حالة الظهور).
  - `GET /gamification/me/course/{id}` — XP الطالب في كورس معيّن.
  - `PATCH /gamification/me/visibility` — تحكّم الطالب في ظهوره في الترتيب.
  - `GET /gamification/leaderboard?grade=&limit=` — **عامة** (تشتغل من غير تسجيل دخول)، بترجّع بيانات عامة بس (اسم/صورة/صف/Level/XP) وبتحترم خصوصية الطالب.
  - `GET /gamification/levels` — جدول الليفلات.
- `users.py` → `user_helper` بقى بيرجّع `total_xp` و `leaderboard_visible`.
- `main.py` → تسجيل الراوتر.
- `firebase-database-rules.json` → فهرسة `xp_events` و `total_xp`.

### الفرونت إند
- `lib/api.ts` → `gamificationAPI` (getMe / getMyCourseXp / setVisibility / getLeaderboard / getLevels).
- `components/gamification-card.tsx` → كارت الـ Gamification في البروفايل: Level، Title، XP، شريط تقدّم، الباقي للـ Level الجاي، وToggle "إظهار حسابي في ترتيب الطلاب".
- `app/(student)/dashboard/profile/page.tsx` → الكارت اتحط فوق الصفحة.
- `components/leaderboard-section.tsx` → قسم "أشطر الطلاب" في الصفحة الرئيسية مع فلتر بالصف وأفاتار افتراضي حسب النوع.
- `app/page.tsx` → القسم اتضاف للهوم.

## الأفاتار الافتراضي
لو الطالب مرفعش صورة، الـ API بيرجّع `default_avatar` = male/female حسب `gender`، والواجهة بتعرض دائرة بالحروف الأولى بلون مناسب. لو حابب صور أفاتار جاهزة بدل الحروف، سيبها ليّا.

## ملاحظات
- **مفيش migration**: الطلاب من غير `total_xp` بيتعاملوا كـ 0، والعدّاد بيتزوّد ذرّيًا (Firebase transaction).
- الطالب من غير XP مش بيظهر في الـ Leaderboard (عشان مايبقاش مليان أصفار).
- **الـ Level Up notification**: الـ backend بيرجّع `xp: { leveled_up, new_level, new_title }` في رد حفظ موقف الفيديو وتسليم الامتحان/الواجب. توصيل التوست الخفيف في صفحات المشاهدة/الامتحان خطوة بسيطة جاية لو حابب.
- **أداء الـ Leaderboard**: بيجيب الطلاب (role=student مفهرس) ويرتّب في الذاكرة — مناسب للأحجام العادية. لو الأعداد كبرت جدًا ممكن نضيف كاش/قايمة محسوبة مسبقًا لاحقًا.
