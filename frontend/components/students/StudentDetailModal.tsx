"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X,
  Phone,
  MapPin,
  GraduationCap,
  BookOpen,
  PlayCircle,
  FileCheck,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Download,
  Lock,
  Smartphone,
  LogOut,
  Trash2,
} from "lucide-react";
import { progressAPI } from "@/lib/api";

const gradeLabels: Record<string, string> = {
  first_preparatory: "أولى إعدادي",
  second_preparatory: "ثانية إعدادي",
  third_preparatory: "ثالثة إعدادي",
  first_secondary: "أولى ثانوي",
  second_secondary: "ثانية ثانوي",
  third_secondary: "ثالثة ثانوي",
};

interface LectureDetail {
  id: string;
  title: string;
  order: number;
  watched: boolean;
  last_position: number;
  duration: number;
}

interface UnitDetail {
  id: string;
  title: string;
  order: number;
  lectures: LectureDetail[];
}

interface ExamResult {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  submitted_at?: string;
}

interface ExamDetail {
  id: string;
  title: string;
  is_homework: boolean;
  total_points: number;
  result: ExamResult | null;
}

interface AssignmentResult {
  grade?: number | null;
  teacher_note?: string | null;
  submitted_at?: string;
  file_url?: string | null;
  text_answer?: string | null;
}

interface AssignmentDetail {
  id: string;
  title: string;
  result: AssignmentResult | null;
}

interface CourseProgressDetail {
  course_id: string;
  course_title: string;
  course_thumbnail?: string | null;
  watched: number;
  total_lectures: number;
  percentage: number;
  units: UnitDetail[];
  exams: ExamDetail[];
  assignments: AssignmentDetail[];
  exam_stats: { taken: number; passed: number };
}

interface FullStudentDetails {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  parent_phone?: string;
  grade?: string;
  governorate?: string;
  gender?: string;
  avatar_url?: string | null;
  is_active?: boolean;
  courses_progress: CourseProgressDetail[];
}

interface StudentBasic {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  parent_phone?: string;
  grade?: string;
  governorate?: string;
  gender?: string;
  avatar_url?: string | null;
  is_active?: boolean;
}

interface StudentDetailModalProps {
  studentId: string;
  onClose: () => void;
  initialStudent?: StudentBasic;
  isTeacher?: boolean;
  loadingAction?: string | null;
  onTogglePassword?: () => void;
  onResetDevice?: () => void;
  onForceLogout?: () => void;
  onDeleteStudent?: () => void;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDuration(seconds: number) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StudentDetailModal({
  studentId,
  onClose,
  initialStudent,
  isTeacher = false,
  loadingAction = null,
  onTogglePassword,
  onResetDevice,
  onForceLogout,
  onDeleteStudent,
}: StudentDetailModalProps) {
  const [data, setData] = useState<FullStudentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = (await progressAPI.getStudentFullDetails(
        studentId,
      )) as FullStudentDetails;
      setData(res);
      if (res.courses_progress?.length > 0) {
        setOpenCourseId(res.courses_progress[0].course_id);
      }
    } catch (err: any) {
      setError(err.message || "حصل خطأ في تحميل بيانات الطالب");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl w-full max-w-3xl my-4 sm:my-8 shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ====== Header ====== */}
        <div className="relative bg-gradient-to-l from-primary/15 via-secondary/10 to-transparent p-5 sm:p-6 border-b border-border">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>

