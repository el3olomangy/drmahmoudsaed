import { useEffect, useRef, useCallback } from "react"

/**
 * Hook يعمل polling تلقائي كل X ثانية
 * بيوقف لما الصفحة مش visible (Tab في الخلفية)
 * وبيشتغل تاني لما الصفحة ترجع
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { savedCallback.current = callback }, [callback])

  const start = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        savedCallback.current()
      }
    }, intervalMs)
  }, [intervalMs])

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) return stop()

    start()

    // وقف لما الـ Tab في الخلفية وشغّل لما يرجع
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        savedCallback.current() // refresh فوري لما يرجع
        start()
      } else {
        stop()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stop()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [enabled, start, stop])
}