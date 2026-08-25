"use client"

import { useState } from "react"
import { BookOpen } from "lucide-react"
import { getImageUrl } from "@/lib/utils/image"

interface CourseImageProps {
  thumbnail?: string | null
  title: string
  className?: string
}

/**
 * مكون موحد لعرض صورة الكورس مع fallback تلقائي لو الصورة فشلت
 */
export function CourseImage({ thumbnail, title, className = "absolute inset-0 w-full h-full object-cover" }: CourseImageProps) {
  const [failed, setFailed] = useState(false)
  const src = getImageUrl(thumbnail)

  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted">
        <BookOpen className="w-10 h-10 text-muted-foreground/40" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
   />
    )
}