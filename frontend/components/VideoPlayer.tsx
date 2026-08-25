"use client";

import { useEffect, useState } from "react";
import { getEmbedUrl } from "@/lib/utils/video";

interface VideoPlayerProps {
  url: string;
  watermark?: string;
  // بنسيب الـ props دي عشان أماكن الاستخدام ما تتكسرش — بس المشغّل بقى
  // بيعتمد على مشغّل كل منصة (iframe) فمش بيتتبّع الوقت بنفسه.
  lectureId?: string;
  initialPosition?: number;
  onProgress?: (position: number, duration: number) => void;
}

/**
 * مشغّل الفيديو — بيعتمد على المشغّل الرسمي لكل منصة عبر iframe:
 * - Bunny Stream: رابط embed الرسمي (iframe.mediadelivery.net/embed/...)
 * - YouTube / Google Drive: رابط الـ embed بتاعهم
 * - أي رابط تاني: بيتحط في iframe زي ما هو
 *
 * العلامة المائية (اسم/رقم الطالب) بتفضل فوق الفيديو للحماية من التسريب،
 * وبتتحرك مكانها كل شوية.
 */
export default function VideoPlayer({ url, watermark }: VideoPlayerProps) {
  const [pos, setPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    if (!watermark) return;
    const move = () =>
      setPos({ x: Math.random() * 60 + 20, y: Math.random() * 60 + 20 });
    move();
    const id = setInterval(move, 5000);
    return () => clearInterval(id);
  }, [watermark]);

  if (!url) {
    return (
      <div className="aspect-video bg-black flex items-center justify-center text-white/60">
        <p>الفيديو مش متاح</p>
      </div>
    );
  }

  const src = getEmbedUrl(url);

  return (
    <div className="relative aspect-video bg-black">
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
        onContextMenu={(e) => e.preventDefault()}
      />
      {watermark && (
        <div
          className="absolute text-white/40 text-sm font-bold pointer-events-none select-none transition-all duration-1000 z-20"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: "translate(-50%, -50%)",
            textShadow: "1px 1px 3px rgba(0,0,0,0.9)",
          }}
        >
          {watermark}
        </div>
      )}
    </div>
  );
}
