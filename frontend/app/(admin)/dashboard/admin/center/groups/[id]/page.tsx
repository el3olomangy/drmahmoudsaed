"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { centerAPI } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Printer,
  CheckCircle,
  AlertCircle,
  Phone,
  Hash,
  Wallet,
  ArrowRight,
  BadgeDollarSign,
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  student_number: string;
  parent_phone: string;
  monthly_fee: number;
  qr_token: string;
  group_id: string;
  paid_current_month: boolean;
  current_month: string;
}
interface Summary {
  students_count: number;
  present_today: number;
  unpaid_count: number;
  month: string;
  date: string;
}

const emptyForm = { name: "", student_number: "", parent_phone: "", monthly_fee: "" };

export default function GroupStudentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = use(params);

  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // form dialog (add/edit)
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");

  // payment dialog
  const [payFor, setPayFor] = useState<Student | null>(null);
  const [payMonth, setPayMonth] = useState("");
  const [payAmount, setPayAmount] = useState("");

  // delete confirm
  const [delFor, setDelFor] = useState<Student | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [list, sum] = await Promise.all([
        centerAPI.listStudents(groupId) as Promise<Student[]>,
        centerAPI.groupSummary(groupId) as Promise<Summary>,
      ]);
      setStudents(list);
      setSummary(sum);
    } catch (err: any) {
      setError(err.message || "حصل خطأ في التحميل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogError("");
    setFormOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      student_number: s.student_number,
      parent_phone: s.parent_phone,
      monthly_fee: String(s.monthly_fee),
    });
    setDialogError("");
    setFormOpen(true);
  };

  const saveStudent = async () => {
    const fee = parseFloat(form.monthly_fee);
    if (!form.name.trim() || !form.student_number.trim() || !form.parent_phone.trim()) {
      setDialogError("املأ كل الخانات");
      return;
    }
    if (isNaN(fee) || fee < 0) {
      setDialogError("الاشتراك الشهري لازم يكون رقم صحيح");
      return;
    }
    setSaving(true);
    setDialogError("");
    try {
      if (editId) {
        await centerAPI.updateStudent(editId, {
          name: form.name.trim(),
          student_number: form.student_number.trim(),
          parent_phone: form.parent_phone.trim(),
          monthly_fee: fee,
        });
      } else {
        await centerAPI.createStudent({
          group_id: groupId,
          name: form.name.trim(),
          student_number: form.student_number.trim(),
          parent_phone: form.parent_phone.trim(),
          monthly_fee: fee,
        });
      }
      setFormOpen(false);
      await load();
    } catch (err: any) {
      setDialogError(err.message || "حصل خطأ");
    } finally {
      setSaving(false);
    }
  };

  const openPay = (s: Student) => {
    setPayFor(s);
    setPayMonth(s.current_month);
    setPayAmount(String(s.monthly_fee));
    setDialogError("");
  };

  const recordPayment = async () => {
    if (!payFor) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount < 0) {
      setDialogError("المبلغ لازم يكون رقم");
      return;
    }
    setSaving(true);
    setDialogError("");
    try {
      await centerAPI.recordPayment(payFor.id, { month: payMonth, amount });
      setPayFor(null);
      await load();
    } catch (err: any) {
      setDialogError(err.message || "حصل خطأ");
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async () => {
    if (!delFor) return;
    setSaving(true);
    try {
      await centerAPI.deleteStudent(delFor.id);
      setDelFor(null);
      await load();
    } catch (err: any) {
      setError(err.message || "مش قادر أحذف");
      setDelFor(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* رجوع */}
      <Link
        href="/dashboard/admin/center"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع للمراحل
      </Link>

      {/* رأس الصفحة */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">طلاب المجموعة</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/dashboard/admin/center/groups/${groupId}/print`}>
              <Printer className="w-4 h-4" />
              طباعة الـ QR
            </Link>
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            طالب جديد
          </Button>
        </div>
      </div>

      {/* ملخّص */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 lg:p-4 text-center">
              <p className="text-2xl font-extrabold">{summary.students_count}</p>
              <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 lg:p-4 text-center">
              <p className="text-2xl font-extrabold text-green-600">{summary.present_today}</p>
              <p className="text-xs text-muted-foreground">حضور النهاردة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 lg:p-4 text-center">
              <p className="text-2xl font-extrabold text-destructive">{summary.unpaid_count}</p>
              <p className="text-xs text-muted-foreground">مدفعوش الشهر</p>
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* قائمة الطلاب */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>مفيش طلاب في المجموعة دي لسه. أضف أول طالب.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {students.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-lg truncate">{s.name}</p>
                      {s.paid_current_month ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full px-2 py-0.5">
                          <CheckCircle className="w-3 h-3" />
                          دفع الشهر
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
                          <AlertCircle className="w-3 h-3" />
                          مدفعش
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5" /> رقم الطالب: {s.student_number}
                      </span>
                      <span className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" /> ولي الأمر: {s.parent_phone}
                      </span>
                      <span className="flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5" /> الاشتراك: {s.monthly_fee} ج
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground"
                      title="تعديل"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDelFor(s)}
                      className="p-2 rounded-md hover:bg-destructive/10 text-destructive"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {!s.paid_current_month && (
                  <Button
                    size="sm"
                    className="mt-3 gap-2 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => openPay(s)}
                  >
                    <BadgeDollarSign className="w-4 h-4" />
                    سجّل دفع الشهر
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ===== Dialog إضافة/تعديل طالب ===== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل بيانات الطالب" : "طالب جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="s-name">اسم الطالب</Label>
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-num">رقم الطالب</Label>
              <Input
                id="s-num"
                value={form.student_number}
                onChange={(e) => setForm((p) => ({ ...p, student_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-phone">رقم ولي الأمر</Label>
              <Input
                id="s-phone"
                inputMode="tel"
                value={form.parent_phone}
                onChange={(e) => setForm((p) => ({ ...p, parent_phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-fee">الاشتراك الشهري (ج)</Label>
              <Input
                id="s-fee"
                inputMode="numeric"
                value={form.monthly_fee}
                onChange={(e) => setForm((p) => ({ ...p, monthly_fee: e.target.value }))}
              />
            </div>
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={saveStudent} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog تسجيل دفع ===== */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل دفع — {payFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="pay-month">الشهر</Label>
              <Input
                id="pay-month"
                type="month"
                value={payMonth}
                onChange={(e) => setPayMonth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amount">المبلغ (ج)</Label>
              <Input
                id="pay-amount"
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayFor(null)}>
              إلغاء
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={recordPayment}
              disabled={saving}
            >
              {saving ? "..." : "تأكيد الدفع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog حذف ===== */}
      <Dialog open={!!delFor} onOpenChange={(o) => !o && setDelFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف الطالب</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            متأكد إنك عايز تحذف{" "}
            <span className="font-bold text-foreground">{delFor?.name}</span>؟ ده هيمسح
            حضوره ومدفوعاته كمان.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelFor(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={deleteStudent} disabled={saving}>
              {saving ? "..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
