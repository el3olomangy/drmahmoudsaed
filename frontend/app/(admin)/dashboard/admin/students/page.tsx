"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Lock,
  X,
} from "lucide-react";
import { usersAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StudentDetailModal } from "@/components/students/StudentDetailModal";
import { DefaultAvatar } from "@/components/default-avatar";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  parent_phone?: string;
  grade?: string;
  governorate?: string;
  gender?: string;
  avatar_url?: string | null;
  is_active: boolean;
  enrolled_courses: string[];
}

const gradeLabels: Record<string, string> = {
  first_preparatory: "أولى إعدادي",
  second_preparatory: "ثانية إعدادي",
  third_preparatory: "ثالثة إعدادي",
  first_secondary: "أولى ثانوي",
  second_secondary: "ثانية ثانوي",
  third_secondary: "ثالثة ثانوي",
};

export default function StudentsPage() {
  const { user } = useAuth();
  // المساعد يشوف بيانات الطلاب بس — إجراءات الإيقاف/الحذف/تصفير الجهاز/الباسورد للمدرس فقط،
  // ده متطابق مع صلاحيات الـ Backend الفعلية (get_current_teacher) في هذه الإجراءات
  const isTeacher = user?.role === "teacher";
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  // Reset Password Dialog
  const [resetPwDialog, setResetPwDialog] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwError, setResetPwError] = useState("");
  const [resetPwSuccess, setResetPwSuccess] = useState(false);

  const fetchStudents = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = (await usersAPI.getAll()) as Student[];
      setStudents(data);
    } catch (err: any) {
      setError(err.message || "حصل خطأ في تحميل الطلاب");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleToggleActive = async (id: string) => {
    setLoadingAction(`toggle-${id}`);
    try {
      await usersAPI.toggleActive(id);
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s)),
      );
    } catch (err: any) {
      alert(err.message || "حصل خطأ");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetDevice = async (id: string) => {
    if (!confirm("هتعمل reset للجهاز — الطالب هيقدر يسجل من جهاز جديد. متأكد؟"))
      return;
    setLoadingAction(`reset-${id}`);
    try {
      await usersAPI.resetDevice(id);
      alert("تم reset الجهاز بنجاح");
    } catch (err: any) {
      alert(err.message || "حصل خطأ");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForceLogout = async (id: string, name: string) => {
    if (!confirm(`هتسجل خروج ${name} من كل أجهزته فوراً. متأكد؟`)) return;
    setLoadingAction(`logout-${id}`);
    try {
      const res: any = await usersAPI.forceLogout(id);
      alert(res.message || "تم تسجيل الخروج الإجباري");
    } catch (err: any) {
      alert(err.message || "حصل خطأ");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`هتحذف حساب ${name} نهائياً — مش هيرجع. متأكد؟`)) return;
    setLoadingAction(`delete-${id}`);
    try {
      await usersAPI.deleteStudent(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setSelectedStudentId(null);
    } catch (err: any) {
      alert(err.message || "حصل خطأ في الحذف");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwDialog) return;
    if (newPassword.length < 6) {
      setResetPwError("كلمة المرور لازم تكون 6 أحرف على الأقل");
      return;
    }
    setResetPwLoading(true);
    setResetPwError("");
    try {
      await (usersAPI as any).resetPassword(resetPwDialog.id, newPassword);
      setResetPwSuccess(true);
      setTimeout(() => {
        setResetPwDialog(null);
        setNewPassword("");
        setResetPwSuccess(false);
      }, 1500);
    } catch (err: any) {
      setResetPwError(err.message || "حصل خطأ");
    } finally {
      setResetPwLoading(false);
    }
  };

  const closeResetDialog = () => {
    setResetPwDialog(null);
    setNewPassword("");
    setResetPwError("");
    setResetPwSuccess(false);
  };

  const filtered = students.filter((s) =>
    `${s.first_name} ${s.last_name} ${s.phone}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* ====== Reset Password Dialog ====== */}
      {resetPwDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={closeResetDialog}
        >
          <div
            className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-extrabold text-foreground">
                    تغيير كلمة المرور
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {resetPwDialog.name}
                  </p>
                </div>
              </div>
              <button
                onClick={closeResetDialog}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetPwSuccess ? (
              <div className="flex items-center justify-center gap-2 p-4 bg-green-500/10 rounded-xl text-green-600 font-medium">
                <CheckCircle className="w-5 h-5" />
                تم تغيير كلمة المرور بنجاح
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Input
                    type="text"
                    placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setResetPwError("");
                    }}
                    className="text-left"
                    dir="ltr"
                  />
                  {resetPwError && (
                    <p className="text-xs text-destructive">{resetPwError}</p>
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <Button
                    className="flex-1"
                    disabled={resetPwLoading || newPassword.length < 6}
                    onClick={handleResetPassword}
                  >
                    {resetPwLoading ? "جاري التغيير..." : "حفظ كلمة المرور"}
                  </Button>
                  <Button variant="ghost" onClick={closeResetDialog}>
                    إلغاء
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">الطلاب</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "..." : `${students.length} طالب مسجل`}
          </p>
        </div>
        <Button variant="outline" onClick={fetchStudents} disabled={isLoading}>
          <RefreshCw
            className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin text-loading" : "text-muted-foreground"}`}
          />
          تحديث
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="ابحث باسم الطالب أو الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchStudents}>
            إعادة المحاولة
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            قائمة الطلاب
            {!isLoading && search && (
              <span className="text-sm font-normal text-muted-foreground">
                ({filtered.length} نتيجة)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {search ? "مفيش نتائج للبحث ده" : "مفيش طلاب مسجلين لسه"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((student) => (
                <div
                  key={student.id}
                  className="p-4 flex flex-wrap items-center gap-3 sm:gap-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                    {student.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={student.avatar_url}
                        alt={`${student.first_name} ${student.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <DefaultAvatar
                        gender={student.gender}
                        name={`${student.first_name} ${student.last_name}`}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground truncate">
                        {student.first_name} {student.last_name}
                      </p>
                      {!student.is_active && (
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full shrink-0">
                          موقوف
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                      <span>الطالب:</span>
                      <span dir="ltr">{student.phone}</span>
                      {student.parent_phone && (
                        <>
                          <span className="mx-1 text-muted-foreground/40">
                            |
                          </span>
                          <span>ولي الأمر:</span>
                          <span dir="ltr">{student.parent_phone}</span>
                        </>
                      )}
                    </p>
                    <p className="md:hidden text-xs text-muted-foreground mt-1">
                      {gradeLabels[student.grade || ""] || student.grade || "—"} ·{" "}
                      {student.enrolled_courses.length} كورس
                    </p>
                  </div>

                  <div className="hidden md:block text-sm text-muted-foreground text-left shrink-0">
                    <p>
                      {gradeLabels[student.grade || ""] ||
                        student.grade ||
                        "—"}
                    </p>
                    <p>{student.enrolled_courses.length} كورس</p>
                  </div>

                  <div
                    className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end order-last sm:order-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      variant={student.is_active ? "destructive" : "default"}
                      className={
                        student.is_active
                          ? ""
                          : "bg-chart-3 hover:bg-chart-3/90 text-white"
                      }
                      disabled={loadingAction === `toggle-${student.id}`}
                      onClick={() => handleToggleActive(student.id)}
                    >
                      {loadingAction === `toggle-${student.id}` ? (
                        "..."
                      ) : student.is_active ? (
                        <>
                          <XCircle className="w-4 h-4 ml-1" />
                          إيقاف
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 ml-1" />
                          تفعيل
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedStudentId(student.id)}
                    >
                      <Eye className="w-4 h-4 ml-1" />
                      عرض الملف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== ملف الطالب الكامل ====== */}
      {selectedStudentId &&
        (() => {
          const student = students.find((s) => s.id === selectedStudentId);
          return (
            <StudentDetailModal
              studentId={selectedStudentId}
              onClose={() => setSelectedStudentId(null)}
              initialStudent={student}
              isTeacher={isTeacher}
              loadingAction={loadingAction}
              onTogglePassword={() => {
                if (!student) return;
                setResetPwDialog({
                  id: student.id,
                  name: `${student.first_name} ${student.last_name}`,
                });
                setNewPassword("");
                setResetPwError("");
                setResetPwSuccess(false);
              }}
              onResetDevice={
                isTeacher
                  ? () => handleResetDevice(selectedStudentId)
                  : undefined
              }
              onForceLogout={
                isTeacher
                  ? () =>
                      handleForceLogout(
                        selectedStudentId,
                        student
                          ? `${student.first_name} ${student.last_name}`
                          : "الطالب",
                      )
                  : undefined
              }
              onDeleteStudent={
                isTeacher
                  ? () =>
                      handleDeleteStudent(
                        selectedStudentId,
                        student
                          ? `${student.first_name} ${student.last_name}`
                          : "الطالب",
                      )
                  : undefined
              }
            />
          );
        })()}
    </div>
  );
}
