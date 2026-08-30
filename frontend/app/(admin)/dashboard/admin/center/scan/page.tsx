"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { centerAPI } from "@/lib/api";
import {
  cacheStudents,
  lookupStudent,
  enqueueScan,
  queueCount,
  syncQueue,
  cachedStudentsCount,
  getStudentsSyncedAt,
} from "@/lib/center-offline";
import { Button } from "@/components/ui/button";
import {
  Camera,
  CameraOff,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight,
  Phone,
  Hash,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudUpload,
  CalendarCheck,
} from "lucide-react";

interface ScanStudent {
  id?: string;
  name: string;
  student_number: string;
  parent_phone: string;
  paid_current_month: boolean;
  sessions_this_month?: number;
}
interface ScanResult {
  status: "recorded" | "already" | "not_found" | "queued";
  student?: ScanStudent;
  message?: string;
  offline?: boolean;
  at: number;
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ token: string; time: number }>({ token: "", time: 0 });
  const processingRef = useRef(false);

  const [active, setActive] = useState(false);
  const [camError, setCamError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);

  // حالة الأوفلاين
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [cacheAt, setCacheAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshCounters = useCallback(async () => {
    setPending(await queueCount());
    setCachedCount(await cachedStudentsCount());
    setCacheAt(await getStudentsSyncedAt());
  }, []);

  // ===== مزامنة الطابور =====
  const doSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      await syncQueue();
    } catch {
      /* هنعيد المحاولة تلقائيًا */
    } finally {
      setSyncing(false);
      refreshCounters();
    }
  }, [refreshCounters]);

  // ===== تحميل بيانات الطلاب للأوفلاين =====
  const refreshCache = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setRefreshing(true);
    try {
      const res: any = await centerAPI.getAllStudents();
      await cacheStudents(res.students || []);
    } catch {
      /* تجاهل */
    } finally {
      setRefreshing(false);
      refreshCounters();
    }
  }, [refreshCounters]);

  // عند فتح الصفحة: نحدّث العدادات، ولو فيه نت نزامن ونحدّث الكاش
  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    refreshCounters();
    if (typeof navigator !== "undefined" && navigator.onLine) {
      doSync();
      refreshCache();
    }

    const goOnline = () => {
      setOnline(true);
      doSync();
      refreshCache();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== معالجة توكن اتقرأ =====
  const handleToken = useCallback(
    async (token: string) => {
      const now = Date.now();
      if (
        processingRef.current ||
        (token === lastScanRef.current.token && now - lastScanRef.current.time < 3000)
      ) {
        return;
      }
      processingRef.current = true;
      lastScanRef.current = { token, time: now };
      setBusy(true);

      const isOnline = typeof navigator === "undefined" || navigator.onLine;
      const nowIso = new Date().toISOString();

      const finish = () => {
        setBusy(false);
        setTimeout(() => {
          processingRef.current = false;
        }, 1500);
      };

      // أونلاين: نبعت للسيرفر مباشرة
      if (isOnline) {
        try {
          const res: any = await centerAPI.scan(token, nowIso);
          setResult({
            status: res.status,
            student: res.student,
            message: res.message,
            offline: false,
            at: Date.now(),
          });
          if (navigator.vibrate) navigator.vibrate(res.status === "not_found" ? [80, 40, 80] : 60);
          doSync();
          finish();
          return;
        } catch {
          /* النت وقع فجأة — ننزل للأوفلاين */
        }
      }

      // أوفلاين: نخزّن في الطابور ونعرّف الطالب من الكاش المحلي
      await enqueueScan(token, nowIso);
      const cached = await lookupStudent(token);
      if (cached) {
        setResult({
          status: "recorded",
          offline: true,
          student: {
            name: cached.name,
            student_number: cached.student_number,
            parent_phone: cached.parent_phone,
            paid_current_month: cached.paid_current_month,
          },
          message: "اتسجّل محليًا — هيترفع لما النت يرجع",
          at: Date.now(),
        });
      } else {
        setResult({
          status: "queued",
          offline: true,
          message: "اتسجّل محليًا وهيترفع لما النت يرجع (الطالب مش محفوظ على الجهاز)",
          at: Date.now(),
        });
      }
      if (navigator.vibrate) navigator.vibrate(60);
      setPending(await queueCount());
      finish();
    },
    [doSync],
  );

  // ===== الكاميرا =====
  const startCamera = useCallback(async () => {
    setCamError("");
    setResult(null);
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (res) => {
          if (res) handleToken(res.getText());
        },
      );
      controlsRef.current = controls;
      setActive(true);
    } catch (err: any) {
      setActive(false);
      const msg = err?.message || "";
      if (msg.includes("Permission") || err?.name === "NotAllowedError") {
        setCamError("مفيش إذن للكاميرا. اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح.");
      } else if (err?.name === "NotFoundError") {
        setCamError("مفيش كاميرا في الجهاز.");
      } else {
        setCamError("مقدرناش نفتح الكاميرا. جرّب تقفل تطبيقات تانية بتستخدمها.");
      }
    }
  }, [handleToken]);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {}
    };
  }, []);

  // ===== ستايل النتيجة =====
  const resultStyle = (() => {
    if (!result) return null;
    if (result.status === "not_found") {
      return {
        bg: "bg-destructive/10 border-destructive/30",
        icon: <XCircle className="w-8 h-8 text-destructive" />,
        title: "الكود مش متعرّف عليه",
        titleColor: "text-destructive",
      };
    }
    if (result.status === "queued") {
      return {
        bg: "bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800",
        icon: <CloudUpload className="w-8 h-8 text-blue-600" />,
        title: "اتسجّل — هيترفع لما النت يرجع",
        titleColor: "text-blue-700 dark:text-blue-400",
      };
    }
    const paid = result.student?.paid_current_month;
    if (!paid) {
      return {
        bg: "bg-destructive/10 border-destructive/40",
        icon: <AlertCircle className="w-8 h-8 text-destructive" />,
        title: result.status === "already" ? "مسجّل حضور — لكن مدفعش!" : "تم الحضور — لكن مدفعش!",
        titleColor: "text-destructive",
      };
    }
    return {
      bg: "bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-800",
      icon: <CheckCircle className="w-8 h-8 text-green-600" />,
      title: result.status === "already" ? "مسجّل حضور قبل كده" : "تم تسجيل الحضور",
      titleColor: "text-green-700 dark:text-green-400",
    };
  })();

  const fmtTime = (t: number | null) => {
    if (!t) return "لسه متحدّثش";
    const d = new Date(t);
    return d.toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <Link
        href="/dashboard/admin/center"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع للسنتر
      </Link>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Camera className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">اسكان الحضور</h1>
        </div>
        {online ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full px-2 py-1">
            <Wifi className="w-3.5 h-3.5" /> متصل
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 rounded-full px-2 py-1">
            <WifiOff className="w-3.5 h-3.5" /> بدون نت — بيتسجّل محليًا
          </span>
        )}
      </div>

      <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-2/3 h-2/3 border-4 border-white/70 rounded-2xl" />
          </div>
        )}
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <CameraOff className="w-12 h-12" />
            <p className="text-sm">الكاميرا مقفولة</p>
          </div>
        )}
        {busy && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
            جاري التسجيل...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!active ? (
          <Button onClick={startCamera} className="flex-1 gap-2">
            <Camera className="w-4 h-4" />
            ابدأ الاسكان
          </Button>
        ) : (
          <Button onClick={stopCamera} variant="outline" className="flex-1 gap-2">
            <CameraOff className="w-4 h-4" />
            إيقاف
          </Button>
        )}
      </div>

      {camError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {camError}
        </div>
      )}

      {result && resultStyle && (
        <div className={`rounded-2xl border p-5 ${resultStyle.bg}`}>
          <div className="flex items-center gap-3">
            {resultStyle.icon}
            <div className="min-w-0">
              <p className={`font-bold text-lg ${resultStyle.titleColor}`}>{resultStyle.title}</p>
              {result.student && (
                <p className="font-bold text-foreground truncate">{result.student.name}</p>
              )}
            </div>
          </div>

          {result.student && (
            <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" /> رقم الطالب: {result.student.student_number}
              </span>
              {typeof result.student.sessions_this_month === "number" && (
                <span className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                  <CalendarCheck className="w-3.5 h-3.5" /> حضر {result.student.sessions_this_month} حصة الشهر ده
                </span>
              )}
              {!result.student.paid_current_month && (
                <span className="flex items-center gap-2 text-destructive font-medium">
                  <Phone className="w-3.5 h-3.5" /> كلّم ولي الأمر: {result.student.parent_phone}
                </span>
              )}
            </div>
          )}

          {(result.status === "not_found" || result.status === "queued") && result.message && (
            <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
          )}
          {result.offline && result.status === "recorded" && (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">{result.message}</p>
          )}
        </div>
      )}

      {/* لوحة الأوفلاين */}
      <div className="rounded-2xl border border-border p-4 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">اسكانات مستنية الرفع</span>
          <span className={`font-bold ${pending > 0 ? "text-orange-600" : "text-foreground"}`}>
            {pending}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">طلاب محفوظين على الجهاز</span>
          <span className="font-bold">{cachedCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">آخر تحديث للبيانات</span>
          <span className="text-xs">{fmtTime(cacheAt)}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1"
            onClick={doSync}
            disabled={syncing || !online || pending === 0}
          >
            <CloudUpload className={`w-4 h-4 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "بيرفع..." : "ارفع دلوقتي"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1"
            onClick={refreshCache}
            disabled={refreshing || !online}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "بيحدّث..." : "حدّث بيانات الطلاب"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          قبل ما تروح مكان مفيهوش نت، افتح الصفحة دي وانت متصل واضغط "حدّث بيانات الطلاب" —
          كده الأسماء وحالة الدفع تبقى محفوظة على الجهاز، والاسكان يشتغل من غير نت ويترفع لوحده لما ترجع تتصل.
        </p>
      </div>
    </div>
  );
}
