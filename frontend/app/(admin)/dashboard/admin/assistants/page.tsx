"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  UserCog,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Lock,
  X,
} from "lucide-react";
import { assistantsAPI } from "@/lib/api";

interface Assistant {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
}

type Status = "success" | "error" | null;

export default function AssistantsPage() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createStatus, setCreateStatus] = useState<Status>(null);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    password: "",
  });

  // Reset password dialog
  const [resetDialog, setResetDialog] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<Status>(null);
  const [resetError, setResetError] = useState("");

  // Delete loading
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAssistants = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = (await assistantsAPI.getAll()) as Assistant[];
      setAssistants(data);
    } catch (e: any) {
      setError(e.message || "حصل خطأ في تحميل المساعدين");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (form.password.length < 6) {
      setCreateError("كلمة المرور لازم تكون 6 أحرف على الأقل");
      return;
    }
    setIsSubmitting(true);
    try {
      const newA = (await assistantsAPI.create(form)) as Assistant;
      setAssistants((prev) => [newA, ...prev]);
      setCreateStatus("success");
      setTimeout(() => {
        setIsCreateOpen(false);
        setCreateStatus(null);
        setForm({ first_name: "", last_name: "", phone: "", password: "" });
      }, 1200);
    } catch (e: any) {
      setCreateError(e.message || "حصل خطأ في إنشاء الحساب");
      setCreateStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هتحذف حساب ${name} نهائياً. متأكد؟`)) return;
    setDeletingId(id);
    try {
      await assistantsAPI.delete(id);
      setAssistants((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      alert(e.message || "حصل خطأ في الحذف");
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetDialog) return;
    if (newPassword.length < 6) {
      setResetError("كلمة المرور لازم تكون 6 أحرف على الأقل");
      return;
    }
    setResetLoading(true);
    setResetError("");
    try {
      await assistantsAPI.resetPassword(resetDialog.id, newPassword);
      setResetStatus("success");
      setTimeout(() => {
        setResetDialog(null);
        setResetStatus(null);
        setNewPassword("");
      }, 1200);
    } catch (e: any) {
      setResetError(e.message || "حصل خطأ");
      setResetStatus("error");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">المساعدون</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "..." : `${assistants.length} مساعد`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={fetchAssistants}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw
              className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin text-loading" : "text-muted-foreground"}`}
            />
            تحديث
          </Button>

          {/* Create Dialog */}
          <Dialog
            open={isCreateOpen}
            onOpenChange={(v) => {
              setIsCreateOpen(v);
              if (!v) {
                setCreateError("");
                setCreateStatus(null);
                setForm({
                  first_name: "",
                  last_name: "",
                  phone: "",
                  password: "",
                });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 sm:flex-none">
                <Plus className="w-4 h-4 ml-2" />
                مساعد جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة مساعد جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>الاسم الأول *</Label>
                    <Input
                      placeholder="محمد"
                      value={form.first_name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, first_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الاسم الأخير *</Label>
                    <Input
                      placeholder="أحمد"
                      value={form.last_name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, last_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>رقم الهاتف *</Label>
                  <Input
                    placeholder="01xxxxxxxxx"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    dir="ltr"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>كلمة المرور *</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="6 أحرف على الأقل"
                      value={form.password}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, password: e.target.value }))
                      }
                      className="pl-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {createError && (
                  <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {createError}
                  </p>
                )}
                {createStatus === "success" && (
                  <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-3 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" /> تم إنشاء الحساب
                    بنجاح
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "جاري الإنشاء..." : "إنشاء الحساب"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchAssistants}>
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            قائمة المساعدين
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-loading border-t-transparent rounded-full animate-spin" />
            </div>
          ) : assistants.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">مفيش مساعدين لسه</p>
              <Button
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="w-4 h-4 ml-2" />
                أضف أول مساعد
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {assistants.map((assistant) => (
                <div
                  key={assistant.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  {/* Avatar + Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-sm">
                        {assistant.first_name?.[0]}
                        {assistant.last_name?.[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">
                        {assistant.first_name} {assistant.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate" dir="ltr">
                        {assistant.phone}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      onClick={() => {
                        setResetDialog({
                          id: assistant.id,
                          name: `${assistant.first_name} ${assistant.last_name}`,
                        });
                        setNewPassword("");
                        setResetError("");
                        setResetStatus(null);
                      }}
                    >
                      <Lock className="w-4 h-4 ml-1" />
                      تغيير الباسورد
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                      disabled={deletingId === assistant.id}
                      onClick={() =>
                        handleDelete(
                          assistant.id,
                          `${assistant.first_name} ${assistant.last_name}`,
                        )
                      }
                    >
                      <Trash2 className="w-4 h-4 ml-1" />
                      {deletingId === assistant.id ? "جاري الحذف..." : "حذف"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      {resetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm space-y-4"
            dir="rtl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-foreground">تغيير كلمة المرور</h2>
              <button
                onClick={() => setResetDialog(null)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">{resetDialog.name}</p>

            {resetStatus === "success" ? (
              <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-3 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> تم تغيير كلمة المرور بنجاح
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>كلمة المرور الجديدة</Label>
                  <div className="relative">
                    <Input
                      type={showNewPass ? "text" : "password"}
                      placeholder="6 أحرف على الأقل"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass((p) => !p)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showNewPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {resetError && (
                  <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    {resetError}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={resetLoading || newPassword.length < 6}
                    onClick={handleResetPassword}
                  >
                    {resetLoading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setResetDialog(null)}
                  >
                    إلغاء
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
