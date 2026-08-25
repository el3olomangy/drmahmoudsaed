"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Plus,
  Trash2,
  CheckCircle,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";
import { examsAPI } from "@/lib/api";
import { ImageUploader } from "@/components/media/ImageUploader";

// ====== Types ======
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

// ====== Inner Component ======
function EditExamInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // بيانات الاختبار
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [passScore, setPassScore] = useState(50);
  const [showResult, setShowResult] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([emptyMCQ()]);

  // الجدولة
  const [useSchedule, setUseSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [useCloseTime, setUseCloseTime] = useState(false);
  const [closeDate, setCloseDate] = useState("");
  const [closeTime, setCloseTime] = useState("");

  // جيب بيانات الاختبار الحالية
  useEffect(() => {
    if (!examId) {
      setError("مفيش ID للاختبار");
      setLoading(false);
      return;
    }
    examsAPI
      .getExamForAdmin(examId)
      .then((data: any) => {
        setTitle(data.title);
        setDuration(data.duration_minutes);
        setPassScore(data.pass_score);
        setShowResult(data.show_result_immediately);

        // الجدولة
        if (data.scheduled_at) {
          setUseSchedule(true);
          const d = new Date(data.scheduled_at);
          setScheduleDate(d.toISOString().split("T")[0]);
          setScheduleTime(d.toTimeString().slice(0, 5));
        }
        if (data.available_until) {
          setUseCloseTime(true);
          const d2 = new Date(data.available_until);
          setCloseDate(d2.toISOString().split("T")[0]);
          setCloseTime(d2.toTimeString().slice(0, 5));
        }

        // الأسئلة
        const qs: Question[] = data.questions.map((q: any) => ({
          id: q.id || makeId(),
          text: q.text,
          question_type: q.question_type,
          points: q.points,
          collapsed: false,
          imageUrl: q.image_url ?? null,
          imagePath: q.image_path ?? null,
          choices:
            q.question_type === "mcq"
              ? q.choices.map((c: any) => ({
                  text: c.text,
                  is_correct: c.is_correct,
                }))
              : [],
        }));
        setQuestions(qs.length > 0 ? qs : [emptyMCQ()]);
      })
      .catch((e: any) => setError(e.message || "حصل خطأ في تحميل الاختبار"))
      .finally(() => setLoading(false));
  }, [examId]);

  // ====== Question Handlers ======
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

  // ====== Validate ======
  const validate = (): string | null => {
    if (!title.trim()) return "اسم الاختبار مطلوب";
    if (questions.length === 0) return "لازم يكون في سؤال واحد على الأقل";
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

  // ====== Save ======
  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError("");

    let scheduled_at: string | null = null;
    if (useSchedule && scheduleDate && scheduleTime) {
      scheduled_at = new Date(
        `${scheduleDate}T${scheduleTime}:00`,
      ).toISOString();
    } else {
      scheduled_at = ""; // إشارة لمسح الجدولة
    }

    let available_until: string | null = null;
    if (useCloseTime && closeDate && closeTime) {
      available_until = new Date(
        `${closeDate}T${closeTime}:00`,
      ).toISOString();
    } else {
      available_until = ""; // إشارة لمسح وقت الإغلاق
    }

    const payload = {
      title: title.trim(),
      duration_minutes: duration,
      pass_score: passScore,
      show_result_immediately: showResult,
      scheduled_at,
      available_until,
      questions: questions.map((q) => ({
        text: q.text.trim(),
        question_type: q.question_type,
        points: q.points,
        image_url: q.imageUrl || null,
        image_path: q.imagePath || null,
        choices:
          q.question_type === "mcq"
            ? q.choices
                .filter((c) => c.text.trim())
                .map((c) => ({ text: c.text.trim(), is_correct: c.is_correct }))
            : [],
        correct_answer: null,
      })),
    };

    try {
      const res: any = await examsAPI.fullUpdateExam(examId!, payload);
      // لو في نتايج اتمسحت — وضّح للمدرس
      if (res.deleted_results > 0) {
        alert(
          `تم الحفظ بنجاح.\nتم مسح ${res.deleted_results} نتيجة للطلاب لأن الأسئلة اتغيرت — الطلاب هيحتاجوا يعيدوا الاختبار.`,
        );
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/admin/exams"), 1500);
    } catch (e: any) {
      setError(e.message || "حصل خطأ");
    } finally {
      setSaving(false);
    }
  };

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  // ====== States ======
  if (!examId)
    return (
      <div className="text-center py-16 text-muted-foreground">
        مفيش ID للاختبار
      </div>
    );

  if (loading)
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );

  if (success)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-2xl font-extrabold text-foreground">
          تم حفظ التعديلات!
        </h2>
        <p className="text-muted-foreground">بيتم التحويل...</p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            تعديل الاختبار
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
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

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
        {useSchedule && (
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
        )}
        {!useSchedule && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              الاختبار متاح الآن — فعّل الجدولة لو عاوز تحدد وقت معين
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
        {useCloseTime && (
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
        )}
        {!useCloseTime && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              الاختبار هيفضل متاح من غير موعد إغلاق — فعّل الخاصية دي لو عاوز
              تحدد آخر وقت للدخول
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
                  {/* تغيير النوع */}
                  <Select
                    value={q.question_type}
                    onValueChange={(v) =>
                      updateQ(q.id, {
                        question_type: v as "mcq" | "essay",
                        choices:
                          v === "mcq"
                            ? [
                                { text: "", is_correct: true },
                                { text: "", is_correct: false },
                                { text: "", is_correct: false },
                                { text: "", is_correct: false },
                              ]
                            : [],
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">اختياري</SelectItem>
                      <SelectItem value="essay">مقالي</SelectItem>
                    </SelectContent>
                  </Select>
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
                            className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${c.is_correct ? "border-green-500 bg-green-500" : "border-muted-foreground/40 hover:border-primary"}`}
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

      {/* إضافة سؤال */}
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

      {/* ملخص */}
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
          {useSchedule && scheduleDate && scheduleTime && (
            <div className="flex justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">موعد النزول</span>
              <span className="font-bold text-primary text-xs">
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
              <span className="font-bold text-primary text-xs">
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
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
      </Button>
    </div>
  );
}

// ====== Export with Suspense ======
export default function EditExamPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto space-y-4 p-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <EditExamInner />
    </Suspense>
  );
}
