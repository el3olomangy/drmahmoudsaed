"use client";

import { useEffect, useState } from "react";
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
  QrCode,
  Plus,
  Pencil,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Layers,
  AlertCircle,
  Camera,
  BarChart3,
  CalendarCheck,
} from "lucide-react";

interface Stage {
  id: string;
  name: string;
  groups_count: number;
}
interface Group {
  id: string;
  name: string;
  stage_id: string;
  students_count: number;
}

export default function CenterPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [groupsByStage, setGroupsByStage] = useState<Record<string, Group[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ===== dialogs =====
  const [stageDialog, setStageDialog] = useState<{ open: boolean; id?: string; name: string }>({
    open: false,
    name: "",
  });
  const [groupDialog, setGroupDialog] = useState<{
    open: boolean;
    stageId: string;
    id?: string;
    name: string;
  }>({ open: false, stageId: "", name: "" });
  const [confirm, setConfirm] = useState<{
    open: boolean;
    type: "stage" | "group";
    id: string;
    name: string;
    stageId?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const loadStages = async () => {
    setLoading(true);
    setError("");
    try {
      const data = (await centerAPI.listStages()) as Stage[];
      setStages(data);
    } catch (err: any) {
      setError(err.message || "حصل خطأ في تحميل المراحل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStages();
  }, []);

  const loadGroups = async (stageId: string) => {
    try {
      const data = (await centerAPI.listGroups(stageId)) as Group[];
      setGroupsByStage((prev) => ({ ...prev, [stageId]: data }));
    } catch (err: any) {
      setError(err.message || "حصل خطأ في تحميل المجموعات");
    }
  };

  const toggleStage = (stageId: string) => {
    if (expanded === stageId) {
      setExpanded(null);
    } else {
      setExpanded(stageId);
      if (!groupsByStage[stageId]) loadGroups(stageId);
    }
  };

  // ===== حفظ المرحلة =====
  const saveStage = async () => {
    const name = stageDialog.name.trim();
    if (!name) return;
    setSaving(true);
    setDialogError("");
    try {
      if (stageDialog.id) {
        await centerAPI.updateStage(stageDialog.id, name);
      } else {
        await centerAPI.createStage(name);
      }
      setStageDialog({ open: false, name: "" });
      await loadStages();
    } catch (err: any) {
      setDialogError(err.message || "حصل خطأ");
    } finally {
      setSaving(false);
    }
  };

  // ===== حفظ المجموعة =====
  const saveGroup = async () => {
    const name = groupDialog.name.trim();
    if (!name) return;
    setSaving(true);
    setDialogError("");
    try {
      if (groupDialog.id) {
        await centerAPI.updateGroup(groupDialog.id, { name });
      } else {
        await centerAPI.createGroup(groupDialog.stageId, name);
      }
      const stageId = groupDialog.stageId;
      setGroupDialog({ open: false, stageId: "", name: "" });
      await loadGroups(stageId);
      await loadStages();
    } catch (err: any) {
      setDialogError(err.message || "حصل خطأ");
    } finally {
      setSaving(false);
    }
  };

  // ===== حذف =====
  const doDelete = async () => {
    if (!confirm) return;
    setSaving(true);
    setDialogError("");
    try {
      if (confirm.type === "stage") {
        await centerAPI.deleteStage(confirm.id);
        await loadStages();
      } else {
        await centerAPI.deleteGroup(confirm.id);
        if (confirm.stageId) await loadGroups(confirm.stageId);
        await loadStages();
      }
      setConfirm(null);
    } catch (err: any) {
      setDialogError(err.message || "مش قادر أحذف");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <QrCode className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">السنتر</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard/admin/center/scan">
              <Camera className="w-4 h-4" />
              اسكان الحضور
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard/admin/center/attendance">
              <CalendarCheck className="w-4 h-4" />
              الحضور اليومي
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard/admin/center/reports">
              <BarChart3 className="w-4 h-4" />
              التقارير
            </Link>
          </Button>
          <Button
            onClick={() => {
              setDialogError("");
              setStageDialog({ open: true, name: "" });
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            مرحلة جديدة
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* المراحل */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>لسه مفيش مراحل. ابدأ بإضافة مرحلة (زي: تالتة ثانوي).</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {stages.map((stage) => (
            <Card key={stage.id} className="overflow-hidden">
              {/* رأس المرحلة */}
              <button
                onClick={() => toggleStage(stage.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-right"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{stage.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {stage.groups_count} مجموعة
                    </p>
                  </div>
                </div>
                {expanded === stage.id ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* محتوى المرحلة (المجموعات) */}
              {expanded === stage.id && (
                <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                  {/* أزرار المرحلة */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        setDialogError("");
                        setGroupDialog({ open: true, stageId: stage.id, name: "" });
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      مجموعة جديدة
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => {
                        setDialogError("");
                        setStageDialog({ open: true, id: stage.id, name: stage.name });
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      تعديل الاسم
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() =>
                        setConfirm({
                          open: true,
                          type: "stage",
                          id: stage.id,
                          name: stage.name,
                        })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف المرحلة
                    </Button>
                  </div>

                  {/* قائمة المجموعات */}
                  {!groupsByStage[stage.id] ? (
                    <Skeleton className="h-12 w-full rounded-lg" />
                  ) : groupsByStage[stage.id].length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      مفيش مجموعات في المرحلة دي لسه.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {groupsByStage[stage.id].map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center justify-between gap-2 bg-card rounded-lg border border-border p-3"
                        >
                          <Link
                            href={`/dashboard/admin/center/groups/${group.id}`}
                            className="flex items-center gap-3 min-w-0 flex-1 hover:text-primary transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-secondary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{group.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {group.students_count} طالب
                              </p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setDialogError("");
                                setGroupDialog({
                                  open: true,
                                  stageId: stage.id,
                                  id: group.id,
                                  name: group.name,
                                });
                              }}
                              className="p-2 rounded-md hover:bg-muted text-muted-foreground"
                              title="تعديل"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setConfirm({
                                  open: true,
                                  type: "group",
                                  id: group.id,
                                  name: group.name,
                                  stageId: stage.id,
                                })
                              }
                              className="p-2 rounded-md hover:bg-destructive/10 text-destructive"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ===== Dialog المرحلة ===== */}
      <Dialog
        open={stageDialog.open}
        onOpenChange={(o) => setStageDialog((p) => ({ ...p, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stageDialog.id ? "تعديل المرحلة" : "مرحلة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="stage-name">اسم المرحلة</Label>
            <Input
              id="stage-name"
              placeholder="مثال: تالتة ثانوي"
              value={stageDialog.name}
              onChange={(e) => setStageDialog((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && saveStage()}
              autoFocus
            />
            {dialogError && (
              <p className="text-sm text-destructive">{dialogError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setStageDialog({ open: false, name: "" })}
            >
              إلغاء
            </Button>
            <Button onClick={saveStage} disabled={saving || !stageDialog.name.trim()}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog المجموعة ===== */}
      <Dialog
        open={groupDialog.open}
        onOpenChange={(o) => setGroupDialog((p) => ({ ...p, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{groupDialog.id ? "تعديل المجموعة" : "مجموعة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="group-name">اسم المجموعة</Label>
            <Input
              id="group-name"
              placeholder="مثال: مجموعة السبت 4 عصرًا"
              value={groupDialog.name}
              onChange={(e) => setGroupDialog((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && saveGroup()}
              autoFocus
            />
            {dialogError && (
              <p className="text-sm text-destructive">{dialogError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setGroupDialog({ open: false, stageId: "", name: "" })}
            >
              إلغاء
            </Button>
            <Button onClick={saveGroup} disabled={saving || !groupDialog.name.trim()}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog تأكيد الحذف ===== */}
      <Dialog
        open={!!confirm?.open}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            متأكد إنك عايز تحذف{" "}
            <span className="font-bold text-foreground">{confirm?.name}</span>؟
          </p>
          {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={saving}>
              {saving ? "..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
