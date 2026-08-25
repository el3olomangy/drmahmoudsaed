"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users, BookOpen, KeyRound, TrendingUp,
  UserPlus, CheckCircle, XCircle, ClipboardList, ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import { statsAPI } from "@/lib/api"
import { useAutoRefresh } from "@/hooks/useAutoRefresh"

interface Overview {
  students: { total: number; active: number; inactive: number; new_this_week: number }
  courses: { total: number; active: number }
  codes: { total: number; used: number; available: number; usage_rate: number }
  exams: { total: number; submissions: number; pass_rate: number }
}

interface TopCourse {
  course_id: string
  title: string
  grade: string
  subscribers: number
}

interface RecentStudent {
  id: string
  name: string
  phone: string
  grade?: string
  is_active: boolean
  courses_count: number
  joined_at?: string
}

const gradeLabel: Record<string, string> = {
  first_preparatory: "أول إعدادي",
  second_preparatory: "ثاني إعدادي",
  third_preparatory: "ثالث إعدادي",
  first_secondary: "أول ثانوي",
  second_secondary: "ثاني ثانوي",
  third_secondary: "ثالث ثانوي",
}

export default function AdminHomePage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [topCourses, setTopCourses] = useState<TopCourse[]>([])
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ov, courses, recent] = await Promise.all([
          statsAPI.getOverview() as Promise<Overview>,
          statsAPI.getTopCourses() as Promise<TopCourse[]>,
          statsAPI.getRecentStudents() as Promise<RecentStudent[]>,
        ])
        setOverview(ov)
        setTopCourses(courses.slice(0, 5))
        setRecentStudents(recent.slice(0, 5))
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ""
    try { return new Date(dateStr).toLocaleDateString("ar-EG", { dateStyle: "short" }) }
    catch { return "" }
  }

  return (
    <div className="space-y-6" dir="rtl">

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على المنصة</p>
      </div>

      {/* ====== الإحصائيات الرئيسية ====== */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* الطلاب */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              {!isLoading && overview && (
                <span className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full whitespace-nowrap">
                  +{overview.students.new_this_week} هذا الأسبوع
                </span>
              )}
            </div>
            {isLoading
              ? <Skeleton className="h-9 w-20 mb-1" />
              : <p className="text-4xl font-extrabold text-foreground mb-1">{overview?.students.total ?? "—"}</p>
            }
            <p className="text-sm text-muted-foreground mb-4">إجمالي الطلاب</p>
            {!isLoading && overview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">نشطين</span>
                  <span className="font-bold text-green-600 dark:text-green-400">{overview.students.active}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${overview.students.total > 0 ? Math.round(overview.students.active / overview.students.total * 100) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">موقوفين</span>
                  <span className="font-bold text-destructive">{overview.students.inactive}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* الكورسات */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-4">
              <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-secondary" />
              </div>
            </div>
            {isLoading
              ? <Skeleton className="h-9 w-20 mb-1" />
              : <p className="text-4xl font-extrabold text-foreground mb-1">{overview?.courses.total ?? "—"}</p>
            }
            <p className="text-sm text-muted-foreground mb-4">الكورسات</p>
            {!isLoading && overview && (
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground">كورسات نشطة</p>
                <p className="text-lg font-bold text-foreground">{overview.courses.active}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* الأكواد */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-4">
              <div className="w-11 h-11 rounded-xl bg-chart-3/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-chart-3" />
              </div>
            </div>
            {isLoading
              ? <Skeleton className="h-9 w-20 mb-1" />
              : <p className="text-4xl font-extrabold text-foreground mb-1">{overview?.codes.available ?? "—"}</p>
            }
            <p className="text-sm text-muted-foreground mb-4">أكواد متاحة</p>
            {!isLoading && overview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">نسبة الاستخدام</span>
                  <span className="font-bold text-chart-3">{overview.codes.usage_rate}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-chart-3 transition-all"
                    style={{ width: `${overview.codes.usage_rate}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{overview.codes.used} مستخدم من {overview.codes.total}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* الاختبارات */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-4">
              <div className="w-11 h-11 rounded-xl bg-chart-4/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-chart-4" />
              </div>
            </div>
            {isLoading
              ? <Skeleton className="h-9 w-20 mb-1" />
              : <p className="text-4xl font-extrabold text-foreground mb-1">{overview ? `${overview.exams.pass_rate}%` : "—"}</p>
            }
            <p className="text-sm text-muted-foreground mb-4">نسبة النجاح</p>
            {!isLoading && overview && (
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-chart-4 transition-all"
                    style={{ width: `${overview.exams.pass_rate}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{overview.exams.submissions} تسليم اختبار</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ====== الصف الثاني ====== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* أكثر الكورسات اشتراكاً */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-secondary" />
                أكثر الكورسات اشتراكاً
              </CardTitle>
              <Link href="/dashboard/admin/courses" className="text-xs text-primary hover:underline flex items-center gap-1">
                الكل <ArrowLeft className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
            ) : topCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا يوجد بيانات بعد</p>
            ) : (
              <div className="space-y-1">
                {topCourses.map((course, i) => (
                  <div key={course.course_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{course.title}</p>
                      <p className="text-xs text-muted-foreground">{gradeLabel[course.grade] ?? course.grade}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Users className="w-3 h-3 text-primary" />
                      <span className="text-sm font-bold text-primary">{course.subscribers}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر الطلاب المسجلين */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                آخر الطلاب المسجلين
              </CardTitle>
              <Link href="/dashboard/admin/students" className="text-xs text-primary hover:underline flex items-center gap-1">
                الكل <ArrowLeft className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
            ) : recentStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا يوجد طلاب بعد</p>
            ) : (
              <div className="space-y-1">
                {recentStudents.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-sm">{s.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {gradeLabel[s.grade ?? ""] ?? s.grade ?? "—"}
                        {s.joined_at && ` • ${formatDate(s.joined_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{s.courses_count} كورس</span>
                      {s.is_active
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-destructive" />
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ====== روابط سريعة ====== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            روابط سريعة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/dashboard/admin/students", label: "الطلاب", desc: `${overview?.students.total ?? 0} طالب`, icon: Users, bg: "bg-primary/10", text: "text-primary" },
              { href: "/dashboard/admin/courses", label: "الكورسات", desc: `${overview?.courses.total ?? 0} كورس`, icon: BookOpen, bg: "bg-secondary/10", text: "text-secondary" },
              { href: "/dashboard/admin/codes", label: "الأكواد", desc: `${overview?.codes.available ?? 0} متاح`, icon: KeyRound, bg: "bg-chart-3/10", text: "text-chart-3" },
              { href: "/dashboard/admin/exams", label: "الاختبارات", desc: `${overview?.exams.total ?? 0} اختبار`, icon: ClipboardList, bg: "bg-chart-4/10", text: "text-chart-4" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                    <item.icon className={`w-5 h-5 ${item.text}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{isLoading ? "..." : item.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}