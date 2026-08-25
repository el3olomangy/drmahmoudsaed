"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useEffect, useState, useCallback } from "react"
import {
  Home, BookOpen, User, LogOut, KeyRound, Bell, ChevronLeft, Sun, Moon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { notificationsAPI } from "@/lib/api"
import { useAutoRefresh } from "@/hooks/useAutoRefresh"

const menuItems = [
  { href: "/dashboard", label: "الصفحة الرئيسية", icon: Home },
  { href: "/dashboard/courses", label: "كورساتي", icon: BookOpen },
  { href: "/dashboard/activate", label: "تفعيل كود", icon: KeyRound },
  { href: "/dashboard/notifications", label: "الإشعارات", icon: Bell },
  { href: "/dashboard/profile", label: "حسابي", icon: User },
]

const gradeLabels: Record<string, string> = {
  first_preparatory: "الصف الأول الإعدادي",
  second_preparatory: "الصف الثاني الإعدادي",
  third_preparatory: "الصف الثالث الإعدادي",
  first_secondary: "الصف الأول الثانوي",
  second_secondary: "الصف الثاني الثانوي",
  third_secondary: "الصف الثالث الثانوي",
}

interface StudentSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function StudentSidebar({ isOpen, onClose }: StudentSidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnread = useCallback(async () => {
    try {
      const notifs = await notificationsAPI.getAll() as any[]
      setUnreadCount(notifs.filter((n: any) => !n.is_read).length)
    } catch {}
  }, [])

  useEffect(() => { if (user) fetchUnread() }, [user])
  useAutoRefresh(fetchUnread, 30000, !!user)

  const handleLogout = () => {
    onClose()
    logout()
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-72 bg-card border-l border-border transform transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <Link href="/">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-BuyHgoZLI0SWgDwWIvZe8lSxWIu1dX.png"
                  alt="العلومنجي"
                  width={130}
                  height={45}
                  className="h-9 w-auto"
                />
              </Link>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-muted"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">
                  أهلاً، {user?.first_name || "..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {user?.grade ? gradeLabels[user.grade] || user.grade : "طالب"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                  onClick={onClose}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                    <span className="mr-auto bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Dark Mode + Logout */}
          <div className="p-4 border-t border-border space-y-2">

            {/* زرار الوضع */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-foreground"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-5 h-5 text-amber-500" />
                  <span className="font-medium">الوضع النهاري</span>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5 text-primary" />
                  <span className="font-medium">الوضع الليلي</span>
                </>
              )}
            </button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              <span>تسجيل الخروج</span>
            </Button>

          </div>
        </div>
      </aside>
    </>
  )
}