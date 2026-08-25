"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, RotateCcw, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { mediaAPI, type MediaImageCategory, type UploadedMediaImage } from "@/lib/api"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_MB = 8

interface ImageUploaderProps {
  category: MediaImageCategory
  /** الرابط الحالي (لو فيه صورة موجودة بالفعل) */
  value?: string | null
  /** المسار الحالي على Bunny — لازم عشان تقدر تحذفه لو استُبدل */
  valuePath?: string | null
  onChange?: (result: UploadedMediaImage | null) => void
  className?: string
  label?: string
}

type UploadState = "idle" | "uploading" | "success" | "error"

/**
 * مكوّن رفع صورة قابل لإعادة الاستخدام لكل فئات الصور المدعومة:
 * education_stage / course / homework_question / exam_question
 *
 * ملحوظة Phase 1: المكوّن جاهز ومستقل، ولسه مش متوصّل بفورم المرحلة أو
 * الكورس أو أسئلة الواجب/الاختبار — الربط ده هيحصل في Phase 2.
 */
export function ImageUploader({
  category,
  value,
  valuePath,
  onChange,
  className,
  label = "اختر صورة",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [preview, setPreview] = useState<string | null>(value ?? null)
  const [currentPath, setCurrentPath] = useState<string | null>(valuePath ?? null)
  const [state, setState] = useState<UploadState>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const pickFile = () => inputRef.current?.click()

  const handleFile = async (file: File) => {
    setErrorMsg(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg("نوع الملف مش مدعوم — ارفع صورة JPG أو PNG أو WebP")
      setState("error")
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`حجم الصورة أكبر من ${MAX_SIZE_MB}MB`)
      setState("error")
      return
    }

    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setState("uploading")

    try {
      const uploaded = await mediaAPI.uploadImage(file, category)
      const previousPath = currentPath

      setPreview(uploaded.url)
      setCurrentPath(uploaded.path)
      setState("success")
      onChange?.(uploaded)

      // استبدال آمن: نحذف القديمة فقط بعد نجاح رفع الجديدة تمامًا
      if (previousPath && previousPath !== uploaded.path) {
        mediaAPI.deleteImage(previousPath).catch(() => {
          // فشل حذف القديمة مش خطأ حرج — الصورة الجديدة اتحفظت بنجاح بالفعل
        })
      }
    } catch (e: any) {
      setState("error")
      setErrorMsg(e?.message || "فشل رفع الصورة")
      toast({ variant: "destructive", title: "فشل رفع الصورة", description: e?.message })
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const handleRemove = async () => {
    if (currentPath) {
      try {
        await mediaAPI.deleteImage(currentPath)
      } catch {
        // نكمل نمسح من الواجهة حتى لو فشل الحذف على السيرفر — المستخدم قادر يعيد المحاولة
      }
    }
    setPreview(null)
    setCurrentPath(null)
    setState("idle")
    onChange?.(null)
  }

  const isBusy = state === "uploading"

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={onFileInputChange}
        disabled={isBusy}
      />

      {preview ? (
        <div className="relative w-full max-w-xs overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="h-40 w-full object-cover" />

          {isBusy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}

          {!isBusy && (
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-2">
              <Button type="button" size="sm" variant="secondary" onClick={pickFile}>
                <RotateCcw className="ms-1 h-3.5 w-3.5" /> استبدال
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={handleRemove}>
                <Trash2 className="ms-1 h-3.5 w-3.5" /> حذف
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          disabled={isBusy}
          className="flex w-full max-w-xs flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          <span className="text-sm">{isBusy ? "جاري الرفع..." : label}</span>
        </button>
      )}

      {state === "error" && errorMsg && (
        <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
          <X className="h-3.5 w-3.5" /> {errorMsg}
        </p>
      )}
    </div>
  )
}
