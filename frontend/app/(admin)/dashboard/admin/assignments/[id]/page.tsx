"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowRight, Clock, ChevronDown, ChevronUp,
  AlertCircle, ClipboardCheck, Phone, Search,
  CheckCircle, MessageSquare, Star,
} from "lucide-react"
import { homeworkAPI } from "@/lib/api"
import { ZoomableQuestionImage } from "@/components/media/ZoomableQuestionImage"

interface Answer {
  question_id: string
  question_text: string
  question_type: string
  question_image?: string | null
  max_points: number
  essay_answer: string | null
  essay_answer_image?: string | null
  earned_points: number
  essay_reviewed?: boolean
  teacher_comment: string
  is_correct: boolean
  selected_text: string | null
  correct_answer: string | null
}

interface StudentResult {
  id: string
  student_id: string
  student_name: string
  student_phone: string
  score: number
  passed: boolean
  earned_points: number
  total_points: number
  submitted_at: string
  answers: Answer[]
}

interface HomeworkInfo {
  title: string
}

export default function AssignmentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const homeworkId = params.id as string

  const [homework, setHomework] = useState<HomeworkInfo | null>(null)
  const [results, setResults] = useState<StudentResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [grades, setGrades] = useState<Record<string, { value: string; note: string; saving: boolean }>>({})

  const fetchData = async () => {
    setIsLoading(true)
    setError("")
    try {
      const [hw, res] = await Promise.all([
        homeworkAPI.getForAdmin(homeworkId) as Promise<any>,
        homeworkAPI.getResults(homeworkId) as Promise<StudentResult[]>,
      ])
      setHomework({ title: hw.title })
      setResults(res)
      if (res.length > 0) setExpanded(new Set([res[0].student_id]))
    } catch (err: any) {
      setError(err.message || "حصل خطأ في التحميل")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [homeworkId])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const saveGrade = async (result: StudentResult, qid: string) => {
    const g = grades[qid]
    if (!g) return
    setGrades(prev => ({ ...prev, [qid]: { ...prev[qid], saving: true } }))
    try {
      await homeworkAPI.submitReview(result.id, [{
        question_id: qid,
        earned_points: Number(g.value) || 0,
        teacher_comment: g.note,
      }])
      // حدّث الـ state محلياً
      setResults(prev => prev.map(r => {
        if (r.student_id !== result.student_id) return r
        return {
          ...r,
          answers: r.answers.map(a =>
            a.question_id === qid
              ? { ...a, earned_points: Number(g.value) || 0, teacher_comment: g.note }
              : a
          )
        }
      }))
    } catch (err: any) {
      alert(err.message || "حصل خطأ في الحفظ")
    } finally {
      setGrades(prev => ({ ...prev, [qid]: { ...prev[qid], saving: false } }))
    }
  }

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" }) }
    catch { return iso }
  }

  const filtered = results.filter(r =>
    r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.student_phone?.includes(search)
  )

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {homework?.title || "تسليمات الواجب"}
          </h1>
          {!isLoading && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {results.length} طالب سلّم
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      )}

      {/* مفيش تسليمات */}
      {!isLoading && results.length === 0 && !error && (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">مفيش طلاب سلّموا لسه</p>
          </CardContent>
        </Card>
      )}

      {/* بحث */}
      {!isLoading && results.length > 1 && (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو الهاتف..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      )}

      {/* قائمة النتائج */}
      {!isLoading && filtered.map((result) => {
        const isOpen = expanded.has(result.student_id)
        const allAnswers = result.answers || []

        return (
          <Card key={result.student_id} className="overflow-hidden">

            {/* صف الطالب */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleExpand(result.student_id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{result.student_name || "طالب"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />{result.student_phone || "—"}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />{formatDate(result.submitted_at)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {result.earned_points} / {result.total_points} درجة
                </span>
                {isOpen
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                }
              </div>
            </div>

            {/* الأسئلة والإجابات */}
            {isOpen && (
              <div className="border-t border-border">
                {allAnswers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    مفيش إجابات مسجلة
                  </div>
                ) : (
                  allAnswers.map((ans, i) => {
                    const isMcq = ans.question_type === "mcq"
                    const gKey = `${result.student_id}_${ans.question_id}`
                    const g = grades[gKey]
                    return (
                      <div key={ans.question_id} className="p-4 space-y-3 border-b border-border last:border-b-0">

                        {/* السؤال */}
                        <p className="font-bold text-sm text-foreground">
                          {i + 1}. {ans.question_text || "سؤال"}
                          <span className="text-muted-foreground font-normal mr-2 text-xs">
                            ({ans.max_points} درجة)
                          </span>
                        </p>
                        {ans.question_image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ans.question_image}
                            alt={`سؤال ${i + 1}`}
                            className="max-h-56 w-full rounded-lg border object-contain"
                          />
                        )}

                        {/* إجابة الطالب */}
                        {isMcq ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">إجابة الطالب</p>
                            <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${
                              ans.is_correct
                                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                                : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                            }`}>
                              <span className={`font-bold ${ans.is_correct ? "text-green-600" : "text-red-600"}`}>
                                {ans.is_correct ? "✓" : "✗"}
                              </span>
                              <span className="text-foreground">{ans.selected_text || "لم يجب"}</span>
                              {!ans.is_correct && ans.correct_answer && (
                                <span className="text-xs text-muted-foreground mr-auto">
                                  الصح: <span className="text-green-600 font-medium">{ans.correct_answer}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5" /> إجابة الطالب
                            </p>
                            <div className="bg-muted/40 rounded-xl p-3 border border-border">
                              {ans.essay_answer_image ? (
                                <ZoomableQuestionImage
                                  src={ans.essay_answer_image}
                                  alt={`إجابة الطالب على السؤال ${i + 1}`}
                                  className="max-h-72 w-full rounded-lg border border-border object-contain bg-background"
                                />
                              ) : (
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                  {ans.essay_answer || <span className="italic text-muted-foreground">لم يجب</span>}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* التصحيح — للمقالي بس */}
                        {!isMcq && (
                          <div className="bg-muted/20 rounded-xl p-3 border border-border space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                <Star className="w-3.5 h-3.5" /> التصحيح
                              </p>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ans.essay_reviewed ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"}`}>
                                {ans.essay_reviewed ? "تم التصحيح" : "لسه متصححش"}
                              </span>
                            </div>
                            <div className="flex gap-2 items-end">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">الدرجة من {ans.max_points}</label>
                                <Input
                                  type="number"
                                  min="0"
                                  max={ans.max_points}
                                  placeholder="0"
                                  value={g?.value ?? String(ans.earned_points || "")}
                                  onChange={e => setGrades(prev => ({
                                    ...prev,
                                    [gKey]: { value: e.target.value, note: prev[gKey]?.note || ans.teacher_comment || "", saving: false }
                                  }))}
                                  className="h-9 w-24 text-sm text-center"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-xs text-muted-foreground">ملاحظة للطالب</label>
                                <Input
                                  placeholder="اختياري..."
                                  value={g?.note ?? (ans.teacher_comment || "")}
                                  onChange={e => setGrades(prev => ({
                                    ...prev,
                                    [gKey]: { value: prev[gKey]?.value || String(ans.earned_points || ""), note: e.target.value, saving: false }
                                  }))}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <Button
                                size="sm"
                                disabled={g?.saving}
                                onClick={() => saveGrade(result, ans.question_id)}
                                className="h-9 shrink-0"
                              >
                                {g?.saving ? "..." : "حفظ"}
                              </Button>
                            </div>
                          </div>
                        )}

                      </div>
                    )
                  })
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}