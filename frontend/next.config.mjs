import { fileURLToPath } from 'url'
import { dirname } from 'path'

const nextConfig = {
  allowedDevOrigins: ['192.168.1.13'],
  // نثبّت جذر turbopack على مجلد الفرونت إند عشان نتفادى تحذير "أكتر من lockfile"
  // على Vercel (فيه package-lock فاضي في جذر المشروع) ونضمن بناء ثابت.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'drmahmoudsaedpullzone.b-cdn.net',
      },
    ],
  },
}

export default nextConfig
