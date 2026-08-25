"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { notificationsAPI } from "@/lib/api";
import {
  AppNotification,
  getNotificationConfig,
  timeAgo,
} from "@/lib/notification-config";

type Notification = AppNotification;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState("");

  const fetchNotifications = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = (await notificationsAPI.getAll()) as Notification[];
      setNotifications(data);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg === "Failed to fetch" || msg.includes("fetch")) {
        setError("تعذر الاتصال بالسيرفر — تأكد إن الإنترنت شغال وحاول تاني");
      } else {
        setError(msg || "حصل خطأ في تحميل الإشعارات");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err: any) {
      alert(err.message || "حصل خطأ");
    } finally {
      setIsMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            الإشعارات
            {!isLoading && unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {unreadCount} جديد
              </span>
            )}
          </CardTitle>

          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="w-4 h-4 ml-1" />
                {isMarkingAll ? "..." : "قراءة الكل"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNotifications}
              disabled={isLoading}
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin text-loading" : "text-muted-foreground"}`}
              />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="m-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="ghost" size="sm" onClick={fetchNotifications}>
                إعادة المحاولة
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 flex gap-4">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">مفيش إشعارات حالياً</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const config = getNotificationConfig(n.notification_type);
                const Icon = config.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                    className={`p-4 flex gap-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                      !n.is_read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className={`font-bold text-sm ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {n.title}
                        </h3>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
