"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowRight,
  CheckCircle,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronUp,
  BookOpen,
  PlayCircle,
  Calendar,
} from "lucide-react";
import { coursesAPI, examsAPI } from "@/lib/api";
import { ImageUploader } from "@/components/media/ImageUploader";

// ====== Types ======

interface Course {
  id: string;
  title: string;
  grade?: string;
}
interface Lecture {
  id: string;
  title: string;
  order: number;
}
interface Unit {
  id: string;
  title: string;
  order: number;
  lectures: Lecture[];
}
interface Choice {
  text: string;
  is_correct: boolean;
}
interface Question {
  id: string;
  text: string;
  question_type: "mcq" | "essay";
  choices: Choice[];
  points: number;
  collapsed: boolean;
  imageUrl?: string | null;
  imagePath?: string | null;
}
type ExamScope = "course" | "lecture";

// ====== Helpers ======

const makeId = () => Math.random().toString(36).slice(2, 9);

const emptyMCQ = (): Question => ({
  id: makeId(),
  text: "",
  question_type: "mcq",
  points: 1,
  collapsed: false,
  choices: [
    { text: "", is_correct: true },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ],
});

const emptyEssay = (): Question => ({
  id: makeId(),
  text: "",
  question_type: "essay",
  points: 2,
  collapsed: false,
  choices: [],
});

// ====== Component ======

function NewExamPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [examScope, setExamScope] = useState<ExamScope>("course");
  const [lectureId, setLectureId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [duration, setDuration] = useState(30);
  const [passScore, setPassScore] = useState(50);
  const [showResult, setShowResult] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([emptyMCQ()]);

  const [useSchedule, setUseSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [useCloseTime, setUseCloseTime] = useState(false);
  const [closeDate, setCloseDate] = useState("");
  const [closeTime, setCloseTime] = useState("");

  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingLectures, setLoadingLectures] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    coursesAPI
      .getAll()
      .then((d: any) => setCourses(d))
      .catch(() => {})
      .finally(() => setLoadingCourses(false));
  }, []);

  // قرأ الـ params من الـ URL لو جاي من صفحة الكورس
  useEffect(() => {
    const cId = searchParams.get("course_id");
    const uId = searchParams.get("unit_id");
    if (cId) setCourseId(cId);
    if (uId) {
      setUnitId(uId);
      setExamScope("unit" as ExamScope);
    }
  }, []);

  useEffect(() => {
    if (!courseId) {
      setUnits([]);
      setLectureId("");
      return;
    }
    setLoadingLectures(true);
    setLectureId("");
    coursesAPI
      .getOne(courseId)
      .then((d: any) => setUnits(d.units || []))
      .catch(() => setUnits([]))
      .finally(() => setLoadingLectures(false));
  }, [courseId]);

  useEffect(() => {
    if (examScope === "course") setLectureId("");
  }, [examScope]);

  // ====== Question handlers ======

  const addQ = (type: "mcq" | "essay") =>
    setQuestions((p) => [...p, type === "mcq" ? emptyMCQ() : emptyEssay()]);

  const removeQ = (id: string) =>
    setQuestions((p) => p.filter((q) => q.id !== id));

  const updateQ = (id: string, patch: Partial<Question>) =>
    setQuestions((p) => p.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const updateChoice = (qId: string, idx: number, text: string) =>
    setQuestions((p) =>
      p.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          choices: q.choices.map((c, i) => (i === idx ? { ...c, text } : c)),
        };
      }),
    );

  const setCorrect = (qId: string, idx: number) =>
    setQuestions((p) =>
      p.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          choices: q.choices.map((c, i) => ({ ...c, is_correct: i === idx })),
        };
      }),
    );

  // ====== Validate + Submit ======

  const validate = (): string | null => {
    if (!title.trim()) return "اسم الاختبار مطلوب";
    if (!courseId) return "لازم تختار الكورس";
    if (examScope === "lecture" && !lectureId) return "لازم تختار المحاضرة";
    if (useSchedule && (!scheduleDate || !scheduleTime))
      return "حدد التاريخ والوقت للجدولة";
    if (useCloseTime && (!closeDate || !closeTime))
      return "حدد التاريخ والوقت لإغلاق الاختبار";
    if (
      useSchedule &&
      useCloseTime &&
      scheduleDate &&
      scheduleTime &&
      closeDate &&
      closeTime &&
      new Date(`${closeDate}T${closeTime}:00`) <=
        new Date(`${scheduleDate}T${scheduleTime}:00`)
    )
      return "وقت الإغلاق لازم يكون بعد وقت البداية";
    if (questions.length === 0) return "لازم يكون في سؤال واحد على الأقل";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim() && !q.imageUrl) return `السؤال ${i + 1}: لازم نص أو صورة`;
      if (q.question_type === "mcq") {
        if (q.choices.filter((c) => c.text.trim()).length < 2)
          return `السؤال ${i + 1}: لازم يكون في إجابتين على الأقل`;
        if (!q.choices.some((c) => c.is_correct && c.text.trim()))
          return `السؤال ${i + 1}: محددتش الإجابة الصح`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setIsSubmitting(true);
    setError("");
    const scheduled_at =
      useSchedule && scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
        : null;
    const available_until =
      useCloseTime && closeDate && closeTime
        ? new Date(`${closeDate}T${closeTime}:00`).toISOString()
        : null;

    try {
      await examsAPI.create({
        title: title.trim(),
        course_id: courseId,
        lecture_id: examScope === "lecture" ? lectureId : undefined,
        unit_id: unitId || undefined,
        duration_minutes: duration,
        pass_score: passScore,
        show_result_immediately: showResult,
        scheduled_at,
        available_until,
        questions: questions.map((q) => ({
          text: q.text.trim(),
          question_type: q.question_type,
          points: q.points,
          image_url: q.imageUrl || undefined,
          image_path: q.imagePath || undefined,
          choices:
            q.question_type === "mcq"
              ? q.choices
                  .filter((c) => c.text.trim())
                  .map((c) => ({
                    text: c.text.trim(),
                    is_correct: c.is_correct,
                  }))
              : [],
          correct_answer: null,
        })),
      });
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/admin/exams"), 1500);
    } catch (e: any) {
      setError(e.message || "حصل خطأ — حاول تاني");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ====== Derived ======

  const allLectures = units.flatMap((u) =>
    u.lectures.map((l) => ({ ...l, unitTitle: u.title })),
  );
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  // ====== Success ======

  if (success)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-2xl font-extrabold text-foreground">
          تم إنشاء الاختبار!
        </h2>
        <p className="text-muted-foreground">بيتم التحويل...</p>
      </div>
    );

  // ====== Render ======

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            اختبار جديد
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {questions.length} سؤال
          </p>
        </div>
      </div>

      {/* بيانات الاختبار */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">بيانات الاختبار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>اسم الاختبار *</Label>
            <Input
              placeholder="مثال: اختبار الفصل الأول"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>الكورس *</Label>
            <Select
              value={courseId}
              onValueChange={setCourseId}
              disabled={loadingCourses}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingCourses ? "جاري التحميل..." : "اختر الكورس"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* الاختبار تابع لإيه */}
          {courseId && (
            <div className="space-y-3">
              <Label>الاختبار تابع لـ</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["course", "lecture"] as ExamScope[]).map((scope) => {
                  const active = examScope === scope;
                  const Icon = scope === "course" ? BookOpen : PlayCircle;
                  const label =
                    scope === "course" ? "الكورس كله" : "محاضرة معينة";
                  const sub =
                    scope === "course" ? "اختبار عام" : "اختبار بعد المحاضرة";
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setExamScope(scope)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-right ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p
                          className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}
                        >
                          {label}
                        </p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* اختيار المحاضرة */}
              {examScope === "lecture" && (
                <div className="space-y-2">
                  <Label>اختر المحاضرة *</Label>
                  {loadingLectures ? (
                    <div className="h-10 bg-loading/35 animate-pulse rounded-lg" />
                  ) : allLectures.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                      مفيش محاضرات في الكورس ده لسه
                    </p>
                  ) : (
                    <Select value={lectureId} onValueChange={setLectureId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المحاضرة" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <div key={unit.id}>
                            <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground border-b">
                              {unit.title}
                            </div>
                            {unit.lectures.map((lec) => (
                              <SelectItem key={lec.id} value={lec.id}>
                                {lec.order}. {lec.title}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>المدة (دقيقة)</Label>
              <Input
                type="number"
                min={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>درجة النجاح (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowResult((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${showResult ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showResult ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
            <Label
              className="cursor-pointer"
              onClick={() => setShowResult((v) => !v)}
            >
              السماح للطلاب بمراجعة إجاباتهم بعد التسليم
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* الجدولة */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              جدولة الاختبار
            </CardTitle>
            <button
              type="button"
              onClick={() => setUseSchedule((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${useSchedule ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${useSchedule ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </CardHeader>
        {useSchedule ? (
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-muted-foreground">
              الاختبار مش هيظهر للطلاب غير بعد الوقت ده
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>الوقت</Label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
            {scheduleDate && scheduleTime && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary font-medium">
                الاختبار هينزل:{" "}
                {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString(
                  "ar-EG",
                  { dateStyle: "full", timeStyle: "short" },
                )}
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              الاختبار هينزل فوراً بعد النشر — فعّل الجدولة لو عاوز تحدد وقت
              معين
            </p>
          </CardContent>
        )}
      </Card>

      {/* وقت الإغلاق */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              إغلاق الاختبار
            </CardTitle>
            <button
              type="button"
              onClick={() => setUseCloseTime((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${useCloseTime ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${useCloseTime ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </CardHeader>
        {useCloseTime ? (
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-muted-foreground">
              الطالب مش هيقدر يبدأ الاختبار بعد الوقت ده
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>الوقت</Label>
                <Input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </div>
            {closeDate && closeTime && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary font-medium">
                الاختبار هيقفل:{" "}
                {new Date(`${closeDate}T${closeTime}`).toLocaleString(
                  "ar-EG",
                  { dateStyle: "full", timeStyle: "short" },
                )}
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              الاختبار هيفضل متاح للطلاب من غير موعد إغلاق — فعّل الخاصية دي
              لو عاوز تحدد آخر وقت للدخول
            </p>
          </CardContent>
        )}
      </Card>

      {/* الأسئلة */}
      <div className="space-y-3">
        {questions.map((q, idx) => (
          <Card key={q.id} className={q.collapsed ? "opacity-80" : ""}>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        q.question_type === "mcq"
                          ? "bg-primary/10 text-primary"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      }`}
                    >
                      {q.question_type === "mcq" ? "اختياري" : "مقالي"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      سؤال {idx + 1}
                    </span>
                  </div>
                  <Textarea
                    placeholder="اكتب نص السؤال هنا... (اختياري لو هترفع صورة السؤال)"
                    value={q.text}
                    onChange={(e) => updateQ(q.id, { text: e.target.value })}
                    rows={q.collapsed ? 1 : 2}
                    className="resize-none text-sm"
                  />
                  {!q.collapsed && (
                    <div className="mt-2">
                      <ImageUploader
                        category="exam_question"
                        value={q.imageUrl}
                        valuePath={q.imagePath}
                        label="ارفع صورة السؤال (بدل الكتابة)"
                        onChange={(result) =>
                          updateQ(q.id, {
                            imageUrl: result?.url ?? null,
                            imagePath: result?.path ?? null,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQ(q.id, { collapsed: !q.collapsed })}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                  >
                    {q.collapsed ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => removeQ(q.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                    disabled={questions.length === 1}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>

              {!q.collapsed && (
                <>
                  {q.question_type === "mcq" && (
                    <div className="space-y-2 pr-6">
                      <Label className="text-xs text-muted-foreground">
                        الإجابات — اضغط على الدايرة لتحديد الصح
                      </Label>
                      {q.choices.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCorrect(q.id, i)}
                            className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
                              c.is_correct
                                ? "border-green-500 bg-green-500"
                                : "border-muted-foreground/40 hover:border-primary"
                            }`}
                          >
                            {c.is_correct && (
                              <span className="block w-2 h-2 bg-white rounded-full mx-auto" />
                            )}
                          </button>
                          <Input
                            placeholder={`الإجابة ${i + 1}`}
                            value={c.text}
                            onChange={(e) =>
                              updateChoice(q.id, i, e.target.value)
                            }
                            className="text-sm h-9"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === "essay" && (
                    <div className="pr-6">
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                        سؤال مقالي — الطالب هيكتب إجابة نصية، والمدرس بيصحح
                        يدوياً.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pr-6">
                    <Label className="text-xs text-muted-foreground shrink-0">
                      الدرجة:
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={q.points}
                      onChange={(e) =>
                        updateQ(q.id, { points: Number(e.target.value) })
                      }
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Question */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 border-dashed"
          onClick={() => addQ("mcq")}
        >
          <Plus className="w-4 h-4 ml-2" />
          سؤال اختياري
        </Button>
        <Button
          variant="outline"
          className="flex-1 border-dashed"
          onClick={() => addQ("essay")}
        >
          <FileText className="w-4 h-4 ml-2" />
          سؤال مقالي
        </Button>
      </div>

      {/* Summary */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">إجمالي الأسئلة</span>
            <span className="font-bold">{questions.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">إجمالي الدرجات</span>
            <span className="font-bold">{totalPoints}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">درجة النجاح</span>
            <span className="font-bold text-green-600">
              {Math.ceil((totalPoints * passScore) / 100)} / {totalPoints}
            </span>
          </div>
          {examScope === "lecture" && lectureId && (
            <div className="flex justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">تابع لمحاضرة</span>
              <span className="font-bold text-primary text-xs truncate max-w-[60%]">
                {allLectures.find((l) => l.id === lectureId)?.title || "—"}
              </span>
            </div>
          )}
          {useSchedule && scheduleDate && scheduleTime && (
            <div className="flex justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">موعد النزول</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString(
                  "ar-EG",
                  { dateStyle: "medium", timeStyle: "short" },
                )}
              </span>
            </div>
          )}
          {useCloseTime && closeDate && closeTime && (
            <div className="flex justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">موعد الإغلاق</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                {new Date(`${closeDate}T${closeTime}`).toLocaleString(
                  "ar-EG",
                  { dateStyle: "medium", timeStyle: "short" },
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <Button
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6 text-base"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? "جاري النشر..." : "نشر الاختبار"}
      </Button>
    </div>
  );
}

export default function NewExamPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <div className="h-8 w-48 bg-loading/35 rounded animate-pulse" />
          <div className="h-40 bg-loading/35 rounded-xl animate-pulse" />
        </div>
      }
    >
      <NewExamPageContent />
    </Suspense>
  );
}
