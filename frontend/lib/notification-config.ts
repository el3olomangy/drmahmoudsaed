import {
  Bell,
  BookOpen,
  FileCheck,
  KeyRound,
  PlayCircle,
  ClipboardCheck,
  ClipboardX,
  FileWarning,
} from "lucide-react";

export const notificationTypeConfig: Record<
  string,
  { icon: any; iconColor: string; iconBg: string }
> = {
  new_lecture: {
    icon: PlayCircle,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  new_course: {
    icon: BookOpen,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  new_homework: {
    icon: ClipboardCheck,
    iconColor: "text-chart-2",
    iconBg: "bg-chart-2/10",
  },
  new_assignment: {
    icon: ClipboardCheck,
    iconColor: "text-chart-2",
    iconBg: "bg-chart-2/10",
  },
  new_exam: {
    icon: FileCheck,
    iconColor: "text-chart-3",
    iconBg: "bg-chart-3/10",
  },
  exam_result: {
    icon: FileCheck,
    iconColor: "text-chart-3",
    iconBg: "bg-chart-3/10",
  },
  exam_reviewed: {
    icon: FileCheck,
    iconColor: "text-chart-3",
    iconBg: "bg-chart-3/10",
  },
  assignment_missed: {
    icon: FileWarning,
    iconColor: "text-destructive",
    iconBg: "bg-destructive/10",
  },
  exam_missed: {
    icon: ClipboardX,
    iconColor: "text-destructive",
    iconBg: "bg-destructive/10",
  },
  subscription: {
    icon: KeyRound,
    iconColor: "text-secondary",
    iconBg: "bg-secondary/10",
  },
  subscription_expiry: {
    icon: KeyRound,
    iconColor: "text-secondary",
    iconBg: "bg-secondary/10",
  },
  code_activated: {
    icon: KeyRound,
    iconColor: "text-secondary",
    iconBg: "bg-secondary/10",
  },
  announcement: {
    icon: Bell,
    iconColor: "text-chart-4",
    iconBg: "bg-chart-4/10",
  },
};

export function getNotificationConfig(type: string) {
  return notificationTypeConfig[type] || notificationTypeConfig.announcement;
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return date.toLocaleDateString("ar-EG");
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}
