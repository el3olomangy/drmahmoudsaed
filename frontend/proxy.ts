import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PATHS = ["/dashboard"]

// الصفحات دي للمدرّس بس (مش المساعد)
const TEACHER_ONLY_PATHS = [
  "/dashboard/admin/assistants",
  "/dashboard/admin/grade-images",
]

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get("token")?.value
  const role = request.cookies.get("user_role")?.value

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))

  // لو حاول يدخل dashboard من غير login — روحه للـ login
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isProtected && token) {
    const isAdminArea = pathname.startsWith("/dashboard/admin")
    const isStudentArea = isProtected && !isAdminArea && pathname !== "/unauthorized"

    // منطقة الأدمن (مدرّس/مساعد) — الطالب ملوش أكسس هنا خالص
    if (isAdminArea && role === "student") {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // منطقة الطالب — المدرّس والمساعد ملهومش أكسس هنا خالص
    if (isStudentArea && (role === "teacher" || role === "assistant")) {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // صفحات مخصوصة للمدرّس بس — المساعد ممنوع يدخلها حتى باللينك المباشر
    const isTeacherOnly = TEACHER_ONLY_PATHS.some(p => pathname.startsWith(p))
    if (isTeacherOnly && role === "assistant") {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}