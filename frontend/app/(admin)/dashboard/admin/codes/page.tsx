"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KeyRound,
  Plus,
  RefreshCw,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Trash2,
  Download,
} from "lucide-react";
import { codesAPI, coursesAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Code {
  id: string;
  code: string;
  code_type: "course" | "bundle";
  status: "active" | "used" | "expired" | "disabled";
  course_id?: string;
  used_by?: string;
  used_at?: string;
  expires_at?: string;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
  course_type?: "free" | "paid";
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  active: {
    label: "نشط",
    color: "text-chart-3 bg-chart-3/10",
    icon: CheckCircle,
  },
  used: {
    label: "مستخدم",
    color: "text-blue-500 bg-blue-500/10",
    icon: CheckCircle,
  },
  expired: {
    label: "منتهي",
    color: "text-muted-foreground bg-muted",
    icon: Clock,
  },
  disabled: {
    label: "معطل",
    color: "text-destructive bg-destructive/10",
    icon: Ban,
  },
};

export default function CodesPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const [codes, setCodes] = useState<Code[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [form, setForm] = useState({
    code_type: "course",
    course_id: "",
    quantity: "1",
    expires_days: "30",
  });

  const fetchCodes = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = (await codesAPI.getAll()) as Code[];
      setCodes(data);
    } catch (err: any) {
      setError(err.message || "حصل خطأ");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const data = (await coursesAPI.getAll()) as Course[];
      setCourses(data);
    } catch {}
  };

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setIsLoading(true);
      setError("");

      try {
        const data = (await codesAPI.getAll()) as Code[];
        if (active) setCodes(data);
      } catch (err: any) {
        if (active) setError(err.message || "حصل خطأ");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    const loadCourses = async () => {
      try {
        const data = (await coursesAPI.getAll()) as Course[];
        if (active) setCourses(data);
      } catch {
        // ignore course preload errors here
      }
    };

    void loadData();
    void loadCourses();

    return () => {
      active = false;
    };
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.code_type === "course" && !form.course_id) {
      setFormError("اختر الكورس");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    try {
      await codesAPI.generate({
        code_type: form.code_type as "course" | "bundle",
        course_id: form.code_type === "course" ? form.course_id : undefined,
        quantity: Number(form.quantity),
        expires_days: Number(form.expires_days),
      });
      await fetchCodes();
      setIsDialogOpen(false);
      setForm({
        code_type: "course",
        course_id: "",
        quantity: "1",
        expires_days: "30",
      });
    } catch (err: any) {
      setFormError(err.message || "حصل خطأ في توليد الأكواد");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDisable = async (id: string) => {
    if (!confirm("هتعطل الكود ده — مش هيتفعّل تاني. متأكد؟")) return;
    try {
      await codesAPI.disable(id);
      setCodes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "disabled" } : c)),
      );
    } catch (err: any) {
      alert(err.message || "حصل خطأ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هتحذف الكود ده نهائياً. متأكد؟")) return;
    try {
      await codesAPI.delete(id);
      setCodes((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || "حصل خطأ");
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  // ألوان هوية المنصة
  const BRAND = {
    primary: "FFFE2C55", // أحمر العلومنجي
    primaryDark: "FFD41F42",
    secondary: "FF19C7FF", // أزرق العلومنجي
    dark: "FF0D0D0D",
    white: "FFFFFFFF",
    rowAlt: "FFF7F9FB",
    border: "FFE3E7EC",
    success: "FF22C55E", // نشط
    used: "FF19C7FF", // مستخدم
    warning: "FFF59E0B", // منتهي
    danger: "FFFE2C55", // معطل
  };

  const exportExcel = async (exportCodes: Code[]) => {
    if (exportCodes.length === 0) return;
    setIsExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;

      const courseNameMap: Record<string, string> = {};
      courses.forEach((c) => {
        courseNameMap[c.id] = c.title;
      });

      const statusLabels: Record<string, string> = {
        active: "نشط",
        used: "مستخدم",
        expired: "منتهي",
        disabled: "معطل",
      };

      const statusColors: Record<string, string> = {
        active: BRAND.success,
        used: BRAND.used,
        expired: BRAND.warning,
        disabled: BRAND.danger,
      };

      const columns = [
        { header: "الكود", key: "code", width: 20 },
        { header: "النوع", key: "type", width: 12 },
        { header: "الكورس / الباقة", key: "course", width: 30 },
        { header: "الحالة", key: "status", width: 14 },
        { header: "تاريخ الإنشاء", key: "created", width: 16 },
        { header: "تاريخ الانتهاء", key: "expires", width: 16 },
        { header: "تاريخ الاستخدام", key: "used", width: 16 },
      ];
      const colCount = columns.length;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "منصة العلومنجي";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("الأكواد", {
        views: [{ rightToLeft: true, showGridLines: false }],
        pageSetup: { orientation: "landscape", fitToPage: true },
      });

      // ===== شريط العنوان =====
      sheet.mergeCells(1, 1, 1, colCount);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value = "منصة العلومنجي — تقرير أكواد الاشتراك";
      titleCell.font = {
        name: "Calibri",
        size: 16,
        bold: true,
        color: { argb: BRAND.white },
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND.primary },
      };
      sheet.getRow(1).height = 34;

      // ===== شريط بيانات التصدير =====
      sheet.mergeCells(2, 1, 2, colCount);
      const exportDate = new Date().toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const subCell = sheet.getCell(2, 1);
      subCell.value = `تاريخ التصدير: ${exportDate}    |    إجمالي عدد الأكواد: ${exportCodes.length}`;
      subCell.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: BRAND.dark },
      };
      subCell.alignment = { horizontal: "center", vertical: "middle" };
      subCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F4F8" },
      };
      sheet.getRow(2).height = 22;

      // صف فاصل فارغ
      sheet.getRow(3).height = 6;

      // ===== صف العناوين =====
      const headerRowIndex = 4;
      const headerRow = sheet.getRow(headerRowIndex);
      columns.forEach((col, i) => {
        sheet.getColumn(i + 1).width = col.width;
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.font = {
          name: "Calibri",
          size: 12,
          bold: true,
          color: { argb: BRAND.white },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.secondary },
        };
        cell.border = {
          top: { style: "thin", color: { argb: BRAND.border } },
          bottom: { style: "thin", color: { argb: BRAND.border } },
          left: { style: "thin", color: { argb: BRAND.border } },
          right: { style: "thin", color: { argb: BRAND.border } },
        };
      });
      headerRow.height = 26;

      // ===== صفوف البيانات =====
      exportCodes.forEach((c, idx) => {
        const rowIndex = headerRowIndex + 1 + idx;
        const row = sheet.getRow(rowIndex);
        const isAlt = idx % 2 === 1;

        const values = [
          c.code,
          c.code_type === "course" ? "كورس" : "باقة",
          c.course_id ? courseNameMap[c.course_id] || c.course_id : "—",
          statusLabels[c.status] || c.status,
          new Date(c.created_at).toLocaleDateString("ar-EG"),
          c.expires_at
            ? new Date(c.expires_at).toLocaleDateString("ar-EG")
            : "—",
          c.used_at ? new Date(c.used_at).toLocaleDateString("ar-EG") : "—",
        ];

        values.forEach((val, i) => {
          const cell = row.getCell(i + 1);
          cell.value = val;
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: BRAND.border } },
            bottom: { style: "thin", color: { argb: BRAND.border } },
            left: { style: "thin", color: { argb: BRAND.border } },
            right: { style: "thin", color: { argb: BRAND.border } },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isAlt ? BRAND.rowAlt : BRAND.white },
          };

          if (columns[i].key === "code") {
            cell.font = { name: "Consolas", size: 11, bold: true };
          } else if (columns[i].key === "status") {
            cell.font = {
              name: "Calibri",
              size: 11,
              bold: true,
              color: { argb: statusColors[c.status] || BRAND.dark },
            };
          } else {
            cell.font = { name: "Calibri", size: 11, color: { argb: BRAND.dark } };
          }
        });

        row.height = 22;
      });

      // تجميد صف العناوين + فلترة تلقائية
      sheet.views = [
        {
          rightToLeft: true,
          showGridLines: false,
          state: "frozen",
          ySplit: headerRowIndex,
        },
      ];
      sheet.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: headerRowIndex, column: colCount },
      };

      // إطار خارجي حول الجدول كله
      const lastRow = headerRowIndex + exportCodes.length;
      for (let c = 1; c <= colCount; c++) {
        sheet.getCell(headerRowIndex, c).border = {
          ...sheet.getCell(headerRowIndex, c).border,
          top: { style: "medium", color: { argb: BRAND.primary } },
        };
        sheet.getCell(lastRow, c).border = {
          ...sheet.getCell(lastRow, c).border,
          bottom: { style: "medium", color: { argb: BRAND.primary } },
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `أكواد_العلومنجي_${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("حصل خطأ أثناء تصدير ملف الإكسل");
    } finally {
      setIsExporting(false);
    }
  };

  const filtered =
    filterStatus === "all"
      ? codes
      : codes.filter((c) => c.status === filterStatus);

  const counts = {
    all: codes.length,
    active: codes.filter((c) => c.status === "active").length,
    used: codes.filter((c) => c.status === "used").length,
    expired: codes.filter((c) => c.status === "expired").length,
    disabled: codes.filter((c) => c.status === "disabled").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">الأكواد</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "..." : `${codes.length} كود`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchCodes} disabled={isLoading}>
            <RefreshCw
              className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin text-loading" : "text-muted-foreground"}`}
            />
            تحديث
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {filtered.length > 0 && (
              <Button
                variant="outline"
                onClick={() => exportExcel(filtered)}
                disabled={isExporting}
              >
                <Download
                  className={`w-4 h-4 ml-2 ${isExporting ? "animate-spin" : ""}`}
                />
                {isExporting
                  ? "جاري التصدير..."
                  : `تصدير Excel (${filtered.length})`}
              </Button>
            )}
            {isTeacher && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="w-4 h-4 ml-2" />
                    توليد أكواد
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>توليد أكواد جديدة</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleGenerate} className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label>نوع الكود</Label>
                      <Select
                        value={form.code_type}
                        onValueChange={(v) =>
                          setForm((p) => ({
                            ...p,
                            code_type: v,
                            course_id: "",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="course">كورس محدد</SelectItem>
                          <SelectItem value="bundle">باقة كورسات</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.code_type === "course" && (
                      <div className="space-y-2">
                        <Label>الكورس *</Label>
                        <Select
                          value={form.course_id}
                          onValueChange={(v) =>
                            setForm((p) => ({ ...p, course_id: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الكورس" />
                          </SelectTrigger>
                          <SelectContent>
                            {courses
                              .filter((c) => c.course_type !== "free")
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.title}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {courses.filter((c) => c.course_type !== "free")
                          .length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            مفيش كورسات مدفوعة لسه — الكورسات المجانية متاحة
                            للطلاب من غير كود
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الكمية</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={form.quantity}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, quantity: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>صلاحية (يوم)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.expires_days}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              expires_days: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    {formError && (
                      <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                        {formError}
                      </p>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="submit"
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "جاري التوليد..." : "توليد الأكواد"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(counts).map(([key, count]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filterStatus === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {key === "all" ? "الكل" : statusConfig[key]?.label} ({count})
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchCodes}>
            إعادة المحاولة
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            قائمة الأكواد
            {!isLoading && (
              <span className="text-sm font-normal text-muted-foreground">
                ({filtered.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-6 w-16" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <KeyRound className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">مفيش أكواد</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((code) => {
                const sc = statusConfig[code.status] || statusConfig.active;
                const StatusIcon = sc.icon;
                const course = courses.find((c) => c.id === code.course_id);
                return (
                  <div
                    key={code.id}
                    className="p-4 flex flex-wrap items-center gap-3 sm:gap-4"
                  >
                    {/* Code */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-foreground tracking-widest text-sm bg-muted px-3 py-1.5 rounded-lg break-all">
                        {code.code}
                      </span>
                      {code.status === "active" && (
                        <button
                          onClick={() => copyCode(code.id, code.code)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="نسخ الكود"
                        >
                          {copiedId === code.id ? (
                            <CheckCircle className="w-4 h-4 text-chart-3" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Status badge */}
                    <span
                      className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0 ${sc.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {sc.label}
                    </span>

                    {/* Course name */}
                    <span className="text-sm text-muted-foreground min-w-0 flex-1 basis-full sm:basis-auto truncate">
                      {course?.title ||
                        (code.code_type === "bundle" ? "باقة" : "—")}
                    </span>

                    {/* Date */}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {code.used_at
                        ? `استُخدم ${new Date(code.used_at).toLocaleDateString("ar-EG")}`
                        : code.expires_at
                          ? `تنتهي ${new Date(code.expires_at).toLocaleDateString("ar-EG")}`
                          : "—"}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 mr-auto sm:mr-0">
                      {isTeacher && code.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDisable(code.id)}
                        >
                          <Ban className="w-4 h-4 ml-1" />
                          تعطيل
                        </Button>
                      )}
                      {isTeacher && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(code.id)}
                          title="حذف الكود"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}