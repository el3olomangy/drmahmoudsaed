"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { useEffect, useState } from "react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {mounted && (
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="fixed top-4 left-4 z-50 p-2 rounded-xl bg-background border border-border hover:bg-muted transition-colors shadow-sm"
          title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
        >
          {theme === "dark"
            ? <Sun className="w-5 h-5 text-amber-500" />
            : <Moon className="w-5 h-5 text-muted-foreground" />
          }
        </button>
      )}
      {children}
    </div>
  )
}