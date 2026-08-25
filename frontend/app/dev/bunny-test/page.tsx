"use client"

// صفحة اختبار منعزلة لتطوير تكامل Bunny.net فقط — مش موجودة في أي قائمة تنقل
// وغير مخصصة للطلاب. الوصول محمي بصلاحية مدرس/مساعد فقط عبر الـ API نفسه
// (كل الـ endpoints تحتاج JWT بصلاحية teacher/assistant أصلًا).

import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { ImageUploader } from "@/components/media/ImageUploader"
import { LectureVideoUploader } from "@/components/media/LectureVideoUploader"
import type { LectureVideoInfo, UploadedMediaImage } from "@/lib/api"

export default function BunnyDevTestPage() {
  const { user, isLoading } = useAuth()
  const [image, setImage] = useState<UploadedMediaImage | null>(null)
  const [video, setVideo] = useState<LectureVideoInfo | null>(null)

  if (isLoading) return <div className="p-8">جاري التحميل...</div>

  if (!user || (user.role !== "teacher" && user.role !== "assistant")) {
    return (
      <div className="p-8 text-destructive">
        هذه صفحة اختبار داخلية لفريق التطوير فقط — تحتاج تسجيل دخول بحساب مدرس أو مساعد.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 p-8" dir="rtl">
      <div>
        <h1 className="text-xl font-bold">صفحة اختبار Bunny.net (Phase 1 — للتطوير فقط)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          هذه الصفحة مش موجودة في أي قائمة تنقل، والغرض منها فقط التأكد من عمل تكامل Bunny Storage و
          Bunny Stream قبل ربطهم بفورمات المرحلة/الكورس/الأسئلة/المحاضرات في Phase 2.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">اختبار الصور (Bunny Storage)</h2>
        <ImageUploader category="course" label="اختر صورة اختبار" onChange={setImage} />
        {image && (
          <pre className="rounded bg-muted p-3 text-xs" dir="ltr">
            {JSON.stringify(image, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">اختبار الفيديو (Bunny Stream)</h2>
        <LectureVideoUploader onChange={setVideo} />
        {video && (
          <pre className="rounded bg-muted p-3 text-xs" dir="ltr">
            {JSON.stringify(video, null, 2)}
          </pre>
        )}
      </section>
    </div>
  )
}
