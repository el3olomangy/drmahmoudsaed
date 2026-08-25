"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { KeyRound, PlayCircle, BookOpen, RefreshCw } from "lucide-react"
import { coursesAPI } from "@/lib/api"
import { getImageUrl } from "@/lib/utils/image"

interface Course {
  id: string
  title: string
  description?: string
  thumbnail?: string
  lectures_count: number
  is_enrolled: boolean
  grade?: string
  course_type?: "free" | "paid"
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-video bg-muted">
        {course.thumbnail ? (
          <img src={getImageUrl(course.thumbnail) || ""} alt={course.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
        {!course.is_enrolled && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="bg-primary text-white px-4 py-2 rounded-full text-sm font-bold">غير مشترك</span>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-lg text-foreground">{course.title}</h3>
          {course.course_type === "free" && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-chart-3/10 text-chart-3 shrink-0">
              مجاني
            </span>
          )}
        </div>
        {course.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <PlayCircle className="w-4 h-4" />
            {course.lectures_count} محاضرة
          </span>
        </div>
        {course.is_enrolled ? (
          <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href={`/dashboard/courses/${course.id}`}>
              <BookOpen className="w-4 h-4 ml-2" />
              متابعة الكورس
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full border-primary text-primary hover:bg-primary hover:text-white">
            <Link href="/dashboard/activate">
              <KeyRound className="w-4 h-4 ml-2" />
              ادخل كود الاشتراك
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function CourseSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <Skeleton className="aspect-video w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-9 w-full mt-2" />
      </div>
    </div>
  )
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchCourses = async () => {
    setIsLoading(true)
    setError("")
    try {
      const data = await coursesAPI.getAll() as Course[]
      setCourses(data)
    } catch (err: any) {
      setError(err.message || "حصل خطأ في تحميل الكورسات")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  const myCourses = courses.filter(c => c.is_enrolled)
  const availableCourses = courses.filter(c => !c.is_enrolled)

  return (
    <div className="space-y-8">

      {/* Error state */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchCourses}>
            <RefreshCw className="w-4 h-4 ml-1" />
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* My Courses */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">
              كورساتي
              {!isLoading && myCourses.length > 0 && (
                <span className="mr-2 text-sm font-normal text-muted-foreground">({myCourses.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <CourseSkeleton key={i} />)}
              </div>
            ) : myCourses.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myCourses.map(course => <CourseCard key={course.id} course={course} />)}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">مش مشترك في أي كورس لسه</p>
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href="/dashboard/activate">
                    <KeyRound className="w-4 h-4 ml-2" />
                    فعّل كود الاشتراك
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Available Courses */}
      {(isLoading || availableCourses.length > 0) && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">
                كورسات متاحة
                {!isLoading && availableCourses.length > 0 && (
                  <span className="mr-2 text-sm font-normal text-muted-foreground">({availableCourses.length})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2].map(i => <CourseSkeleton key={i} />)}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableCourses.map(course => <CourseCard key={course.id} course={course} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}