"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Menu, X, Sun, Moon } from "lucide-react"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"

function ThemeButton({ mounted, isDark, onToggle, className = "" }: {
  mounted: boolean
  isDark: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      onClick={onToggle}
      className={`p-2 rounded-xl hover:bg-muted transition-colors ${className}`}
      title={isDark ? "الوضع النهاري" : "الوضع الليلي"}
      suppressHydrationWarning
    >
      {/* لما مش mounted نعرض placeholder بنفس الحجم */}
      {!mounted
        ? <div className="w-5 h-5" />
        : isDark
          ? <Sun className="w-5 h-5 text-amber-500" />
          : <Moon className="w-5 h-5 text-muted-foreground" />
      }
    </button>
  )
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // لازم ننتظر الـ mount عشان نعرف الثيم الحقيقي
  useEffect(() => { setMounted(true) }, [])

  const isDark = mounted && theme === "dark"
  const handleToggleTheme = () => setTheme(isDark ? "light" : "dark")

  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-BuyHgoZLI0SWgDwWIvZe8lSxWIu1dX.png"
              alt="العلومنجي"
              width={140}
              height={50}
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <ThemeButton mounted={mounted} isDark={isDark} onToggle={handleToggleTheme} />
            <Button variant="ghost" asChild>
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/register">اعمل حساب جديد</Link>
            </Button>
          </nav>

          {/* Mobile: ثيم + هامبرجر */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeButton mounted={mounted} isDark={isDark} onToggle={handleToggleTheme} />
            <button
              className="p-2"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <nav className="md:hidden py-4 border-t border-border flex flex-col gap-2">
            <Button variant="ghost" asChild className="w-full justify-center">
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/register">اعمل حساب جديد</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  )
}