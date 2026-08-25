"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowRight, ChevronLeft, ChevronRight,
  FileText, FileCheck, AlertCircle, ClipboardCheck, Calendar,
} from "lucide-react"
import { coursesAPI, examsAPI, homeworkAPI, progressAPI } from "@/lib/api"
import VideoPlayer from "@/components/VideoPlayer"
import { useAuth } from "@/context/AuthContext"

interface Lecture {
  id: string
  title: string
  description?: string
  video_url?: string
  pdf_url?: string
  order: number
  lecture_type: string
  duration_minutes?: number
  is_enrolled: boolean
}

interface Unit {
  id: string
  title: string
  order: number
  lectures: Lecture[]
}

interface ExamInfo {
  id: string
  title: string
  duration_minutes: number
  available_until?: string
  is_closed?: boolean
}

interface HomeworkInfo {
  id: string
  title: string
  deadline?: string
  is_expired?: boolean
}

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lectureId } = use(params)
  const { user } = useAuth()

  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState<string>("")
  const [unitName, setUnitName] = useState<string>("")
  const [prevLectureId, setPrevLectureId] = useState<string | null>(null)
  const [nextLectureId, setNextLectureId] = useState<string | null>(null)
  const [exam, setExam] = useState<ExamInfo | null>(null)
  const [homework, setHomework] = useState<HomeworkInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [initialPosition, setInitialPosition] = useState(0)
  const [savedPosition, setSavedPosition] = useState(0)
  const [showResumeDialog, setShowResumeDialog] = useState(false)

  useEffect(() => {
    const fetchLecture = async () => {
      setIsLoading(true)
      setError("")
      try {
        const courses = await coursesAPI.getAll() as any[]

        for (const course of courses) {
          if (!course.is_enrolled) continue
          const fullCourse = await coursesAPI.getOne(course.id) as any

          let allLectures: Lecture[] = []
          for (const unit of (fullCourse.units || [])) {
            allLectures = [...allLectures, ...unit.lectures]
          }

          const foundLecture = allLectures.find((l: Lecture) => l.id === lectureId)
          if (foundLecture) {
            const foundUnit = fullCourse.units.find((u: Unit) =>
              u.lectures.some((l: Lecture) => l.id === lectureId)
            )

            setLecture(foundLecture)
            setCourseId(course.id)
            setCourseName(fullCourse.title)
            setUnitName(foundUnit?.title || "")

            progressAPI.savePosition(lectureId, 100, 100).catch(() => {})
            progressAPI.getPosition(lectureId).then((pos: any) => {
              if (pos.last_position && pos.last_position > 5) {
                setSavedPosition(pos.last_position)
                setShowResumeDialog(true)
              }
            }).catch(() => {})

            const idx = allLectures.findIndex((l: Lecture) => l.id === lectureId)
            setPrevLectureId(idx > 0 ? allLectures[idx - 1].id : null)
            setNextLectureId(idx < allLectures.length - 1 ? allLectures[idx + 1].id : null)

            // جيب الاختبار (نظام مستقل)
            try {
              const allExams = await examsAPI.getByCourse(course.id) as any[]
              const lectureExam = allExams.find((e: any) => e.lecture_id === lectureId)
              if (lectureExam) setExam(lectureExam)
            } catch {}

            // جيب الواجب (نظام مستقل تمامًا عن الامتحانات)
            try {
              const allHomeworks = await homeworkAPI.getByCourse(course.id) as any[]
              const lectureHomework = allHomeworks.find((h: any) => h.lecture_id === lectureId)
              if (lectureHomework) setHomework(lectureHomework)
            } catch {}

            break
          }
        }
      } catch (err: any) {
        setError(err.message || "حصل خطأ في تحميل المحاضرة")
      } finally {
        setIsLoading(false)
      }
    }

    fetchLecture()
  }, [lectureId])

  const studentWatermark = user
    ? `${user.first_name} ${user.last_name} - ${user.phone}`
    : ""

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Card className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <CardContent className="p-4 md:p-6 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-7 w-3/4" />
            <div className="flex justify-between pt-2">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-36" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !lecture) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">مش قادر أحمل المحاضرة</h2>
        <p className="text-muted-foreground mb-6">{error || "المحاضرة مش موجودة أو مش مشترك فيها"}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/courses">
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة للكورسات
          </Link>
        </Button>
      </div>
    )
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0")
    const s = Math.floor(secs % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  return (
    <div className="space-y-6">

      {/* Resume Dialog */}
      {showResumeDialog && savedPosition > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" dir="rtl">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">▶️</span>
              </div>
              <h3 className="text-lg font-extrabold text-foreground">كملت المحاضرة دي قبل كده</h3>
              <p className="text-muted-foreground text-sm mt-1">
                وصلت لـ <span className="font-bold text-primary">{formatTime(savedPosition)}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setInitialPosition(savedPosition); setShowResumeDialog(false) }}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors"
              >
                كمّل من {formatTime(savedPosition)}
              </button>
              <button
                onClick={() => { setInitialPosition(0); setShowResumeDialog(false) }}
                className="w-full py-3 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-xl transition-colors"
              >
                ابدأ من الأول
              </button>
            </div>
          </div>
        </div>
      )}

      <Link
        href={courseId ? `/dashboard/courses/${courseId}` : "/dashboard/courses"}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة للكورس</span>
      </Link>

      <Card className="overflow-hidden">
        {!showResumeDialog && (
          <VideoPlayer
            url={lecture.video_url || ""}
            watermark={studentWatermark}
            lectureId={lectureId}
            initialPosition={initialPosition}
            onProgress={(position, duration) => {
              progressAPI.savePosition(lectureId, position, duration).catch(() => {})
            }}
          />
        )}
        {showResumeDialog && (
          <div className="aspect-video bg-black" />
        )}

        <CardContent className="p-4 md:p-6">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-1">
              {courseName}
              {unitName && <> &bull; {unitName}</>}
              {lecture.duration_minutes && <> &bull; {lecture.duration_minutes} دقيقة</>}
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{lecture.title}</h1>
            {lecture.description && (
              <p className="text-muted-foreground mt-2 text-sm">{lecture.description}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" disabled={!prevLectureId} asChild={!!prevLectureId}>
              {prevLectureId ? (
                <Link href={`/dashboard/watch/${prevLectureId}`} className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />المحاضرة السابقة
                </Link>
              ) : (
                <span className="flex items-center gap-2"><ChevronRight className="w-4 h-4" />المحاضرة السابقة</span>
              )}
            </Button>

            <Button disabled={!nextLectureId} asChild={!!nextLectureId} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {nextLectureId ? (
                <Link href={`/dashboard/watch/${nextLectureId}`} className="flex items-center gap-2">
                  المحاضرة التالية<ChevronLeft className="w-4 h-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-2">المحاضرة التالية<ChevronLeft className="w-4 h-4" /></span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PDF + اختبار + واجب */}
      <div className="grid md:grid-cols-2 gap-4">

        {lecture.pdf_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-secondary" />
                ملف الشرح
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <a href={lecture.pdf_url} target="_blank" rel="noopener noreferrer">
                  عرض الملف
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {exam && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-chart-4" />
                اختبار المحاضرة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                {exam.title} &bull; {exam.duration_minutes} دقيقة
              </p>
              {exam.available_until && (
                <p className={`text-xs flex items-center gap-1 mb-3 ${
                  exam.is_closed
                    ? "text-destructive"
                    : "text-amber-600 dark:text-amber-400"
                }`}>
                  <Calendar className="w-3 h-3" />
                  {exam.is_closed ? "انتهى وقت الاختبار: " : "آخر موعد: "}
                  {new Date(exam.available_until).toLocaleDateString("ar-EG", { dateStyle: "full" })}
                </p>
              )}
              {exam.is_closed ? (
                <Button className="w-full" variant="outline" disabled>
                  انتهى وقت الاختبار
                </Button>
              ) : (
                <Button asChild className="w-full bg-chart-4 hover:bg-chart-4/90 text-white">
                  <Link href={`/dashboard/exam/${exam.id}`}>ابدأ الاختبار</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {homework && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                واجب المحاضرة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">{homework.title}</p>
              {homework.deadline && (
                <p className={`text-xs flex items-center gap-1 ${
                  homework.is_expired
                    ? "text-destructive"
                    : "text-amber-600 dark:text-amber-400"
                }`}>
                  <Calendar className="w-3 h-3" />
                  {homework.is_expired ? "انتهى موعد التسليم: " : "آخر موعد: "}
                  {new Date(homework.deadline).toLocaleDateString("ar-EG", { dateStyle: "full" })}
                </p>
              )}
              {homework.is_expired ? (
                <Button className="w-full" variant="outline" disabled>
                  انتهى موعد التسليم
                </Button>
              ) : (
                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href={`/dashboard/homework/${homework.id}`}>ابدأ الواجب</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}