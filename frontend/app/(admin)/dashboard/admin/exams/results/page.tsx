"use client"

import { useEffect, useState, Suspense, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  ArrowRight, CheckCircle, XCircle, Users,
  TrendingUp, Clock, BarChart2, Search, ChevronDown, ChevronUp,
  Phone, RefreshCw,
} from "lucide-react"
import { examsAPI } from "@/lib/api"
import { ZoomableQuestionImage } from "@/components/media/ZoomableQuestionImage"
import { Input } from "@/components/ui/input"
import { useAutoRefresh } from "@/hooks/useAutoRefresh"

interface Answer {
  question_id: string
  question_text: string
  question_type: "mcq" | "essay"
  question_image?: string | null
  max_points: number
  correct_answer: string | null
  selected_text: string | null
  essay_answer: string | null
  essay_answer_image?: string | null
  is_correct: boolean
  earned_points: number
  teacher_comment: string
}

interface StudentResult {
  student_id: string
  student_name: string
  student_phone: string
  score: number
  passed: boolean
  submitted_at: string
  earned_points: number
  total_points: number
  essay_fully_reviewed: boolean
  answers: Answer[]
}

interface ExamInfo {
  id: string
  title: string
  pass_score: number
  total_results: number
  pass_rate: number
  avg_score: number
}

