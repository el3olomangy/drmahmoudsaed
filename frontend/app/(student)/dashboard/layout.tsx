"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StudentSidebar } from "@/components/student-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { Menu, Sun, Moon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import { FocusModeProvider, useFocusMode } from "@/context/FocusModeContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-loading border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <FocusModeProvider>
      <DashboardShell>{children}</DashboardShell>
    </FocusModeProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { focusMode } = useFocusMode();

  return (
    <div className="min-h-screen bg-muted/30 flex overflow-x-hidden">
      {/* وضع التركيز (أثناء حل امتحان/واجب): نخفي السايدبار بس، من غير ما نغيّر مكان المحتوى */}
      {!focusMode && (
        <StudentSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header — بيختفي في وضع التركيز */}
        {!focusMode && (
          <header className="sticky top-0 z-30 bg-background border-b border-border px-4 h-16 flex items-center justify-between">
            {/* زرار الـ sidebar — بيقفل الإشعارات لو فاتحة عشان ميتفتحوش مع بعض */}
            <button
              onClick={() => {
                setNotificationsOpen(false);
                setSidebarOpen(true);
              }}
              className="p-2 rounded-md hover:bg-muted"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div />

            {/* الأيقونات */}
            <div className="flex items-center gap-1">
              {/* زرار الثيم */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5 text-amber-500" />
                ) : (
                  <Moon className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {/* الإشعارات — بتقفل السايد بار لو فاتح لما تتفتح */}
              <NotificationsBell
                open={notificationsOpen}
                onOpenChange={(next) => {
                  setNotificationsOpen(next);
                  if (next) setSidebarOpen(false);
                }}
              />
            </div>
          </header>
        )}

        <main
          className={
            focusMode ? "flex-1 min-w-0" : "flex-1 p-4 lg:p-8 min-w-0"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