          {isLoading && !initialStudent ? (
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          ) : (data || initialStudent) ? (
            (() => {
              const header = data || initialStudent!;
              return (
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0 ring-2 ring-background shadow">
                {header.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={header.avatar_url}
                    alt={`${header.first_name} ${header.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : header.gender === "male" || header.gender === "female" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={header.gender === "male" ? "/boy-face.svg" : "/girl-face.svg"}
                    alt="صورة الطالب"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-primary font-extrabold text-2xl">
                    {header.first_name?.[0]}
                    {header.last_name?.[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-extrabold text-foreground truncate">
                    {header.first_name} {header.last_name}
                  </h2>
                  {header.is_active === false && (
                    <Badge variant="destructive">موقوف</Badge>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span dir="ltr">{header.phone || "—"}</span>
                  </span>
                  {header.parent_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      ولي الأمر: <span dir="ltr">{header.parent_phone}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {gradeLabels[header.grade || ""] || header.grade || "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {header.governorate || "—"}
                  </span>
                </div>
              </div>
            </div>
              );
            })()
          ) : null}
        </div>

        {/* ====== Body ====== */}
        <div className="p-5 sm:p-6 max-h-[65vh] overflow-y-auto space-y-4">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between">
              <p className="text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
              <Button variant="ghost" size="sm" onClick={load}>
                إعادة المحاولة
              </Button>
            </div>
          )}

          {isLoading &&
            [1, 2].map((i) => (
              <div key={i} className="border border-border rounded-xl p-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}

          {!isLoading && data && data.courses_progress.length === 0 && (
            <div className="text-center py-10">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                الطالب مش مشترك في أي كورس لسه
              </p>
            </div>
          )}

          {!isLoading &&
            data?.courses_progress.map((course) => {
              const isOpen = openCourseId === course.course_id;
              return (
                <div
                  key={course.course_id}
                  className="border border-border rounded-xl overflow-hidden"
                >
                  {/* Course summary row */}
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCourseId(isOpen ? null : course.course_id)
                    }
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-right"
                  >
                    {course.course_thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.course_thumbnail}
                        alt={course.course_title}
                        className="w-11 h-11 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">
                        {course.course_title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <PlayCircle className="w-3.5 h-3.5" />
                          {course.watched}/{course.total_lectures} محاضرة
                        </span>
                        <span className="flex items-center gap-1">
                          <FileCheck className="w-3.5 h-3.5" />
                          {course.exam_stats.passed}/{course.exam_stats.taken}{" "}
                          اختبار وواجب
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-2">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${course.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-primary shrink-0">
                      {course.percentage}%
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {/* Course full detail */}
                  {isOpen && (
                    <div className="border-t border-border bg-muted/20 p-4 space-y-5">
                      {/* المحاضرات لكل وحدة */}
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <PlayCircle className="w-3.5 h-3.5" />
                          المحاضرات
                        </p>
                        {course.units.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            مفيش محاضرات في الكورس ده لسه
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {course.units.map((unit) => (
                              <div key={unit.id}>
                                <p className="text-xs font-semibold text-foreground mb-1.5">
                                  {unit.title}
                                </p>
                                <div className="space-y-1">
                                  {unit.lectures.map((lec) => (
                                    <div
                                      key={lec.id}
                                      className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2"
                                    >
                                      {lec.watched ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-chart-3 shrink-0" />
                                      ) : (
                                        <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                      )}
                                      <span className="text-xs text-foreground flex-1 truncate">
                                        {lec.title}
                                      </span>
                                      {lec.duration > 0 && (
                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                                          <Clock className="w-3 h-3" />
                                          {formatDuration(lec.last_position)} /{" "}
                                          {formatDuration(lec.duration)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* الاختبارات والواجبات الدراسية (شيتات) */}
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5" />
                          الاختبارات والشيتات
                        </p>
                        {course.exams.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            مفيش اختبارات في الكورس ده لسه
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {course.exams.map((exam) => (
                              <div
                                key={exam.id}
                                className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[10px]"
                                  >
                                    {exam.is_homework ? "شيت" : "اختبار"}
                                  </Badge>
                                  <span className="text-xs text-foreground truncate">
                                    {exam.title}
                                  </span>
                                </div>
                                {exam.result ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={`text-xs font-bold ${
                                        exam.result.passed
                                          ? "text-chart-3"
                                          : "text-destructive"
                                      }`}
                                    >
                                      {exam.result.percentage}%
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                      {formatDate(exam.result.submitted_at)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground shrink-0">
                                    لسه ماحلهاش
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* الواجبات (تسليم ملفات) */}
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          الواجبات
                        </p>
                        {course.assignments.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            مفيش واجبات في الكورس ده لسه
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {course.assignments.map((asgn) => (
                              <div
                                key={asgn.id}
                                className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-2"
                              >
                                <span className="text-xs text-foreground truncate min-w-0">
                                  {asgn.title}
                                </span>
                                {asgn.result ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    {typeof asgn.result.grade === "number" ? (
                                      <span className="text-xs font-bold text-primary">
                                        {asgn.result.grade} درجة
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground">
                                        لسه ماتصححش
                                      </span>
                                    )}
                                    {asgn.result.file_url && (
                                      <a
                                        href={asgn.result.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-primary transition-colors"
                                        title="تحميل ملف التسليم"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    <span className="text-[11px] text-muted-foreground">
                                      {formatDate(asgn.result.submitted_at)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground shrink-0">
                                    لسه ماسلمش
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* ====== Footer — إجراءات سريعة ====== */}
        {(onTogglePassword || onResetDevice || onForceLogout || onDeleteStudent) && (
          <div className="border-t border-border p-4 flex flex-wrap gap-2 bg-muted/20">
            {onTogglePassword && (
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                onClick={onTogglePassword}
              >
                <Lock className="w-4 h-4 ml-2" />
                تغيير الباسورد
              </Button>
            )}
            {isTeacher && onResetDevice && (
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                disabled={loadingAction === `reset-${studentId}`}
                onClick={onResetDevice}
              >
                <Smartphone className="w-4 h-4 ml-2" />
                {loadingAction === `reset-${studentId}`
                  ? "جاري الـ reset..."
                  : "Reset الجهاز"}
              </Button>
            )}
            {isTeacher && onForceLogout && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-400 text-amber-600 hover:bg-amber-50"
                disabled={loadingAction === `logout-${studentId}`}
                onClick={onForceLogout}
              >
                <LogOut className="w-4 h-4 ml-2" />
                {loadingAction === `logout-${studentId}`
                  ? "جاري الطرد..."
                  : "تسجيل خروج إجباري"}
              </Button>
            )}
            {isTeacher && onDeleteStudent && (
              <Button
                size="sm"
                variant="destructive"
                disabled={loadingAction === `delete-${studentId}`}
                onClick={onDeleteStudent}
              >
                <Trash2 className="w-4 h-4 ml-2" />
                {loadingAction === `delete-${studentId}`
                  ? "جاري الحذف..."
                  : "حذف الحساب"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
