"use client"

import { useEffect, useState, use } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  PlayCircle, FileText, FileCheck, Lock,
  ArrowRight, AlertCircle, BookOpen, Clock, ExternalLink,
} from "lucide-react"
import { coursesAPI, examsAPI, homeworkAPI, progressAPI } from "@/lib/api"
import { getImageUrl } from "@/lib/utils/image"

interface Lecture {
  id: string; title: string; description?: string
  video_url?: string; pdf_url?: string; order: number
  lecture_type: string; duration_minutes?: number; is_enrolled: boolean
}
interface Unit { id: string; title: string; order: number; lectures: Lecture[] }
interface Course {
  id: string; title: string; description?: string; grade: string
  price?: number; thumbnail?: string; units: Unit[]; is_enrolled: boolean
}
interface ExamInfo { id: string; title: string; duration_minutes: number; lecture_id: string | null; available_until?: string; is_closed?: boolean }
interface HomeworkInfo { id: string; title: string; lecture_id: string | null; deadline?: string; is_expired?: boolean }
// عنصر موحّد لعرض الاختبارات والواجبات مع بعض جوه نفس المحاضرة، كل واحد فاضل معروف نوعه
type CourseItem =
  | ({ kind: "exam" } & ExamInfo)
    | ({ kind: "homework" } & HomeworkInfo)

const gradeLabels: Record<string, string> = {
  
  first_preparatory: "الصف الأول الإعدادي",
  second_preparatory: "الصف الثاني الإعدادي",
  third_preparatory: "الصف الثالث الإعدادي",
  first_secondary: "الصف الأول الثانوي",
  second_secondary: "الصف الثاني الثانوي",
  third_secondary: "الصف الثالث الثانوي",
}

