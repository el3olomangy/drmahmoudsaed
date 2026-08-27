"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  ArrowRight,
  User,
  BookOpen,
  GraduationCap,
  MapPin,
  PlayCircle,
  FileCheck,
  TrendingUp,
  CheckCircle,
  XCircle,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Award,
  Clock,
  AlertCircle,
  Users,
  ChevronLeft,
} from "lucide-react";
import { useTheme } from "next-themes";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

const gradeLabels: Record<string, string> = {
  first_preparatory: "الصف الأول الإعدادي",
  second_preparatory: "الصف الثاني الإعدادي",
  third_preparatory: "الصف الثالث الإعدادي",
  first_secondary: "الصف الأول الثانوي",
  second_secondary: "الصف الثاني الثانوي",
  third_secondary: "الصف الثالث الثانوي",
};

interface LectureData {
  id: string;
  title: string;
  order: number;
  watched: boolean;
  last_position: number;
  duration: number;
}
interface UnitData {
  id: string;
  title: string;
  order: number;
  lectures: LectureData[];
}
interface ExamResult {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  submitted_at: string | null;
}
interface ExamData {
  id: string;
  title: string;
  is_homework: boolean;
  total_points: number;
  result: ExamResult | null;
}
interface AssignmentResult {
  grade: number | null;
  teacher_note: string | null;
  submitted_at: string | null;
}
interface AssignmentData {
  id: string;
  title: string;
  result: AssignmentResult | null;
}
interface CourseProgress {
  course_id: string;
  course_title: string;
  watched: number;
  total_lectures: number;
  percentage: number;
  units: UnitData[];
  exams: ExamData[];
  assignments: AssignmentData[];
  exam_stats: { taken: number; passed: number };
}
interface StudentData {
  id: string;
  first_name: string;
  last_name: string;
  grade?: string;
  governorate?: string;
  courses_progress: CourseProgress[];
}

