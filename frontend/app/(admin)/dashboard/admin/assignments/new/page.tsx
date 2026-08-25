"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  GripVertical,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Calendar,
  FileText,
} from "lucide-react";
import { coursesAPI, homeworkAPI } from "@/lib/api";
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
  points: 1,
  collapsed: false,
  choices: [],
});

// ====== Component ======

export default function NewHomeworkPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [lectureId, setLectureId] = useState("");
  const [passScore, setPassScore] = useState(50);
  const [questions, setQuestions] = useState<Question[]>([emptyMCQ()]);

  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [useDeadline, setUseDeadline] = useState(false);
  const [useSchedule, setUseSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

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

  // ====== Question handlers ======

  const addQ = (type: "mcq" | "essay" = "mcq") =>
    setQuestions((p) => [...p, type === "essay" ? emptyEssay() : emptyMCQ()]);

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
    if (!title.trim()) return "اسم الواجب مطلوب";
    if (!courseId) return "لازم تختار الكورس";
    if (!lectureId) return "لازم تختار المحاضرة";
    if (useDeadline && (!deadlineDate || !deadlineTime))
      return "حدد التاريخ والوقت للموعد النهائي";
    if (useSchedule && (!scheduleDate || !scheduleTime))
      return "حدد التاريخ والوقت لبداية الواجب";
    if (
      useSchedule &&
      useDeadline &&
      scheduleDate &&
      scheduleTime &&
      deadlineDate &&
      deadlineTime &&
      new Date(`${deadlineDate}T${deadlineTime}:00`) <=
        new Date(`${scheduleDate}T${scheduleTime}:00`)
    )
      return "الموعد النهائي لازم يكون بعد وقت البداية";
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

    const deadline =
      useDeadline && deadlineDate && deadlineTime
        ? new Date(`${deadlineDate}T${deadlineTime}:00`).toISOString()
        : null;
    const scheduled_at =
      useSchedule && scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
        : null;

    try {
      await homeworkAPI.create({
        title: title.trim(),
        course_id: courseId,
        lecture_id: lectureId,
        pass_score: passScore,
        show_result_immediately: true,
        scheduled_at,
        deadline,
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
      setTimeout(() => router.push("/dashboard/admin/assignments"), 1500);
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
          تم إنشاء الواجب!
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
          <h1 className="text-2xl font-extrabold text-foreground">واجب جديد</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {questions.length} سؤال
          </p>
        </div>
      </div>

      {/* بيانات الواجب */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">بيانات الواجب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>اسم الواجب *</Label>
            <Input
              placeholder="مثال: واجب الفصل الأول"
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

          {/* المحاضرة */}
          {courseId && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-muted-foreground" />
                المحاضرة *
              </Label>
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
        </CardContent>
      </Card>

      {/* وقت البداية */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              وقت بداية الواجب
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
              الطلاب مش هيقدروا يفتحوا الواجب قبل الوقت ده
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
                الواجب هيفتح:{" "}
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
              الواجب هيكون متاح فورًا — فعّل الخاصية دي لو عاوز تحدد وقت بداية
              معين
            </p>
          </CardContent>
        )}
      </Card>

      {/* الموعد النهائي */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              الموعد النهائي للتسليم
            </CardTitle>
            <button
              type="button"
              onClick={() => setUseDeadline((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${useDeadline ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${useDeadline ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </CardHeader>
        {useDeadline ? (
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-muted-foreground">
              الطلاب مش هيقدروا يفتحوا أو يسلموا الواجب بعد الوقت ده
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>الوقت</Label>
                <Input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                />
              </div>
            </div>
            {deadlineDate && deadlineTime && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary font-medium">
                آخر موعد للتسليم:{" "}
                {new Date(`${deadlineDate}T${deadlineTime}`).toLocaleString(
                  "ar-EG",
                  { dateStyle: "full", timeStyle: "short" },
                )}
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              الواجب هيفضل متاح من غير موعد تسليم — فعّل الخاصية دي لو عاوز
              تحدد آخر موعد
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
                        category="homework_question"
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
                        سؤال مقالي — الطالب هيرفع صورة إجابته، والمدرس بيصحح
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
          {lectureId && (
            <div className="flex justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">تابع لمحاضرة</span>
              <span className="font-bold text-primary text-xs truncate max-w-[60%]">
                {allLectures.find((l) => l.id === lectureId)?.title || "—"}
              </span>
            </div>
          )}
          {scheduleDate && scheduleTime && (
            <div className="flex justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">وقت البداية</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString(
                  "ar-EG",
                  { dateStyle: "medium", timeStyle: "short" },
                )}
              </span>
            </div>
          )}
          {deadlineDate && deadlineTime && (
            <div className="flex justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">آخر موعد</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                {new Date(`${deadlineDate}T${deadlineTime}`).toLocaleString(
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
        {isSubmitting ? "جاري النشر..." : "نشر الواجب"}
      </Button>
    </div>
  );
}
