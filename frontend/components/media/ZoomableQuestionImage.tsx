"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ZoomableQuestionImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * صورة سؤال قابلة للتكبير — الطالب يضغط عليها فتظهر أكبر في المنتصف،
 * ويضغط في أي مكان تاني (أو زرار الإغلاق) عشان ترجع مكانها.
 */
export function ZoomableQuestionImage({
  src,
  alt,
  className,
}: ZoomableQuestionImageProps) {
  const [expanded, setExpanded] = useState(false);

  // إغلاق بزرار Escape كمان
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    // امنع تمرير الصفحة اللي وراها وهي مكبّرة
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => setExpanded(true)}
        role="button"
        tabIndex={0}
        aria-label="اضغط لتكبير الصورة"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded(true);
        }}
        className={`cursor-zoom-in transition-transform hover:opacity-90 ${className || ""}`}
      />

      {expanded && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-150"
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute top-4 left-4 rtl:left-auto rtl:right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain cursor-zoom-out"
          />
        </div>
      )}
    </>
  );
}
