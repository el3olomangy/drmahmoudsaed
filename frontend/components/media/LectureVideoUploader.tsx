"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Film, Loader2, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { mediaAPI, type LectureVideoInfo, type LectureVideoStatus, type TusUploadCredentials } from "@/lib/api"

const MAX_SIZE_MB = 3000 // ٣ جيجا تقريبًا — حدّ معقول لفيديو محاضرة

interface LectureVideoUploaderProps {
  value?: LectureVideoInfo | null
  onChange?: (video: LectureVideoInfo | null) => void
  className?: string
  /**
   * مفتاح ثابت (مثلاً معرّف المحاضرة أو مكان إضافتها) بنحفظ بيه حالة الرفع في
   * localStorage. لو حصل refresh للصفحة أثناء الرفع أو المعالجة، بنكمّل من
   * نفس النقطة بدل ما نضيّع الفيديو اللي فعلاً اترفع على Bunny ونضطر
   * المستخدم يرفع من الأول تاني.
   */
  persistKey?: string
}

type LocalState = "idle" | "uploading" | "processing" | "ready" | "failed"

const STATUS_LABEL: Record<LectureVideoStatus, string> = {
  uploading: "جاري رفع الفيديو...",
  processing: "جاري معالجة الفيديو على Bunny...",
  ready: "الفيديو جاهز للعرض",
  failed: "فشلت معالجة الفيديو",
}

interface PersistedUpload {
  video_id: string
  tus: TusUploadCredentials
}

function persistStorageKey(key: string) {
  return `bunny-upload:${key}`
}