function AnswersPanel({ answers }: { answers: Answer[] }) {
  return (
    <div className="px-4 pb-4 space-y-3">
      {answers.map((ans, i) => {
        const isMcq = ans.question_type === "mcq"
        const isEssay = ans.question_type === "essay"
        return (
          <div
            key={ans.question_id + i}
            className={`rounded-xl border p-3 text-sm ${
              isMcq
                ? ans.is_correct
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                : "border-border bg-muted/30"
            }`}
          >
            {/* نص السؤال */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-bold text-foreground">
                {i + 1}. {ans.question_text || (ans.question_image ? "" : "سؤال")}
              </p>
              <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                isMcq
                  ? ans.is_correct
                    ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                    : "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200"
                  : "bg-muted text-muted-foreground"
              }`}>
                {ans.earned_points} / {ans.max_points} درجة
              </span>
            </div>
            {ans.question_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ans.question_image}
                alt={`سؤال ${i + 1}`}
                className="mb-2 max-h-56 w-full rounded-lg border object-contain"
              />
            )}

            {/* MCQ */}
            {isMcq && (
              <div className="space-y-1 text-xs">
                {ans.selected_text && (
                  <div className="flex items-center gap-1.5">
                    {ans.is_correct
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    }
                    <span className="text-muted-foreground">إجابة الطالب:</span>
                    <span className={`font-medium ${ans.is_correct ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                      {ans.selected_text}
                    </span>
                  </div>
                )}
                {!ans.is_correct && ans.correct_answer && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span className="text-muted-foreground">الإجابة الصح:</span>
                    <span className="font-medium text-green-700 dark:text-green-400">{ans.correct_answer}</span>
                  </div>
                )}
                {!ans.selected_text && (
                  <p className="text-muted-foreground italic">لم يجب</p>
                )}
              </div>
            )}

            {/* Essay */}
            {isEssay && (
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground">إجابة الطالب:</p>
                {ans.essay_answer_image ? (
                  <ZoomableQuestionImage
                    src={ans.essay_answer_image}
                    alt="إجابة الطالب"
                    className="max-h-56 w-full rounded-lg border border-border object-contain bg-background"
                  />
                ) : (
                  <p className="text-foreground bg-background rounded p-2 border border-border">
                    {ans.essay_answer || <span className="italic text-muted-foreground">لم يجب</span>}
                  </p>
                )}
                {ans.teacher_comment && (
                  <p className="text-muted-foreground italic border-r-2 border-primary/40 pr-2 mt-1">
                    تعليق المدرس: {ans.teacher_comment}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ResultsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = searchParams.get("id")

  const [results, setResults] = useState<StudentResult[]>([])
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const load = useCallback(async () => {
    if (!examId) { setError("مفيش ID للاختبار"); setIsLoading(false); return }
    try {
      const [examData, resultsData] = await Promise.all([
        examsAPI.getExamForAdmin(examId) as Promise<any>,
        examsAPI.getResults(examId) as Promise<any[]>,
      ])

      setExamInfo({
        id: examId,
        title: examData.title,
        pass_score: examData.pass_score,
        total_results: resultsData.length,
        pass_rate: resultsData.length > 0
          ? Math.round(resultsData.filter(r => r.passed).length / resultsData.length * 100)
          : 0,
        avg_score: resultsData.length > 0
          ? Math.round(resultsData.reduce((s, r) => s + r.score, 0) / resultsData.length)
          : 0,
      })
      setResults(resultsData)
    } catch (err: any) {
      setError(err.message || "حصل خطأ في تحميل النتائج")
    } finally {
      setIsLoading(false)
    }
  }, [examId])

  useEffect(() => {
    load()
  }, [load])

  // auto-refresh كل 30 ثانية
  useAutoRefresh(load, 30000, !!examId)

  const filtered = results.filter(r =>
    r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.student_phone?.includes(search)
  )

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })
    } catch { return dateStr }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowRight className="w-4 h-4 ml-2" />رجوع
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">نتائج الطلاب</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{examInfo?.title}</p>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-extrabold text-foreground">{results.length}</p>
            <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-extrabold text-green-600">{results.filter(r => r.passed).length}</p>
            <p className="text-xs text-muted-foreground">ناجحين</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
            <p className="text-2xl font-extrabold text-destructive">{results.filter(r => !r.passed).length}</p>
            <p className="text-xs text-muted-foreground">راسبين</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-chart-4 mx-auto mb-2" />
            <p className="text-2xl font-extrabold text-foreground">{examInfo?.avg_score}%</p>
            <p className="text-xs text-muted-foreground">متوسط الدرجات</p>
          </CardContent>
        </Card>
      </div>

      {/* نسبة النجاح */}
      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-foreground">نسبة النجاح</span>
              <span className="text-sm font-bold text-primary">{examInfo?.pass_rate}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="h-3 rounded-full bg-primary transition-all"
                style={{ width: `${examInfo?.pass_rate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              درجة النجاح المطلوبة: {examInfo?.pass_score}%
            </p>
          </CardContent>
        </Card>
      )}

      {/* قائمة النتائج */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              النتائج التفصيلية
            </CardTitle>
            {results.length > 0 && (
              <div className="relative w-52">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم أو الهاتف..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pr-9 h-8 text-sm"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">مفيش طلاب عملوا الاختبار ده لسه</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              مفيش نتايج مطابقة للبحث
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((r, idx) => {
                const key = r.student_id + idx
                const isOpen = expanded.has(key)
                return (
                  <div key={key}>
                    {/* صف الطالب */}
                    <div
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(key)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${r.passed ? "bg-green-500" : "bg-destructive"}`}>
                          {r.passed ? "✓" : "✗"}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{r.student_name || "طالب"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {r.student_phone || "—"}
                            </p>
                            <span className="text-muted-foreground text-xs">·</span>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(r.submitted_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className={`text-lg font-extrabold ${r.passed ? "text-green-600" : "text-destructive"}`}>
                            {Math.round(r.score)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.earned_points} / {r.total_points}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${r.passed ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
                          {r.passed ? "ناجح" : "راسب"}
                        </span>
                        {r.answers?.length > 0 && (
                          isOpen
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* إجابات الطالب */}
                    {isOpen && r.answers?.length > 0 && (
                      <div className="bg-muted/20 border-t border-border">
                        <AnswersPanel answers={r.answers} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ExamResultsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 max-w-4xl mx-auto p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    }>
      <ResultsInner />
    </Suspense>
  )
}