export default function CourseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const [course, setCourse] = useState<Course | null>(null)
  const [items, setItems] = useState<CourseItem[]>([])
  const [progress, setProgress] = useState<{watched:number;total_lectures:number;percentage:number;exam_stats:{taken:number;passed:number}} | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchCourse = async () => {
      setIsLoading(true); setError("")
      try {
        const [data, examsData, homeworksData, progressData] = await Promise.all([
          coursesAPI.getOne(courseId) as Promise<Course>,
          examsAPI.getByCourse(courseId).catch(() => []) as Promise<ExamInfo[]>,
          homeworkAPI.getByCourse(courseId).catch(() => []) as Promise<HomeworkInfo[]>,
          progressAPI.getCourseProgress(courseId).catch(() => null) as Promise<any>,
        ])
        setCourse(data)
        setItems([
          ...examsData.map(e => ({ kind: "exam" as const, ...e })),
          ...homeworksData.map(h => ({ kind: "homework" as const, ...h })),
        ])
        if (progressData) setProgress(progressData)
      } catch (err: any) {
        setError(err.message || "حصل خطأ في تحميل الكورس")
      } finally { setIsLoading(false) }
    }
    fetchCourse()
  }, [courseId])

  const totalLectures = course?.units.flatMap(u => u.lectures).length || 0

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Card className="overflow-hidden">
          <Skeleton className="aspect-3/1 w-full" />
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
        <Card><CardContent className="p-6 space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </CardContent></Card>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">مش قادر أحمل الكورس</h2>
        <p className="text-muted-foreground mb-6">{error || "الكورس مش موجود"}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/courses"><ArrowRight className="w-4 h-4 ml-2" />العودة للكورسات</Link>
        </Button>
      </div>
    )
  }

  // "اختبارات الكورس" قسم مخصص للاختبارات فقط، و"واجبات الكورس" قسم منفصل للواجبات —
  // كل واحد ليه قسمه عشان الواجبات ما تتخلطش مع الاختبارات في نفس القسم
  const courseExams = items.filter((i): i is Extract<CourseItem, { kind: "exam" }> => i.kind === "exam" && !i.lecture_id)
  const courseHomeworks = items.filter((i): i is Extract<CourseItem, { kind: "homework" }> => i.kind === "homework" && !i.lecture_id)

  return (
    <div className="space-y-6">

      {/* زر الرجوع */}
      <Link href="/dashboard/courses" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowRight className="w-4 h-4" />
        <span>العودة للكورسات</span>
      </Link>

      {/* هيدر الكورس */}
      <Card className="overflow-hidden">
        <div className="relative aspect-3/1 bg-muted">
          {course.thumbnail ? (
            <Image
              src={getImageUrl(course.thumbnail) || ""}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-0 right-0 left-0 p-6 text-white">
            <h1 className="text-2xl md:text-3xl font-extrabold mb-2">{course.title}</h1>
            {course.description && (
              <p className="text-white/80 text-sm md:text-base max-w-2xl line-clamp-2">{course.description}</p>
            )}
          </div>
        </div>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><PlayCircle className="w-4 h-4" />{totalLectures} محاضرة</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{gradeLabels[course.grade] || course.grade}</span>
            {!course.is_enrolled && <span className="text-destructive font-medium">غير مشترك</span>}
          </div>
        </CardContent>
      </Card>

      {/* شريط التقدم */}
      {progress && progress.total_lectures > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-foreground">تقدمك في الكورس</span>
              <span className="text-sm font-bold text-primary">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <PlayCircle className="w-3.5 h-3.5" />
                {progress.watched} / {progress.total_lectures} محاضرة اتشافت
              </span>
              {progress.exam_stats.taken > 0 && (
                <span className="flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" />
                  {progress.exam_stats.passed} / {progress.exam_stats.taken} اختبار اتجاز
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* اختبارات الكورس العامة */}
      {courseExams.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-chart-4" />اختبارات الكورس
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {courseExams.map(exam => {
              const isExpired = exam.is_closed
              return isExpired ? (
                <div key={exam.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <span className="font-medium text-sm">{exam.title}</span>
                  <span className="text-xs text-red-500 font-bold">انتهى وقت الاختبار</span>
                </div>
              ) : (
                <Link key={exam.id} href={`/dashboard/exam/${exam.id}`}
                  className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors">
                  <span className="font-medium text-sm">{exam.title}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{exam.duration_minutes} دقيقة</span>
                    <span className="text-xs font-bold text-chart-4">ابدأ</span>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* واجبات الكورس العامة */}
      {courseHomeworks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />واجبات الكورس
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {courseHomeworks.map(hw => {
              const isExpired = hw.is_expired
              return isExpired ? (
                <div key={hw.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <span className="font-medium text-sm">{hw.title}</span>
                  <span className="text-xs text-red-500 font-bold">انتهى وقت التسليم</span>
                </div>
              ) : (
                <Link key={hw.id} href={`/dashboard/homework/${hw.id}`}
                  className="flex items-center justify-between p-3 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-xl transition-colors">
                  <span className="font-medium text-sm">{hw.title}</span>
                  <span className="text-xs font-bold text-blue-500">حل</span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* محتوى الكورس */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">محتوى الكورس</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {course.units.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">مفيش محاضرات متاحة دلوقتي</p>
            </div>
          ) : (
            // ====== Accordion المستوى الأول: الوحدات ======
            <Accordion type="multiple" defaultValue={course.units.map(u => `unit-${u.id}`)} className="w-full">
              {course.units.map((unit, unitIdx) => (
                <AccordionItem key={unit.id} value={`unit-${unit.id}`} className="border-b border-border">

                  {/* هيدر الوحدة */}
                  <AccordionTrigger className="px-4 md:px-6 py-4 hover:bg-muted/50 hover:no-underline">
                    <div className="flex items-center gap-3 text-right">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {unitIdx + 1}
                      </div>
                      <div>
                        <span className="font-bold block">{unit.title}</span>
                        <span className="text-xs text-muted-foreground">{unit.lectures.length} محاضرة</span>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pb-0">
                    {/* ====== Accordion المستوى الثاني: المحاضرات ====== */}
                    <Accordion type="multiple" className="w-full">
                      {unit.lectures.map((lecture, lecIdx) => {
                        const lectureItems = items.filter(i => i.lecture_id === lecture.id)
                        const isLocked = !lecture.is_enrolled

                        return (
                          <AccordionItem key={lecture.id} value={`lec-${lecture.id}`} className="border-t border-border/60">

                            {/* هيدر المحاضرة */}
                            <AccordionTrigger className={`px-6 md:px-8 py-3 hover:bg-muted/40 hover:no-underline ${isLocked ? "opacity-60" : ""}`}>
                              <div className="flex items-center gap-3 text-right w-full pl-2">
                                <div className="shrink-0">
                                  {isLocked
                                    ? <Lock className="w-4 h-4 text-muted-foreground" />
                                    : lecture.video_url
                                      ? <PlayCircle className="w-4 h-4 text-primary" />
                                      : <FileText className="w-4 h-4 text-secondary" />}
                                </div>
                                <div className="flex-1 min-w-0 text-right">
                                  <h4 className={`font-medium text-sm ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                                    {lecIdx + 1}. {lecture.title}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {lecture.duration_minutes && (
                                      <span className="text-xs text-muted-foreground">{lecture.duration_minutes} دقيقة</span>
                                    )}
                                    {lecture.lecture_type === "free" && (
                                      <span className="text-xs text-chart-3 font-bold">مجاني</span>
                                    )}
                                    {lecture.pdf_url && !isLocked && (
                                      <span className="text-xs text-secondary">+ PDF</span>
                                    )}
                                    {lectureItems.filter(i => i.kind === "exam").length > 0 && !isLocked && (
                                      <span className="text-xs text-chart-4 font-bold">+ اختبار</span>
                                    )}
                                    {lectureItems.filter(i => i.kind === "homework").length > 0 && !isLocked && (
                                      <span className="text-xs text-blue-500 font-bold">+ واجب</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>

                            {/* محتوى المحاضرة */}
                            <AccordionContent className="pb-0">
                              <div className="px-8 md:px-10 py-4 bg-muted/20 space-y-3 border-t border-border/40">

                                {isLocked ? (
                                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                                    <Lock className="w-4 h-4 shrink-0" />
                                    <span>فعّل اشتراكك عشان تقدر تشوف المحاضرة دي</span>
                                  </div>
                                ) : (
                                  <>
                                    {/* وصف المحاضرة */}
                                    {lecture.description && (
                                      <p className="text-sm text-muted-foreground">{lecture.description}</p>
                                    )}

                                    {/* الفيديو */}
                                    {lecture.video_url && (
                                      <Link
                                        href={`/dashboard/watch/${lecture.id}`}
                                        className="flex items-center gap-3 p-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl transition-colors"
                                      >
                                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                                          <PlayCircle className="w-5 h-5 text-primary-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-bold text-sm text-primary">شاهد المحاضرة</p>
                                          {lecture.duration_minutes && (
                                            <p className="text-xs text-muted-foreground">{lecture.duration_minutes} دقيقة</p>
                                          )}
                                        </div>
                                        <ExternalLink className="w-4 h-4 text-primary shrink-0" />
                                      </Link>
                                    )}

                                    {/* PDF */}
                                    {lecture.pdf_url && (
                                      <a
                                        href={lecture.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 bg-secondary/5 hover:bg-secondary/10 border border-secondary/20 rounded-xl transition-colors"
                                      >
                                        <div className="w-9 h-9 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
                                          <FileText className="w-5 h-5 text-secondary" />
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-bold text-sm text-foreground">ملف الشرح PDF</p>
                                          <p className="text-xs text-muted-foreground">اضغط للتحميل أو العرض</p>
                                        </div>
                                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                                      </a>
                                    )}

                                    {/* الاختبارات والواجبات */}
                                    {lectureItems.map(item => {
                                      const isExpired = item.kind === "homework" && item.is_expired
                                      return isExpired ? (
                                        <div
                                          key={item.id}
                                          className="flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                                        >
                                          <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-800/40 flex items-center justify-center shrink-0">
                                            <FileText className="w-5 h-5 text-red-500" />
                                          </div>
                                          <div className="flex-1">
                                            <p className="font-bold text-sm text-foreground">{item.title}</p>
                                            <p className="text-xs text-red-500 font-bold">انتهى وقت التسليم</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <Link
                                          key={item.id}
                                          href={item.kind === "homework" ? `/dashboard/homework/${item.id}` : `/dashboard/exam/${item.id}`}
                                          className={`flex items-center gap-3 p-3 rounded-xl transition-colors border ${item.kind === "homework" ? "bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20" : "bg-chart-4/5 hover:bg-chart-4/10 border-chart-4/20"}`}
                                        >
                                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.kind === "homework" ? "bg-blue-500/20" : "bg-chart-4/20"}`}>
                                            {item.kind === "homework"
                                              ? <FileText className="w-5 h-5 text-blue-500" />
                                              : <FileCheck className="w-5 h-5 text-chart-4" />}
                                          </div>
                                          <div className="flex-1">
                                            <p className="font-bold text-sm text-foreground">{item.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {item.kind === "homework" ? "واجب" : `${item.duration_minutes} دقيقة`}
                                            </p>
                                          </div>
                                          <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${item.kind === "homework" ? "text-blue-500 bg-blue-500/10" : "text-chart-4 bg-chart-4/10"}`}>
                                            {item.kind === "homework" ? "حل" : "ابدأ"}
                                          </span>
                                        </Link>
                                      )
                                    })}
                                  </>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  )
}