function formatTime(seconds: number) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ====== ThemeToggle ======
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return <div className="w-9 h-9" />;
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-xl hover:bg-muted transition-colors"
      title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-amber-500" />
      ) : (
        <Moon className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? "#22c55e" : value >= 40 ? "#f59e0b" : "#3b82f6";
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

// ====== Student Selector ======
function StudentSelector({
  students,
  onSelect,
}: {
  students: StudentData[];
  onSelect: (s: StudentData) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-base">اختار ابنك / بنتك</h2>
      </div>
      {students.map((s) => {
        const totalWatched = s.courses_progress.reduce(
          (acc, c) => acc + c.watched,
          0,
        );
        const totalLectures = s.courses_progress.reduce(
          (acc, c) => acc + c.total_lectures,
          0,
        );
        const totalPassed = s.courses_progress.reduce(
          (acc, c) => acc + c.exam_stats.passed,
          0,
        );
        const totalExams = s.courses_progress.reduce(
          (acc, c) => acc + c.exam_stats.taken,
          0,
        );
        const avgPercent =
          s.courses_progress.length > 0
            ? Math.round(
                s.courses_progress.reduce((acc, c) => acc + c.percentage, 0) /
                  s.courses_progress.length,
              )
            : 0;

        return (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="w-full text-right"
          >
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground">
                      {s.first_name} {s.last_name}
                    </p>
                    {s.grade && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {gradeLabels[s.grade] || s.grade}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <PlayCircle className="w-3 h-3" />
                        {totalWatched}/{totalLectures} محاضرة
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileCheck className="w-3 h-3" />
                        {totalPassed}/{totalExams} اختبار
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {s.courses_progress.length} كورس
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={avgPercent} />
                      <span className="text-xs font-bold text-muted-foreground shrink-0">
                        {avgPercent}%
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

// ====== Course Card ======
function CourseCard({ course }: { course: CourseProgress }) {
  const [openSection, setOpenSection] = useState<
    "lectures" | "exams" | "assignments" | null
  >(null);
  const toggle = (s: "lectures" | "exams" | "assignments") =>
    setOpenSection((prev) => (prev === s ? null : s));

  const watchedCount = course.units
    .flatMap((u) => u.lectures)
    .filter((l) => l.watched).length;
  const totalCount = course.units.flatMap((u) => u.lectures).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{course.course_title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {watchedCount} / {totalCount} محاضرة اتشافت
            </p>
          </div>
          <span
            className={`text-lg font-extrabold ${
              course.percentage >= 80
                ? "text-green-500"
                : course.percentage >= 40
                  ? "text-amber-500"
                  : "text-blue-500"
            }`}
          >
            {course.percentage}%
          </span>
        </div>
        <ProgressBar value={course.percentage} />
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold">
              {course.exam_stats.passed}/{course.exam_stats.taken}
            </p>
            <p className="text-xs text-muted-foreground">اختبارات نجح</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold">
              {course.assignments.filter((a) => a.result !== null).length}/
              {course.assignments.length}
            </p>
            <p className="text-xs text-muted-foreground">واجبات سلّم</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold">
              {watchedCount}/{totalCount}
            </p>
            <p className="text-xs text-muted-foreground">محاضرات</p>
          </div>
        </div>

        {/* Lectures */}
        <button
          onClick={() => toggle("lectures")}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium"
        >
          <div className="flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" />
            <span>المحاضرات</span>
          </div>
          {openSection === "lectures" ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {openSection === "lectures" && (
          <div className="space-y-2 pt-1">
            {course.units.map((unit) => (
              <div key={unit.id}>
                <p className="text-xs font-bold text-muted-foreground px-1 mb-1">
                  {unit.title}
                </p>
                {unit.lectures.map((lec) => (
                  <div
                    key={lec.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border mb-1"
                  >
                    {lec.watched ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className="text-xs flex-1 text-foreground">
                      {lec.title}
                    </span>
                    {!lec.watched && lec.last_position > 0 && (
                      <span className="text-xs text-amber-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(lec.last_position)}
                      </span>
                    )}
                    {lec.watched && (
                      <span className="text-xs text-green-500">مكتملة</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Exams */}
        <button
          onClick={() => toggle("exams")}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium"
        >
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-chart-3" />
            <span>الاختبارات</span>
          </div>
          {openSection === "exams" ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {openSection === "exams" && (
          <div className="space-y-2 pt-1">
            {course.exams.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                مفيش اختبارات بعد
              </p>
            ) : (
              course.exams.map((exam) => (
                <div
                  key={exam.id}
                  className="p-3 rounded-lg bg-background border border-border space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {exam.is_homework ? (
                        <ClipboardList className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Award className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-xs font-medium">{exam.title}</span>
                    </div>
                    {exam.result ? (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          exam.result.passed
                            ? "bg-green-500/10 text-green-600"
                            : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {exam.result.passed ? "ناجح" : "راسب"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        لم يؤدِ
                      </span>
                    )}
                  </div>
                  {exam.result && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>الدرجة</span>
                        <span className="font-bold text-foreground">
                          {exam.result.score} / {exam.result.total}
                          <span className="text-muted-foreground mr-1">
                            ({exam.result.percentage}%)
                          </span>
                        </span>
                      </div>
                      <ProgressBar value={exam.result.percentage} />
                      {exam.result.submitted_at && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(exam.result.submitted_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Assignments */}
        {course.assignments.length > 0 && (
          <>
            <button
              onClick={() => toggle("assignments")}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                <span>الواجبات</span>
              </div>
              {openSection === "assignments" ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {openSection === "assignments" && (
              <div className="space-y-2 pt-1">
                {course.assignments.map((asgn) => (
                  <div
                    key={asgn.id}
                    className="p-3 rounded-lg bg-background border border-border space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{asgn.title}</span>
                      {asgn.result ? (
                        <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-bold">
                          سُلِّم
                        </span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          لم يسلّم
                        </span>
                      )}
                    </div>
                    {asgn.result && (
                      <div className="space-y-1">
                        {asgn.result.grade !== null ? (
                          <p className="text-xs">
                            الدرجة:{" "}
                            <span className="font-bold text-primary">
                              {asgn.result.grade}
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-amber-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            في انتظار التصحيح
                          </p>
                        )}
                        {asgn.result.teacher_note && (
                          <p className="text-xs text-muted-foreground border-r-2 border-primary/30 pr-2">
                            {asgn.result.teacher_note}
                          </p>
                        )}
                        {asgn.result.submitted_at && (
                          <p className="text-xs text-muted-foreground">
                            {formatDate(asgn.result.submitted_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ====== Student Detail View ======
function StudentDetail({
  student,
  onBack,
  multipleStudents,
}: {
  student: StudentData;
  onBack: () => void;
  multipleStudents: boolean;
}) {
  const totalWatched = student.courses_progress.reduce(
    (s, c) => s + c.watched,
    0,
  );
  const totalLectures = student.courses_progress.reduce(
    (s, c) => s + c.total_lectures,
    0,
  );
  const totalPassed = student.courses_progress.reduce(
    (s, c) => s + c.exam_stats.passed,
    0,
  );
  const totalExams = student.courses_progress.reduce(
    (s, c) => s + c.exam_stats.taken,
    0,
  );

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        onClick={onBack}
        className="flex items-center gap-2 -mb-1"
      >
        <ArrowRight className="w-4 h-4" />
        {multipleStudents ? "الرجوع لاختيار الطالب" : "بحث عن طالب آخر"}
      </Button>

      {/* Student info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-extrabold text-foreground">
                {student.first_name} {student.last_name}
              </h1>
              {student.grade && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <GraduationCap className="w-4 h-4" />
                  {gradeLabels[student.grade] || student.grade}
                </p>
              )}
              {student.governorate && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {student.governorate}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <BookOpen className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-extrabold">
              {student.courses_progress.length}
            </p>
            <p className="text-xs text-muted-foreground">كورس</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <PlayCircle className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-extrabold">
              {totalWatched}/{totalLectures}
            </p>
            <p className="text-xs text-muted-foreground">محاضرة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <FileCheck className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-extrabold">
              {totalPassed}/{totalExams}
            </p>
            <p className="text-xs text-muted-foreground">اختبار نجح</p>
          </CardContent>
        </Card>
      </div>

      {/* Courses */}
      <div className="space-y-4">
        <h2 className="font-bold text-base flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> تفاصيل الكورسات
        </h2>
        {student.courses_progress.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>مش مشترك في أي كورس لسه</p>
            </CardContent>
          </Card>
        ) : (
          student.courses_progress.map((course) => (
            <CourseCard key={course.course_id} course={course} />
          ))
        )}
      </div>
    </div>
  );
}

// ====== Main Page ======
export default function ParentTrackingPage() {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(
    null,
  );
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setIsLoading(true);
    setError("");
    setStudents([]);
    setSelectedStudent(null);
    try {
      const res = await fetch(`${BASE_URL}/progress/parent/${phone.trim()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "مفيش طالب مرتبط بالرقم ده");
      }
      const data = await res.json();
      setStudents(data.students);
      // لو طالب واحد بس — روّح عليه مباشرة
      if (data.students.length === 1) {
        setSelectedStudent(data.students[0]);
      }
    } catch (err: any) {
      setError(err.message || "حصل خطأ، حاول تاني");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStudents([]);
    setSelectedStudent(null);
    setPhone("");
    setError("");
  };

  const handleBack = () => {
    if (students.length > 1) {
      setSelectedStudent(null);
    } else {
      handleReset();
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-BuyHgoZLI0SWgDwWIvZe8lSxWIu1dX.png"
            alt="العلومنجي"
            width={140}
            height={50}
            className="h-10 w-auto"
            priority
          />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              العودة للرئيسية
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Search form */}
        {students.length === 0 && (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-extrabold">
                متابعة ولي الأمر
              </CardTitle>
              <CardDescription>
                أدخل رقم هاتفك المسجل لمتابعة بيانات أبناءك
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setError("");
                    }}
                    className="pr-10 text-left py-6"
                    dir="ltr"
                    required
                  />
                </div>
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full py-6 font-bold"
                  disabled={isLoading}
                >
                  {isLoading ? "جاري البحث..." : "عرض بيانات الطالب"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        )}

        {/* Student selector — لو أكتر من طالب */}
        {!isLoading && students.length > 1 && !selectedStudent && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={handleReset}
              className="flex items-center gap-2 -mb-1"
            >
              <ArrowRight className="w-4 h-4" />
              بحث برقم تاني
            </Button>
            <StudentSelector
              students={students}
              onSelect={setSelectedStudent}
            />
          </div>
        )}

        {/* Student detail */}
        {!isLoading && selectedStudent && (
          <StudentDetail
            student={selectedStudent}
            onBack={handleBack}
            multipleStudents={students.length > 1}
          />
        )}
      </main>
    </div>
  );
}