function loadPersistedUpload(key: string): PersistedUpload | null {
  try {
    const raw = localStorage.getItem(persistStorageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedUpload
    // التوقيع المؤقت بيصلح ٦ ساعات بس (شوف build_tus_upload_credentials في
    // الباك اند) — لو خلصت صلاحيته منتفعش نستخدمه تاني
    if (!parsed?.tus?.expiration_time || parsed.tus.expiration_time * 1000 < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

function savePersistedUpload(key: string, data: PersistedUpload | null) {
  try {
    if (data) localStorage.setItem(persistStorageKey(key), JSON.stringify(data))
    else localStorage.removeItem(persistStorageKey(key))
  } catch {
    // لو localStorage مش متاح (خصوصية المتصفح مثلاً) بنكمل عادي من غير حفظ
  }
}

/**
 * مكوّن رفع فيديو محاضرة قابل لإعادة الاستخدام — يعتمد على Bunny Stream حصريًا.
 *
 * Phase 3: الرفع بقى مباشر من المتصفح لـ Bunny (بروتوكول TUS resumable
 * upload) من غير ما يعدي على الباك اند بتاعنا خالص — ضروري لأي استضافة
 * serverless زي Vercel (حدود صغيرة لحجم الطلب ومدة التنفيذ). الباك اند دوره
 * بس إنه يـ"وقّع" تصريح رفع مؤقت وآمن. بعد ما يخلص معالجة على Bunny، بيرجّع
 * `playback_url` جاهز نخزّنه كـ video_url للمحاضرة.
 */
export function LectureVideoUploader({ value, onChange, className, persistKey }: LectureVideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // لو مفيش value صريحة (مش تعديل محاضرة موجودة) بنتأكد لو فيه رفع سابق
  // محفوظ في localStorage عشان نبدأ بيه بدل حالة "idle" فاضية
  const persisted = !value && persistKey ? loadPersistedUpload(persistKey) : null

  const [video, setVideo] = useState<LectureVideoInfo | null>(
    value ?? (persisted ? { video_id: persisted.video_id, status: "processing" } : null)
  )
  const [state, setState] = useState<LocalState>(
    value ? (value.status as LocalState) : persisted ? "processing" : "idle"
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  // بنسيب تصريح الرفع (video_id + tus credentials) هنا حتى لو الرفع فشل،
  // عشان زرار "إعادة المحاولة" يعيد استخدام نفس السجل على Bunny بدل ما يعمل
  // سجل جديد كل مرة — وTUS كمان بيقدر يكمّل من نفس البايت اللي وقف عنده
  // (مش هيرفع من الأول) لو نفس الملف اتختار تاني
  const pendingRef = useRef<PersistedUpload | null>(persisted)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const startPolling = (videoId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const info = await mediaAPI.getVideoStatus(videoId)
        setVideo(info)
        setState(info.status as LocalState)
        onChange?.(info)
        if (info.status === "ready" || info.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current)
          if (info.status === "ready") {
            pendingRef.current = null
            if (persistKey) savePersistedUpload(persistKey, null)
          }
        }
      } catch {
        // بنسيب الـ polling يحاول تاني في الدورة الجاية بدل ما نوقف المستخدم فجأة
      }
    }, 5000)
  }

  // لو استرجعنا رفع محفوظ من قبل refresh، نتأكد من حالته الحقيقية على Bunny
  // فورًا (ممكن يكون خلص فعلاً وهو الصفحة كانت مقفولة) بدل ما نستنى دورة
  // الـ polling الأولى
  useEffect(() => {
    if (!persisted) return
    ;(async () => {
      try {
        const info = await mediaAPI.getVideoStatus(persisted.video_id)
        if (info.status === "ready") {
          setVideo(info)
          setState("ready")
          onChange?.(info)
          pendingRef.current = null
          if (persistKey) savePersistedUpload(persistKey, null)
        } else if (info.status === "processing") {
          // الملف وصل بالكامل لـ Bunny وبيتعالج — تكملة عادية بالـ polling
          setVideo(info)
          setState("processing")
          onChange?.(info)
          startPolling(persisted.video_id)
        } else {
          // status "uploading" هنا معناها إن ملف الفيديو نفسه لسه ما وصلش
          // لـ Bunny بالكامل — بيحصل لما الصفحة تتحدّث أثناء الرفع الفعلي.
          // بروتوكول TUS بيسمح لنا نكمّل من نفس البايت (مش نرفع من الأول)
          // لو المستخدم اختار نفس الملف تاني، فبنطلب منه يعيد الاختيار بس
          setErrorMsg("الرفع اتقطع (حصل تحديث للصفحة أثناء الرفع) — اختر نفس الملف تاني وهيكمّل من نفس النقطة")
          setState("failed")
        }
      } catch {
        // السيرفر ممكن يكون مش متاح لحظيًا — نسيب الـ polling يحاول تاني
        startPolling(persisted.video_id)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickFile = () => inputRef.current?.click()

  const handleFile = async (file: File) => {
    setErrorMsg(null)

    if (!file.type.startsWith("video/")) {
      setErrorMsg("الملف المختار مش فيديو")
      setState("failed")
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`حجم الفيديو أكبر من الحد المسموح (${MAX_SIZE_MB}MB)`)
      setState("failed")
      return
    }

    setState("uploading")
    setUploadProgress(0)
    try {
      // لو فيه سجل فيديو اتعمل قبل كده وفشل رفعه (وتصريح الرفع لسه صالح)،
      // نعيد استخدامه بدل ما نعمل سجل جديد على Bunny في كل محاولة
      const pending = pendingRef.current ?? (await mediaAPI.createLectureVideo(file.name))
      pendingRef.current = pending
      if (persistKey) savePersistedUpload(persistKey, pending)

      await mediaAPI.uploadVideoFile(pending.tus, file, setUploadProgress)

      const created: LectureVideoInfo = { video_id: pending.video_id, status: "processing" }
      // ملحوظة: مبنمسحش الحفظ المحلي هنا لسه — لسه "processing" مش "ready"،
      // لو حصل refresh دلوقتي محتاجين نفضل نقدر نكمّل نتابع نفس الفيديو
      setVideo(created)
      setState("processing")
      onChange?.(created)
      startPolling(created.video_id)
    } catch (e: any) {
      setState("failed")
      setErrorMsg(e?.message || "فشل رفع الفيديو")
      toast({ variant: "destructive", title: "فشل رفع الفيديو", description: e?.message })
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const handleRetry = () => {
    setErrorMsg(null)
    setState("idle")
    pickFile()
  }

  const handleRemove = async () => {
    if (video?.video_id) {
      try {
        await mediaAPI.deleteLectureVideo(video.video_id)
      } catch {
        // نكمل نمسح من الواجهة حتى لو فشل الحذف — المستخدم قادر يعيد المحاولة لاحقًا
      }
    }
    if (pollRef.current) clearInterval(pollRef.current)
    pendingRef.current = null
    if (persistKey) savePersistedUpload(persistKey, null)
    setVideo(null)
    setState("idle")
    onChange?.(null)
  }

  const isBusy = state === "uploading" || state === "processing"

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={onFileInputChange} disabled={isBusy} />

      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">فيديو الحصة (Bunny Stream)</span>
        </div>

        {state === "idle" && (
          <Button type="button" variant="outline" onClick={pickFile}>
            اختر فيديو المحاضرة
          </Button>
        )}

        {isBusy && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {state === "uploading"
                ? `${STATUS_LABEL.uploading} (${uploadProgress}%)`
                : STATUS_LABEL[state as LectureVideoStatus] || "جاري المعالجة..."}
            </div>
            {state === "uploading" && <Progress value={uploadProgress} />}
          </div>
        )}

        {state === "ready" && video && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {STATUS_LABEL.ready}
            </div>
            <Button type="button" size="sm" variant="destructive" onClick={handleRemove}>
              <Trash2 className="ms-1 h-3.5 w-3.5" /> حذف
            </Button>
          </div>
        )}

        {state === "failed" && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {errorMsg || STATUS_LABEL.failed}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={handleRetry}>
              <RotateCcw className="ms-1 h-3.5 w-3.5" /> إعادة المحاولة
            </Button>
          </div>
        )}

        {video?.video_id && (
          <p className="text-xs text-muted-foreground">Video ID: {video.video_id}</p>
        )}
      </div>
    </div>
  )
}
