"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KeyRound, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react"
import { codesAPI, usersAPI } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link"

export default function ActivateCodePage() {
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const { updateUser, user } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setIsLoading(true)
    setStatus("idle")

    try {
      const data: any = await codesAPI.activate(code.trim())

      // حدّث الـ enrolled_courses في الـ AuthContext
      // الـ API بيرجع enrolled_courses كـ list من الـ IDs الجديدة
      // حدّث enrolled_courses من الـ API مباشرة عشان تضمن التزامن
      try {
        const profile: any = await usersAPI.getMyProfile()
        updateUser({
          enrolled_courses: profile.enrolled_courses || [],
          first_name: profile.first_name,
          last_name: profile.last_name,
          governorate: profile.governorate,
        })
      } catch {
        // fallback للطريقة القديمة
        if (data.enrolled_courses?.length && user) {
          const updatedCourses = [
            ...(user.enrolled_courses || []),
            ...data.enrolled_courses.filter((id: string) => !user.enrolled_courses?.includes(id))
          ]
          updateUser({ enrolled_courses: updatedCourses })
        }
      }

      setStatus("success")
      setMessage(data.message || "تم تفعيل الكود بنجاح!")
      setCode("")
    } catch (err: any) {
      setStatus("error")
      setMessage(err.message || "الكود غير صحيح أو منتهي الصلاحية")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>العودة للرئيسية</span>
      </Link>

      <Card>
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-extrabold">تفعيل كود الاشتراك</CardTitle>
          <CardDescription>
            أدخل كود الاشتراك اللي حصلت عليه لتفعيل الكورس
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="مثال: ABC123XYZ"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setStatus("idle")
              }}
              className="text-center text-lg font-mono tracking-widest py-6"
              dir="ltr"
              maxLength={20}
              disabled={isLoading}
            />

            {status === "success" && (
              <div className="flex items-start gap-3 p-4 bg-chart-3/10 border border-chart-3/30 rounded-xl">
                <CheckCircle className="w-5 h-5 text-chart-3 shrink-0 mt-0.5" />
                <div>
                  <p className="text-chart-3 font-bold text-sm">{message}</p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-destructive text-sm">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full font-bold py-4 rounded-xl text-base transition-colors ${
                !code.trim()
                  ? "bg-primary/50 text-white cursor-not-allowed"
                  : isLoading
                  ? "bg-primary/80 text-white cursor-wait"
                  : "bg-primary hover:bg-primary/90 text-white"
              }`}
            >
              {isLoading ? "جاري التفعيل..." : "تفعيل الكود"}
            </button>

            {status === "success" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/dashboard/courses")}
              >
                عرض كورساتي
              </Button>
            )}
          </form>

          <div className="mt-6 p-4 bg-muted rounded-xl">
            <h3 className="font-bold text-foreground mb-2">ازاي تحصل على كود؟</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>- من خلال مراكز البيع المعتمدة</li>
              <li>- من خلال الوكلاء والموزعين</li>
              <li>- من خلال التواصل مع فريق العلومنجي</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}