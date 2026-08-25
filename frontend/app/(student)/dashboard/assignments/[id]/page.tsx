"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowRight, CheckCircle, AlertCircle,
  Calendar, ClipboardCheck, Clock,
} from "lucide-react"
import { assignmentsAPI } from "@/lib/api"

interface Assignment {
  id: string
  title: string
  description: string
  deadline?: string
  is_expired?: boolean
  created_at: string
}

interface MySubmission {
  id: string
  text_answer: string
  grade: number | null
  teacher_note: string | null
  submitted_at: string
}

type PageState = "loading" | "error" | "already_done" | "form" | "submitting" | "success" | "expired"
export default function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: assignmentId } = use(params)

  const [pageState, setPageState] = useState<PageState>("loading")
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [mySubmission, setMySubmission] = useState<MySubmission | null>(null)
  const [answer, setAnswer] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        // جيب تسليماتي الأول وشوف لو سلمت الواجب ده
        try {
          const mySubmissions = (await assignmentsAPI.getMySubmissions()) as any[]
          const existing = mySubmissions.find(s => s.assignment_id === assignmentId)
          if (existing) {
            setMySubmission(existing)
            // جيب تفاصيل الواجب كمان عشان نعرض الاسم
            try {
              const a = await assignmentsAPI.getOne(assignmentId) as Assignment
              setAssignment(a)
            } catch {}
            setPageState("already_done")
            return
          }
        } catch {}

        // جيب تفاصيل الواجب
                // جيب تفاصيل الواجب
        const a = await assignmentsAPI.getOne(assignmentId) as Assignment
        setAssignment(a)
        setPageState(a.is_expired ? "expired" : "form")
        
      } catch (err: any) {
        setErrorMsg(err.message || "حصل خطأ في تحميل الواجب")
        setPageState("error")
      }
    }
    fetchData()
  }, [assignmentId])

  const handleSubmit = async () => {
    if (!answer.trim()) {
      setErrorMsg("لازم تكتب إجابة")
      return
    }
    setPageState("submitting")
    setErrorMsg("")
    try {
      await assignmentsAPI.submit({
        assignment_id: assignmentId,
        text_answer: answer.trim(),
      })
      setPageState("success")
        } catch (err: any) {
      const msg = err.message || "حصل خطأ في التسليم"
      setErrorMsg(msg)
      setPageState(msg.includes("انتهى موعد") ? "expired" : "form")
    }
  }

  // ====== Loading ======
  if (pageState === "loading") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-5 w-32" />
        <Card>
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full rounded-xl mt-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== Error ======
  if (pageState === "error") {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">حصل خطأ</h2>
        <p className="text-muted-foreground mb-6">{errorMsg}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/courses">
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة للكورسات
          </Link>
        </Button>
      </div>
    )
  }

  // ====== Already Done ======
  if (pageState === "already_done" && mySubmission) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard/courses"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للكورسات
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="w-20 h-20 rounded-full bg-chart-3/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-chart-3" />
            </div>
            <CardTitle className="text-2xl font-extrabold">
              سلّمت الواجب ده قبل كده
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* إجابتك */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">إجابتك:</p>
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-sm text-foreground leading-relaxed">
                  {mySubmission.text_answer}
                </p>
              </div>
            </div>

            {/* الدرجة */}
            {mySubmission.grade !== null ? (
              <div className="p-4 bg-chart-3/10 border border-chart-3/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground">الدرجة</p>
                  <p className="text-2xl font-extrabold text-chart-3">
                    {mySubmission.grade}
                  </p>
                </div>
                {mySubmission.teacher_note && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    &ldquo;{mySubmission.teacher_note}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-700 dark:text-orange-400 text-center">
                <Clock className="w-4 h-4 inline-block ml-1" />
                في انتظار تصحيح المدرس
              </div>
            )}

            {/* تاريخ التسليم */}
            <p className="text-xs text-muted-foreground text-center">
              سُلِّم في {new Date(mySubmission.submitted_at).toLocaleDateString("ar-EG", {
                dateStyle: "full",
              })}
            </p>

            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/courses">
                <ArrowRight className="w-4 h-4 ml-2" />
                العودة للكورسات
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== Success ======
  if (pageState === "success") {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <CheckCircle className="w-16 h-16 text-chart-3 mx-auto mb-4" />
        <h2 className="text-2xl font-extrabold mb-2">تم تسليم الواجب!</h2>
        <p className="text-muted-foreground mb-8">
          هيتم تصحيحه من المدرس قريباً
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/courses">
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة للكورسات
          </Link>
        </Button>
      </div>
    )
  }

    // ====== Expired ======
  if (pageState === "expired") {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard/courses"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للكورسات
        </Link>

        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-xl font-extrabold mb-2">تم انتهاء موعد التسليم</h2>
            <p className="text-muted-foreground mb-2">
              معنديش تسليم منك للواجب ده، ومعدش ينفع تسلّم دلوقتي.
            </p>
            {assignment?.deadline && (
              <p className="text-xs text-muted-foreground mb-6">
                آخر موعد كان: {new Date(assignment.deadline).toLocaleDateString("ar-EG", { dateStyle: "full" })}
              </p>
            )}
            <Button asChild variant="outline">
              <Link href="/dashboard/courses">
                <ArrowRight className="w-4 h-4 ml-2" />
                العودة للكورسات
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== Form ======
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/dashboard/courses"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowRight className="w-4 h-4" />
        العودة للكورسات
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-extrabold">
                {assignment?.title}
              </CardTitle>
              {assignment?.deadline && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  آخر موعد: {new Date(assignment.deadline).toLocaleDateString("ar-EG", {
                    dateStyle: "full",
                  })}
                </p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">

          {/* التعليمات */}
          {assignment?.description && (
            <div className="p-4 bg-muted/40 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1 font-bold">التعليمات:</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {assignment.description}
              </p>
            </div>
          )}

          {/* الإجابة */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-foreground">إجابتك *</p>
            <Textarea
              placeholder="اكتب إجابتك هنا بالتفصيل..."
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              className="min-h-40 resize-none"
            />
            <p className="text-xs text-muted-foreground text-left">
              {answer.length} حرف
            </p>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* زرار التسليم */}
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6 text-base"
            onClick={handleSubmit}
            disabled={pageState === "submitting"}
          >
            {pageState === "submitting" ? "جاري التسليم..." : "تسليم الواجب"}
          </Button>

        </CardContent>
      </Card>
    </div>
  )
}