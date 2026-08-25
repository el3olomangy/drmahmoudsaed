"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { getYouTubeEmbedUrl, getYouTubeThumbnail, isYouTubeUrl } from "@/lib/utils/video"

interface VideoPlayerProps {
  url: string
  watermark?: string  // اسم الطالب للـ watermark
}

export function VideoPlayer({ url, watermark }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [watermarkPos, setWatermarkPos] = useState({ x: 50, y: 50 })
  const [thumbError, setThumbError] = useState(false)

  const isYT = isYouTubeUrl(url)
  const embedUrl = isYT ? getYouTubeEmbedUrl(url) : url
  const thumbnail = isYT ? getYouTubeThumbnail(url) : null

  // تحريك الـ watermark كل 5 ثواني
  const startWatermark = () => {
    const move = () => setWatermarkPos({
      x: Math.random() * 60 + 20,
      y: Math.random() * 60 + 20,
    })
    move()
    setInterval(move, 5000)
  }

  const handlePlay = () => {
    setIsPlaying(true)
    if (watermark) startWatermark()
  }

  // لو مش يوتيوب → iframe عادي مع watermark
  if (!isYT) {
    return (
      <div className="relative aspect-video bg-black">
        <iframe
          src={url}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {watermark && (
          <Watermark text={watermark} x={watermarkPos.x} y={watermarkPos.y} />
        )}
      </div>
    )
  }

  // يوتيوب → thumbnail + play button → بعدين iframe
  return (
    <div className="relative aspect-video bg-black group">
      {!isPlaying ? (
        <>
          {/* Thumbnail */}
          {thumbnail && !thumbError ? (
            <img
              src={thumbnail}
              alt="thumbnail"
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setThumbError(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-zinc-900" />
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

          {/* Play button */}
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center"
            aria-label="تشغيل الفيديو"
          >
            <div className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all group-hover:scale-110 shadow-2xl">
              <Play className="w-8 h-8 text-white fill-white -mr-0.5" />
            </div>
          </button>

          {/* YouTube badge */}
          <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-red-500">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.8 15.5V8.5l6.3 3.5-6.3 3.5z"/>
            </svg>
            YouTube
          </div>
        </>
      ) : (
        <>
          {/* الـ iframe بيشتغل بعد الضغط على play */}
          <iframe
            src={`${embedUrl}&autoplay=1`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            autoFocus
          />
          {/* Watermark فوق الـ iframe */}
          {watermark && (
            <Watermark text={watermark} x={watermarkPos.x} y={watermarkPos.y} />
          )}
        </>
      )}
    </div>
  )
}

// ====== Watermark ======
function Watermark({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <div
      className="absolute text-white/40 text-sm font-bold pointer-events-none select-none transition-all duration-1000 z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        textShadow: "1px 1px 3px rgba(0,0,0,0.9)",
      }}
    >
      {text}
    </div>
  )
}