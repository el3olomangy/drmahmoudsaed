/**
 * يحول أي رابط فيديو لـ embed URL
 * بيشتغل مع:
 * - YouTube: watch, youtu.be, shorts, embed
 * - Google Drive: /file/d/ID/view → /file/d/ID/preview
 * - روابط مباشرة
 */

// ====== YouTube ======

export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*[&?]v=([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = getYouTubeVideoId(url)
  if (!id) return null
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
}

export function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeVideoId(url)
  if (!id) return null
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
}

export function isYouTubeUrl(url: string): boolean {
  return !!getYouTubeVideoId(url)
}

// ====== Google Drive ======

export function getGoogleDriveFileId(url: string): string | null {
  if (!url) return null
  // /file/d/FILE_ID/view  أو  /file/d/FILE_ID/edit  أو  ?id=FILE_ID
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function getGoogleDriveEmbedUrl(url: string): string | null {
  const id = getGoogleDriveFileId(url)
  if (!id) return null
  return `https://drive.google.com/file/d/${id}/preview`
}

export function isGoogleDriveUrl(url: string): boolean {
  return !!getGoogleDriveFileId(url)
}

// ====== Bunny Stream ======

// روابط تشغيل Bunny Stream اللي بنولّدها في backend/app/services/bunny_stream.py
// عبر get_playback_iframe_url — دايمًا بالشكل:
// https://iframe.mediadelivery.net/embed/{library_id}/{video_id}
export function isBunnyStreamUrl(url: string): boolean {
  if (!url) return false
  return /iframe\.mediadelivery\.net\/embed\//.test(url)
}

// ====== Universal ======

export type VideoType = "youtube" | "drive" | "bunny" | "direct"

export function detectVideoType(url: string): VideoType {
  if (isYouTubeUrl(url)) return "youtube"
  if (isGoogleDriveUrl(url)) return "drive"
  if (isBunnyStreamUrl(url)) return "bunny"
  return "direct"
}

export function getEmbedUrl(url: string): string {
  if (isYouTubeUrl(url)) return getYouTubeEmbedUrl(url) || url
  if (isGoogleDriveUrl(url)) return getGoogleDriveEmbedUrl(url) || url
  return url
}

// ====== لصق رابط الفيديو يدويًا (بدل الرفع المباشر) ======

/**
 * بيطلّع رابط الفيديو من اللي المستخدم لصقه. بيقبل:
 * - رابط مباشر (Bunny embed / YouTube / Google Drive / أي https)
 * - كود <iframe ... src="..."> كامل (بياخد الـ src منه)
 */
export function extractVideoUrlFromInput(raw: string): string {
  if (!raw) return ""
  let v = raw.trim()
  const srcMatch = v.match(/src\s*=\s*["']([^"']+)["']/i)
  if (srcMatch) v = srcMatch[1].trim()
  return v
}

/**
 * بيتأكد إن الرابط الملصوق نوع مدعوم من المشغّل (Bunny / YouTube / Drive /
 * رابط مباشر https). بيمنع حفظ نص عشوائي مش رابط.
 */
export function isSupportedVideoUrl(url: string): boolean {
  if (!url) return false
  const v = url.trim()
  if (isBunnyStreamUrl(v) || isYouTubeUrl(v) || isGoogleDriveUrl(v)) return true
  return /^https?:\/\/.+/i.test(v)
}