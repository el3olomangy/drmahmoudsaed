"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { centerAPI } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarCheck,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Phone,
  Hash,
  UserCheck,
  UserX,
  Undo2,
} from "lucide-react";

interface Stage {
  id: string;
  name: string;
}
interface Group {
  id: string;
  name: string;
}
interface PresentStudent {
  student_id: string;
  name: string;
  student_number: string;
  parent_phone: string;
  group_id: string;
  was_paid: boolean;
}
interface AbsentStudent {
  student_id: string;
  name: string;
  student_number: string;
  parent_phone: string;
  group_id: string;
}
interface DayData {
  date: string;
  present_count: number;
  absent_count: number;
  present: PresentStudent[];
  absent: AbsentStudent[];
}

type Tab = "present" | "absent";

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function DailyAttendancePage() {
  const [date, setDate] = useState(todayStr());
  const [tab, setTab] = useState<Tab>("present");

  const [stages, setStages] = useState<Stage[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stageId, setStageId] = useState("");
  const [groupId, setGroupId] = useState("");

  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    centerAPI
      .listStages()
      .then((s) => setStages(s as Stage[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setGroupId("");
    setGroups([]);
    if (!stageId) return;
    centerAPI
      .listGroups(stageId)
      .then((g) => setGroups(g as Group[]))
      .catch(() => {});
  }, [stageId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params: { date: string; stage_id?: string; group_id?: string } = { date };
    if (groupId) params.group_id = groupId;
    else if (stageId) params.stage_id = stageId;
    try {
      setData((await centerAPI.attendanceDay(params)) as DayData);
    } catch (err: any) {
      setError(err.message || "حصل خطأ في تحميل الحضور");
    } finally {
      setLoading(false);
    }
  }, [date, stageId, groupId]);

  useEffect(() => {
    load();
  }, [load]);

  // تسجيل حضور يدوي
  const markPresent = async (studentId: string) => {
    setActingId(studentId);
    try {
      await centerAPI.markManual(studentId, date);
      await load();
    } catch (err: any) {
      setError(err.message || "مش قادر أسجّل");
    } finally {
      setActingId(null);
    }
  };

  // إلغاء حضور (يبقى غايب)
  const markAbsent = async (studentId: string) => {
    setActingId(studentId);
    try {
      await centerAPI.unmarkAttendance(studentId, date);
      await load();
    } catch (err: any) {
      setError(err.message || "مش قادر ألغي");
    } finally {
      setActingId(null);
    }
  };

  const list = tab === "present" ? data?.present ?? [] : data?.absent ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link
        href="/dashboard/admin/center"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع للسنتر
      </Link>

      <div className="flex items-center gap-2">
        <CalendarCheck className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">الحضور اليومي</h1>
      </div>

      {/* اختيار التاريخ */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">اختار اليوم</label>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDate(todayStr())}
            disabled={date === todayStr()}
          >
            النهاردة
          </Button>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="grid grid-cols-2 gap-3">
        <select
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">كل المراحل</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          disabled={!stageId}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">كل المجموعات</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {/* التبويبات */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        <button
          onClick={() => setTab("present")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "present" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          حاضرين {data ? `(${data.present_count})` : ""}
        </button>
        <button
          onClick={() => setTab("absent")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "absent" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          }`}
        >
          <UserX className="w-4 h-4" />
          غايبين {data ? `(${data.absent_count})` : ""}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {tab === "absent" && !stageId && !groupId && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
          نصيحة: اختار مرحلة أو مجموعة عشان تشوف الغايبين بشكل أوضح.
        </p>
      )}

      {/* القائمة */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tab === "present" ? (
              <>
                <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>محدش حاضر في اليوم ده.</p>
              </>
            ) : (
              <>
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-70" />
                <p>مفيش غياب — الكل حاضر! 🎉</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((s) => (
            <Card key={s.student_id}>
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold truncate">{s.name}</p>
                    {tab === "present" && (
                      (s as PresentStudent).was_paid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full px-2 py-0.5">
                          <CheckCircle className="w-3 h-3" /> دافع
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
                          <AlertCircle className="w-3 h-3" /> مدفعش
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Hash className="w-3 h-3" /> {s.student_number}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
                  {tab === "absent" && (
                    <a
                      href={`tel:${s.parent_phone}`}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground shrink-0"
                      title="اتصل بولي الأمر"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {tab === "present" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 flex-1 sm:flex-none text-destructive hover:text-destructive"
                      onClick={() => markAbsent(s.student_id)}
                      disabled={actingId === s.student_id}
                    >
                      <Undo2 className="w-4 h-4" />
                      إلغاء الحضور
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1 flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => markPresent(s.student_id)}
                      disabled={actingId === s.student_id}
                    >
                      <UserCheck className="w-4 h-4" />
                      سجّل حاضر
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
