"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { centerAPI } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Phone,
  Hash,
  CalendarCheck,
  Wallet,
  Users,
  CalendarRange,
  Printer,
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
interface UnpaidStudent {
  student_id: string;
  name: string;
  student_number: string;
  parent_phone: string;
  group_id: string;
  monthly_fee: number;
}
interface MonthlyRow {
  student_id: string;
  name: string;
  student_number: string;
  parent_phone: string;
  group_id: string;
  group_name: string;
  monthly_fee: number;
  sessions: number;
  paid: boolean;
  amount_paid: number;
}
interface MonthlyData {
  month: string;
  students_count: number;
  paid_count: number;
  unpaid_count: number;
  total_sessions: number;
  total_collected: number;
  rows: MonthlyRow[];
}

type Tab = "monthly" | "attendance" | "unpaid";

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function currentMonthStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

export default function CenterReportsPage() {
  const [tab, setTab] = useState<Tab>("monthly");

  // تاريخ الحضور + شهر المدفوعات
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(currentMonthStr());

  // فلاتر
  const [stages, setStages] = useState<Stage[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stageId, setStageId] = useState("");
  const [groupId, setGroupId] = useState("");

  // بيانات
  const [attendance, setAttendance] = useState<{ date: string; present_count: number; present: PresentStudent[] } | null>(null);
  const [unpaid, setUnpaid] = useState<{ month: string; count: number; students: UnpaidStudent[] } | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    const scope: { stage_id?: string; group_id?: string } = {};
    if (groupId) scope.group_id = groupId;
    else if (stageId) scope.stage_id = stageId;
    try {
      if (tab === "attendance") {
        setAttendance((await centerAPI.attendanceDay({ date, ...scope })) as any);
      } else if (tab === "unpaid") {
        setUnpaid((await centerAPI.reportUnpaid({ month, ...scope })) as any);
      } else {
        setMonthly((await centerAPI.reportMonthly({ month, ...scope })) as any);
      }
    } catch (err: any) {
      setError(err.message || "حصل خطأ في تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }, [tab, date, month, stageId, groupId]);

  useEffect(() => {
    load();
  }, [load]);

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
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">تقارير السنتر</h1>
      </div>

      {/* التبويبات */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        <button
          onClick={() => setTab("monthly")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "monthly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          تقرير الشهر
        </button>
        <button
          onClick={() => setTab("attendance")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "attendance" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          حضور يوم
        </button>
        <button
          onClick={() => setTab("unpaid")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "unpaid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          }`}
        >
          <Wallet className="w-4 h-4" />
          مدفوعات شهر
        </button>
      </div>

      {/* اختيار التاريخ/الشهر حسب التبويب */}
      {tab === "attendance" ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" size="sm" onClick={() => setDate(todayStr())} disabled={date === todayStr()}>
            النهاردة
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" size="sm" onClick={() => setMonth(currentMonthStr())} disabled={month === currentMonthStr()}>
            الشهر ده
          </Button>
        </div>
      )}

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

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* المحتوى */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : tab === "attendance" ? (
        <AttendanceReport data={attendance} />
      ) : tab === "unpaid" ? (
        <UnpaidReport data={unpaid} />
      ) : (
        <MonthlyReport
          data={monthly}
          scopeName={
            groupId
              ? groups.find((g) => g.id === groupId)?.name || ""
              : stageId
              ? stages.find((s) => s.id === stageId)?.name || ""
              : "كل المراحل"
          }
        />
      )}
    </div>
  );
}

function CountBanner({ text, count, tone }: { text: string; count: number; tone: "green" | "red" }) {
  const color =
    tone === "green"
      ? "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20"
      : "text-destructive bg-destructive/10";
  return (
    <div className={`rounded-xl px-4 py-3 font-bold flex items-center justify-between ${color}`}>
      <span>{text}</span>
      <span className="text-2xl">{count}</span>
    </div>
  );
}

function AttendanceReport({ data }: { data: { date: string; present_count: number; present: PresentStudent[] } | null }) {
  if (!data) return null;
  if (data.present_count === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>محدش حضر في اليوم ده.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <CountBanner text={`حضروا يوم ${data.date}`} count={data.present_count} tone="green" />
      {data.present.map((s) => (
        <Card key={s.student_id}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash className="w-3 h-3" /> {s.student_number}
              </p>
            </div>
            {s.was_paid ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full px-2 py-0.5 shrink-0">
                <CheckCircle className="w-3 h-3" /> دافع
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 rounded-full px-2 py-0.5 shrink-0">
                <AlertCircle className="w-3 h-3" /> مدفعش
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printMonthly(data: MonthlyData, scopeName: string) {
  const rowsHtml = data.rows
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.group_name)}</td>
        <td class="name">${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.student_number)}</td>
        <td class="center">${r.sessions}</td>
        <td class="center ${r.paid ? "paid" : "unpaid"}">${r.paid ? "دفع" : "مدفعش"}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>تقرير الشهر ${escapeHtml(data.month)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #555; font-size: 13px; margin-bottom: 16px; }
  .stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat { border: 1px solid #ddd; border-radius: 8px; padding: 8px 14px; font-size: 13px; }
  .stat b { display: block; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 7px 8px; text-align: right; }
  th { background: #f3f4f6; font-weight: 700; }
  td.center, th.center { text-align: center; }
  td.name { font-weight: 600; }
  td.paid { color: #15803d; font-weight: 700; }
  td.unpaid { color: #b91c1c; font-weight: 700; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style>
</head>
<body>
  <h1>تقرير الشهر — ${escapeHtml(data.month)}</h1>
  <div class="sub">النطاق: ${escapeHtml(scopeName)} · اتطبع في ${new Date().toLocaleString("ar-EG")}</div>
  <div class="stats">
    <div class="stat">عدد الطلاب <b>${data.students_count}</b></div>
    <div class="stat">إجمالي الحصص <b>${data.total_sessions}</b></div>
    <div class="stat">دفعوا <b>${data.paid_count}</b></div>
    <div class="stat">مدفعوش <b>${data.unpaid_count}</b></div>
    <div class="stat">المحصّل <b>${data.total_collected} ج</b></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>المجموعة</th>
        <th>اسم الطالب</th>
        <th>رقم الطالب</th>
        <th class="center">عدد الحصص</th>
        <th class="center">الدفع</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("الطباعة اتمنعت. اسمح للنوافذ المنبثقة (pop-ups) للموقع.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function MonthlyReport({ data, scopeName }: { data: MonthlyData | null; scopeName: string }) {
  if (!data) return null;
  if (data.students_count === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>مفيش طلاب في النطاق ده.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {/* ملخّص + زرار طباعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-2 text-center">
          <p className="text-xl font-extrabold">{data.total_sessions}</p>
          <p className="text-[11px]">إجمالي الحصص</p>
        </div>
        <div className="rounded-xl bg-muted px-3 py-2 text-center">
          <p className="text-xl font-extrabold">{data.students_count}</p>
          <p className="text-[11px]">عدد الطلاب</p>
        </div>
        <div className="rounded-xl bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-3 py-2 text-center">
          <p className="text-xl font-extrabold">{data.paid_count}</p>
          <p className="text-[11px]">دفعوا</p>
        </div>
        <div className="rounded-xl bg-destructive/10 text-destructive px-3 py-2 text-center">
          <p className="text-xl font-extrabold">{data.unpaid_count}</p>
          <p className="text-[11px]">مدفعوش</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          المحصّل الشهر ده:{" "}
          <span className="font-bold text-foreground">{data.total_collected} ج</span>
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => printMonthly(data, scopeName)}>
          <Printer className="w-4 h-4" />
          طباعة / PDF
        </Button>
      </div>

      {/* الجدول */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-right font-medium px-3 py-2.5">المجموعة</th>
                <th className="text-right font-medium px-3 py-2.5">الطالب</th>
                <th className="text-center font-medium px-3 py-2.5 whitespace-nowrap">عدد الحصص</th>
                <th className="text-center font-medium px-3 py-2.5">الدفع</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.student_id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.group_name}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold">{r.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{r.student_number}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center min-w-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold px-2 py-0.5">
                      {r.sessions}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.paid ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" /> دفع
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircle className="w-3.5 h-3.5" /> مدفعش
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function UnpaidReport({ data }: { data: { month: string; count: number; students: UnpaidStudent[] } | null }) {
  if (!data) return null;
  if (data.count === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-70" />
          <p>كل الطلاب دافعين شهر {data.month} 🎉</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <CountBanner text={`مدفعوش شهر ${data.month}`} count={data.count} tone="red" />
      {data.students.map((s) => (
        <Card key={s.student_id}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" /> {s.student_number}
                </span>
                <span className="flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> {s.monthly_fee} ج
                </span>
              </p>
            </div>
            <a
              href={`tel:${s.parent_phone}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1.5 shrink-0 hover:bg-primary/20 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> اتصل
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
