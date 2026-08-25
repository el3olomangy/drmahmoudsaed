"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationsAPI } from "@/lib/api";
import {
  AppNotification,
  getNotificationConfig,
  timeAgo,
} from "@/lib/notification-config";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

// المسافة الآمنة بين البانل وأطراف الشاشة عشان ميقعش برة الفيو بورت أبدًا
const EDGE_MARGIN = 12;
const PANEL_MAX_WIDTH = 384; // = w-96

interface NotificationsBellProps {
  /** تحكم خارجي اختياري (مثلاً من الليّ أوت عشان تقفل السايد بار لما البانل يتفتح) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NotificationsBell({
  open: openProp,
  onOpenChange,
}: NotificationsBellProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;

  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === "function" ? (value as (p: boolean) => boolean)(open) : value;
      onOpenChange?.(next);
      if (openProp === undefined) setInternalOpen(next);
    },
    [open, openProp, onOpenChange],
  );

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number; width: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // بيحسب مكان ظهور البانل بالنسبة للشاشة نفسها (مش بالنسبة لعنصر ضيق جوه الهيدر)
  // عشان يفضل جوه حدود الشاشة على أي جهاز، ويطلع فوق أي عنصر تاني زي السايد بار
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.min(PANEL_MAX_WIDTH, viewportWidth - EDGE_MARGIN * 2);

    let right = viewportWidth - rect.right; // محاذاة حافة البانل مع حافة الزرار
    const maxRight = viewportWidth - width - EDGE_MARGIN;
    if (right > maxRight) right = maxRight;
    if (right < EDGE_MARGIN) right = EDGE_MARGIN;

    let top = rect.bottom + 8;
    // احتياط لو في مساحة قليلة تحت (شاشات قصيرة جدًا أو الكيبورد ظاهر)
    if (top > viewportHeight - 120) top = Math.max(EDGE_MARGIN, viewportHeight - 320);

    setCoords({ top, right, width });
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = (await notificationsAPI.getAll()) as AppNotification[];
      setNotifications(data);
    } catch {
      // فشل التحديث الصامت — مش هنعرض إيرور جوه القايمة، هيبان زر إعادة المحاولة لو فاضية
    } finally {
      setHasLoadedOnce(true);
    }
  }, []);

  // تحديث دوري في الخلفية عشان النقطة الحمرا تفضل صح حتى لو القايمة مقفولة
  useAutoRefresh(fetchNotifications, 30000, true);

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // اقفل القايمة لما تدوس في أي مكان تاني في الصفحة، أو تدوس Escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, setOpen]);

  // إعادة حساب مكان البانل لما يتفتح، ولما حجم الشاشة يتغير أو الجهاز يتلف (orientation)
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("orientationchange", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("orientationchange", updatePosition);
    };
  }, [open, updatePosition]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsLoading(true);
        fetchNotifications().finally(() => setIsLoading(false));
      }
      return next;
    });
  };

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    try {
      await notificationsAPI.markRead(id);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
    } finally {
      setIsMarkingAll(false);
    }
  };

  const recent = notifications.slice(0, 20);

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="relative"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 left-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </Button>

      {open && (
        <>
          {/* طبقة تعتيم خلف البانل — بتوضح إن فيه بانل مفتوح وبتقفله عند الدوس عليها */}
          <div
            className="fixed inset-0 z-[90] bg-black/30 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* البانل بيتحسب مكانه بالنسبة للشاشة نفسها مش لعنصر ضيق جوه الهيدر،
              وz-index عالي عشان يفضل فوق السايد بار مهما كان مفتوح */}
          <div
            role="dialog"
            aria-label="الإشعارات"
            style={
              coords
                ? {
                    top: coords.top,
                    right: coords.right,
                    width: coords.width,
                    maxHeight: `min(28rem, calc(100vh - ${coords.top}px - ${EDGE_MARGIN}px))`,
                  }
                : undefined
            }
            className="fixed z-[100] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden invisible opacity-0 data-[ready=true]:visible data-[ready=true]:opacity-100 transition-opacity"
            data-ready={!!coords}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="font-bold text-sm flex items-center gap-2">
                الإشعارات
                {unreadCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                    {unreadCount} جديد
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={isMarkingAll}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {isMarkingAll ? "..." : "قراءة الكل"}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="sm:hidden p-1 rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
            {isLoading && !hasLoadedOnce ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : recent.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  مفيش إشعارات حالياً
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recent.map((n) => {
                  const config = getNotificationConfig(n.notification_type);
                  const Icon = config.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      className={`p-3 flex gap-3 transition-colors cursor-pointer hover:bg-muted/50 ${
                        !n.is_read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}
                      >
                        <Icon className={`w-4 h-4 ${config.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`font-bold text-sm ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {n.title}
                          </h4>
                          {!n.is_read && (
                            <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="shrink-0 text-center text-sm py-2.5 border-t border-border text-primary hover:bg-muted/50 font-medium"
            >
              عرض كل الإشعارات
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
