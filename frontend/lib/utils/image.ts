/**
 * يحول رابط Google Drive لرابط صورة مباشر
 */
export function getGoogleDriveImageUrl(url: string): string {
  if (!url) return url
  if (!url.includes("drive.google.com")) return url
  if (url.includes("uc?") && url.includes("export=view")) return url
  if (url.includes("uc?") && url.includes("id=")) {
    const id = url.match(/id=([a-zA-Z0-9_-]+)/)?.[1]
    if (id) return `https://drive.google.com/uc?export=view&id=${id}`
  }
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`
  }
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (openMatch) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`
  }
  return url
}

export function isGoogleDriveUrl(url: string): boolean {
  return url?.includes("drive.google.com") ?? false
}

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1")
  .replace("/api/v1", "")

/**
 * يحول أي رابط صورة لرابط يشتغل في <img>
 * - Google Drive → thumbnail URL
 * - رابط نسبي /static/... → يضيف الـ backend URL
 * - رابط كامل → كما هو
 * - فاضي أو null → null
 */
export function getImageUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null

  // Google Drive: /file/d/FILE_ID/view
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (driveMatch) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w800`
  }

  // Google Drive open link
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
  if (driveOpenMatch) {
    return `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w800`
  }

  // رابط نسبي من الـ backend (مرفوع من الجهاز)
  if (url.startsWith("/static/") || url.startsWith("/uploads/")) {
    return `${BACKEND_URL}${url}`
  }

  // رابط كامل — رجّعه كما هو
  return url
}