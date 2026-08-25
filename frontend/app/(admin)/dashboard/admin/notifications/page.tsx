"use client";

import { useEffect, useState } from "react";
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
  Bell,
  Send,
  Users,
  GraduationCap,
  User,
  CheckCircle,
  BookOpen,
  FileCheck,
  KeyRound,
  Megaphone,
} from "lucide-react";
import { notificationsAPI, usersAPI } from "@/lib/api";

// ====== Types ======
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade?: string;
}

const grades = [
  { value: "first_preparatory", label: "أولى إعدادي" },
  { value: "second_preparatory", label: "ثانية إعدادي" },
  { value: "third_preparatory", label: "ثالثة إعدادي" },
  { value: "first_secondary", label: "أولى ثانوي" },
  { value: "second_secondary", label: "ثانية ثانوي" },
  { value: "third_secondary", label: "ثالثة ثانوي" },
];

const notifTypes = [
  { value: "announcement", label: "إعلان عام", icon: Megaphone },
  { value: "new_course", label: "كورس جديد", icon: BookOpen },
  { value: "new_lecture", label: "محاضرة جديدة", icon: BookOpen },
  { value: "new_homework", label: "واجب جديد", icon: FileCheck },
  { value: "new_assignment", label: "واجب جديد", icon: FileCheck },
  { value: "new_exam", label: "اختبار جديد", icon: FileCheck },
  { value: "exam_result", label: "نتيجة اختبار", icon: CheckCircle },
  { value: "assignment_missed", label: "تنبيه فوات موعد تسليم", icon: KeyRound },
  { value: "exam_missed", label: "تنبيه فوات موعد اختبار", icon: KeyRound },
  { value: "subscription_expiry", label: "تنبيه اشتراك", icon: KeyRound },
];

const targetTypes = [
  { value: "all", label: "كل الطلاب", icon: Users },
  { value: "grade", label: "مرحلة دراسية", icon: GraduationCap },
  { value: "student", label: "طالب بعينه", icon: User },
];

// ====== Component ======
export default function AdminNotificationsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notifType, setNotifType] = useState("announcement");
  const [targetType, setTargetType] = useState("all");
  const [targetGrade, setTargetGrade] = useState("");
  const [targetStudent, setTargetStudent] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Submit state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    usersAPI
      .getAll()
      .then((d: any) => setStudents(d))
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  const filteredStudents = students.filter(
    (s) =>
      studentSearch.trim() === "" ||
      `${s.first_name} ${s.last_name}`.includes(studentSearch) ||
      s.first_name.includes(studentSearch) ||
      s.last_name.includes(studentSearch),
  );

  const validate = (): string | null => {
    if (!title.trim()) return "العنوان مطلوب";
    if (!body.trim()) return "نص الإشعار مطلوب";
    if (targetType === "grade" && !targetGrade) return "اختر المرحلة الدراسية";
    if (targetType === "student" && !targetStudent) return "اختر الطالب";
    return null;
  };

  const handleSend = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setSending(true);
    setError("");
    setSuccess(false);

    const payload: any = {
      title: title.trim(),
      body: body.trim(),
      notification_type: notifType,
      target_grade: null,
      target_user_id: null,
    };

    if (targetType === "grade") payload.target_grade = targetGrade;
    if (targetType === "student") payload.target_user_id = targetStudent;

    try {
      await notificationsAPI.send(payload);
      setSuccess(true);
      setTitle("");
      setBody("");
      setTargetType("all");
      setTargetGrade("");
      setTargetStudent("");
      setStudentSearch("");
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: any) {
      setError(e.message || "حصل خطأ في الإرسال");
    } finally {
      setSending(false);
    }
  };

  const selectedStudent = students.find((s) => s.id === targetStudent);

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">الإشعارات</h1>
        <p className="text-muted-foreground mt-1">أرسل إشعار للطلاب</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            إشعار جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* النوع */}
          <div className="space-y-2">
            <Label>نوع الإشعار</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {notifTypes.map((t) => {
                const Icon = t.icon;
                const active = notifType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setNotifType(t.value)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-colors text-center ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`text-xs font-medium leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* المُرسَل إليه */}
          <div className="space-y-2">
            <Label>المُرسَل إليه</Label>
            <div className="grid grid-cols-3 gap-2">
              {targetTypes.map((t) => {
                const Icon = t.icon;
                const active = targetType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setTargetType(t.value);
                      setTargetGrade("");
                      setTargetStudent("");
                      setStudentSearch("");
                    }}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* اختيار المرحلة */}
            {targetType === "grade" && (
              <Select value={targetGrade} onValueChange={setTargetGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المرحلة الدراسية" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* اختيار الطالب */}
            {targetType === "student" && (
              <div className="space-y-2">
                <Input
                  placeholder="ابحث باسم الطالب..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                {loadingStudents ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                    {filteredStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        مفيش نتايج
                      </p>
                    ) : (
                      filteredStudents.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setTargetStudent(s.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-right transition-colors ${
                            targetStudent === s.id
                              ? "bg-primary/10"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div>
                            <p
                              className={`text-sm font-medium ${targetStudent === s.id ? "text-primary" : "text-foreground"}`}
                            >
                              {s.first_name} {s.last_name}
                            </p>
                            {s.grade && (
                              <p className="text-xs text-muted-foreground">
                                {grades.find((g) => g.value === s.grade)
                                  ?.label || s.grade}
                              </p>
                            )}
                          </div>
                          {targetStudent === s.id && (
                            <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {selectedStudent && (
                  <p className="text-xs text-primary font-medium bg-primary/5 px-3 py-2 rounded-lg">
                    تم اختيار: {selectedStudent.first_name}{" "}
                    {selectedStudent.last_name}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* العنوان */}
          <div className="space-y-2">
            <Label>عنوان الإشعار *</Label>
            <Input
              placeholder="مثال: محاضرة جديدة في الكيمياء العضوية"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* النص */}
          <div className="space-y-2">
            <Label>نص الإشعار *</Label>
            <Textarea
              placeholder="اكتب تفاصيل الإشعار هنا..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-left">
              {body.length} حرف
            </p>
          </div>

          {/* ملخص */}
          <div className="p-3 bg-muted/40 rounded-xl text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">سيُرسَل إلى</span>
              <span className="font-bold text-foreground">
                {targetType === "all" && "كل الطلاب"}
                {targetType === "grade" &&
                  (targetGrade
                    ? grades.find((g) => g.value === targetGrade)?.label
                    : "—")}
                {targetType === "student" &&
                  (selectedStudent
                    ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                    : "—")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">النوع</span>
              <span className="font-bold text-foreground">
                {notifTypes.find((t) => t.value === notifType)?.label}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </p>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="w-4 h-4 shrink-0" />
              تم إرسال الإشعار بنجاح!
            </div>
          )}

          {/* Send Button */}
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? (
              "جاري الإرسال..."
            ) : (
              <>
                <Send className="w-4 h-4 ml-2" />
                إرسال الإشعار
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}