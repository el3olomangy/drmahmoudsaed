"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ClipboardList, Plus, Clock, BookOpen, Pencil, Trash2, PlayCircle, Calendar, BarChart2, Search, X, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { coursesAPI, examsAPI } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"

interface ExamItem {
  id: string
  title: string
  duration_minutes: number
  pass_score?: number
  lecture_id?: string | null
  scheduled_at?: string | null
  show_result_immediately?: boolean
}

interface Course {
  id: string
  title: string
}

export default function AdminExamsPage() {
  const router = useRouter()
  const { user } = useAuth()
  // إنشاء/تعديل الاختبار متاح للمدرس والمساعد (لو المدرس مشغول) — الحذف للمدرس فقط
  const isTeacher = user?.role === "teacher"
  const [courses, setCourses] = useState<Course[]>([])
  const [examsByCourse, setExamsByCourse] = useState<Record<string, ExamItem[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const coursesData = await coursesAPI.getAll() as Course[]
        setCourses(coursesData)

        const results: Record<string, ExamItem[]> = {}
        await Promise.all(
          coursesData.map(async (c) => {
            try {
              const exams = await examsAPI.getByCourse(c.id) as ExamItem[]
              // كل حاجة هنا اختبار حقيقي بس — الواجب بقى نظام مستقل في صفحة "الواجبات"
              if (exams.length > 0) results[c.id] = exams
            } catch {}
          })
        )
        setExamsByCourse(results)
      } catch (err: any) {
        setError(err.message || "حصل خطأ")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleDelete = async (courseId: string, examId: string) => {
    if (!confirm("مؤكد إنك عاوز تحذف الاختبار ده؟")) return
    try {
      await examsAPI.deleteExam(examId)
      setExamsByCourse(prev => ({
        ...prev,
        [courseId]: prev[courseId].filter(e => e.id !== examId),
      }))
    } catch (e: any) { alert(e.message || "حصل خطأ") }
  }

  const totalExams = Object.values(examsByCourse).reduce((s, arr) => s + arr.length, 0)

  // فتح/قفل مراجعة الإجابات للطلاب مباشرة من القائمة
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const handleToggleReview = async (courseId: string, exam: ExamItem) => {
    const next = !exam.show_result_immediately
    setTogglingId(exam.id)
    // تحديث فوري متفائل
    setExamsByCourse(prev => ({
      ...prev,
      [courseId]: (prev[courseId] || []).map(e => e.id === exam.id ? { ...e, show_result_immediately: next } : e),
    }))
    try {
      await examsAPI.updateExam(exam.id, { show_result_immediately: next })
    } catch (e: any) {
      // رجّع الحالة القديمة لو فشل
      setExamsByCourse(prev => ({
        ...prev,
        [courseId]: (prev[courseId] || []).map(e => e.id === exam.id ? { ...e, show_result_immediately: exam.show_result_immediately } : e),
      }))
      alert(e.message || "تعذّر تغيير حالة المراجعة")
    } finally {
      setTogglingId(null)
    }
  }

  // فلترة الاختبارات بناءً على الـ search
  const getFilteredExams = (exams: ExamItem[]) => {
    if (!search.trim()) return exams
    return exams.filter(e =>
      e.title.toLowerCase().includes(search.toLowerCase())
    )
  }

  const hasResults = courses.some(c => {
    const exams = examsByCourse[c.id]
    return exams && getFilteredExams(exams).length > 0
  })

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">الاختبارات</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "..." : `${totalExams} اختبار`}
          </p>
        </div>
        <Link href="/dashboard/admin/exams/new">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 ml-2" />
            اختبار جديد
          </Button>
        </Link>
      </div>

      {/* Search */}
      {!isLoading && totalExams > 0 && (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم الاختبار..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : totalExams === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">مفيش اختبارات لسه</p>
            <Link href="/dashboard/admin/exams/new">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 ml-2" />
                أنشئ أول اختبار
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : !hasResults ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>مفيش اختبارات بالاسم ده</p>
          <button onClick={() => setSearch("")} className="text-primary text-sm mt-2 hover:underline">
            مسح البحث
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {courses.map(course => {
            const exams = examsByCourse[course.id]
            if (!exams) return null
            const filtered = getFilteredExams(exams)
            if (filtered.length === 0) return null
            return (
              <div key={course.id}>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-bold text-foreground">{course.title}</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {filtered.length} اختبار
                  </span>
                </div>

                <div className="space-y-2">
                  {filtered.map(exam => (
                    <Card key={exam.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <ClipboardList className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground text-sm truncate">{exam.title}</p>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {exam.duration_minutes} دقيقة
                              </span>
                              {exam.pass_score !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  نجاح: {exam.pass_score}%
                                </span>
                              )}
                              {exam.lecture_id ? (
                                <span className="text-xs text-chart-4 flex items-center gap-1 font-medium">
                                  <PlayCircle className="w-3 h-3" />
                                  تابع لمحاضرة
                                </span>
                              ) : (
                                <span className="text-xs text-primary flex items-center gap-1 font-medium">
                                  <BookOpen className="w-3 h-3" />
                                  اختبار الكورس
                                </span>
                              )}
                              {exam.scheduled_at && new Date(exam.scheduled_at) > new Date() && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(exam.scheduled_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleReview(course.id, exam)}
                            disabled={togglingId === exam.id}
                            className={`p-1.5 rounded transition-colors disabled:opacity-50 ${exam.show_result_immediately ? "hover:bg-chart-3/10" : "hover:bg-muted"}`}
                            title={exam.show_result_immediately ? "مراجعة الإجابات مفتوحة للطلاب — اضغط للقفل" : "مراجعة الإجابات مقفولة — اضغط للفتح"}
                          >
                            {exam.show_result_immediately
                              ? <Eye className="w-4 h-4 text-chart-3" />
                              : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/admin/exams/results?id=${exam.id}`)}
                            className="p-1.5 rounded hover:bg-primary/10 transition-colors"
                            title="نتائج الطلاب"
                          >
                            <BarChart2 className="w-4 h-4 text-primary" />
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/admin/exams/edit?id=${exam.id}`)}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="تعديل"
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {isTeacher && (
                            <button
                              onClick={() => handleDelete(course.id, exam.id)}
                              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                              title="حذف الاختبار"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}