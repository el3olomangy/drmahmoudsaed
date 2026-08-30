// ============================================================
// lib/api.ts — كل الـ API calls بتاعت المنصة
// الـ Base URL بتاخده من .env.local
// ============================================================

import { Upload as TusUpload } from "tus-js-client"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

let refreshPromise: Promise<boolean> | null = null

function clearSessionAndRedirect() {
  if (typeof window === "undefined") return
  localStorage.removeItem("token")
  localStorage.removeItem("refresh_token")
  localStorage.removeItem("user")
  document.cookie = "token=; path=/; max-age=0"
  document.cookie = "user_role=; path=/; max-age=0"
  window.location.href = "/login"
}

// يحاول يجدد الـ access token باستخدام الـ refresh token المحفوظ
// عشان المستخدم يفضل مسجل دخول لحد ما يغيّر الباسورد أو الـ refresh token ينتهي فعليًا
async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === "undefined") return false
  const refreshToken = localStorage.getItem("refresh_token")
  if (!refreshToken) return false

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
        if (!res.ok) return false
        const data = await res.json()
        localStorage.setItem("token", data.access_token)
        if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token)
        document.cookie = `token=${data.access_token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
        return true
      } catch {
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

async function request(
  endpoint: string,
  options: RequestInit = {},
  isFormData = false,
  isRetry = false
): Promise<any> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null

  const headers: Record<string, string> = {}

  if (!isFormData) {
    headers["Content-Type"] = "application/json"
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  })

  if (res.status === 401) {
    // لو أول مرة يفشل الطلب، جرب تجديد الـ token قبل ما تسجل خروج المستخدم
    if (!isRetry && endpoint !== "/auth/refresh" && endpoint !== "/auth/login") {
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        return request(endpoint, options, isFormData, true)
      }
    }
    clearSessionAndRedirect()
    throw new Error("غير مصرح")
  }

  if (!res.ok) {
  const errorData = await res.json().catch(() => ({}))
  let message = "حصل خطأ في السيرفر"
  if (typeof errorData.detail === "string") {
    message = errorData.detail
  } else if (Array.isArray(errorData.detail)) {
    message = errorData.detail
      .map((d: any) => d.msg || JSON.stringify(d))
      .join(" - ")
  } else if (errorData.detail) {
    message = JSON.stringify(errorData.detail)
  }
  throw new Error(message)
  }

  const text = await res.text()
  if (!text) return {}
  return JSON.parse(text)
}

// ============================================================
// AUTH
// ============================================================

export const authAPI = {
  register: (data: {
    first_name: string
    last_name: string
    phone: string
    parent_phone: string
    password: string
    grade?: string
    governorate?: string
    gender?: string
  }) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { phone: string; password: string; device_id: string }) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: (refresh_token: string) =>
    request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  me: () => request("/auth/me"),

  refresh: (refresh_token: string) =>
    request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  changePassword: (data: { old_password: string; new_password: string }) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}

// ============================================================
// COURSES
// ============================================================

export const coursesAPI = {
  getAll: () => request("/courses/"),

  getOne: (courseId: string) => request(`/courses/${courseId}`),

  create: (data: {
    title: string
    description?: string
    grade: string
    course_type?: "free" | "paid"
    price?: number
    thumbnail?: string
  }) =>
    request("/courses/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    courseId: string,
    data: {
      title: string
      description?: string
      grade: string
      course_type?: "free" | "paid"
      price?: number
      thumbnail?: string
    }
  ) =>
    request(`/courses/${courseId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (courseId: string) =>
    request(`/courses/${courseId}`, { method: "DELETE" }),

  createUnit: (courseId: string, data: { title: string; order: number }) =>
    request(`/courses/${courseId}/units`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteUnit: (courseId: string, unitId: string) =>
    request(`/courses/${courseId}/units/${unitId}`, { method: "DELETE" }),

  createLecture: (
    courseId: string,
    unitId: string,
    data: {
      title: string
      description?: string
      video_url?: string
      pdf_url?: string
      order: number
      lecture_type: string
      duration_minutes?: number
    }
  ) =>
    request(`/courses/${courseId}/units/${unitId}/lectures`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateLecture: (
    courseId: string,
    unitId: string,
    lectureId: string,
    data: {
      title?: string
      description?: string
      video_url?: string
      pdf_url?: string
      order?: number
      lecture_type?: string
      duration_minutes?: number
    }
  ) =>
    request(`/courses/${courseId}/units/${unitId}/lectures/${lectureId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteLecture: (courseId: string, unitId: string, lectureId: string) =>
    request(`/courses/${courseId}/units/${unitId}/lectures/${lectureId}`, {
      method: "DELETE",
    }),
}

// ============================================================
// CODES
// ============================================================

export const codesAPI = {
  getAll: () => request("/codes/"),

  generate: (data: {
    quantity: number
    code_type: "course" | "bundle"
    course_id?: string
    bundle_ids?: string[]
    expires_days?: number
  }) =>
    request("/codes/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  activate: (code: string) =>
    request("/codes/activate", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  disable: (codeId: string) =>
    request(`/codes/${codeId}/disable`, { method: "PATCH" }),

  delete: (codeId: string) =>
    request(`/codes/${codeId}`, { method: "DELETE" }),

  revoke: (codeId: string, userId: string) =>
    request(`/codes/${codeId}/revoke/${userId}`, { method: "PATCH" }),
}

// ============================================================
// EXAMS
// ============================================================

export const examsAPI = {
  getByCourse: (courseId: string) => request(`/exams/course/${courseId}`),

  getOne: (examId: string) => request(`/exams/${examId}`),

  getExamForAdmin: (examId: string) => request(`/exams/admin/${examId}`),

  create: (data: {
    title: string
    course_id: string
    lecture_id?: string
    unit_id?: string
    pass_score: number
    duration_minutes?: number
    show_result_immediately?: boolean
    scheduled_at?: string | null
    available_until?: string | null
    questions: {
      text: string
      question_type: "mcq" | "essay"
      points: number
      choices?: { text: string; is_correct: boolean }[]
      image_url?: string
      image_path?: string
    }[]
  }) =>
    request("/exams/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  fullUpdateExam: (examId: string, data: object) =>
    request(`/exams/${examId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteExam: (examId: string) =>
    request(`/exams/${examId}`, { method: "DELETE" }),

  updateExam: (examId: string, data: {
    title?: string
    duration_minutes?: number
    pass_score?: number
    show_result_immediately?: boolean
  }) =>
    request(`/exams/${examId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateExamFull: (examId: string, data: {
    title?: string
    duration_minutes?: number
    pass_score?: number
    show_result_immediately?: boolean
    questions?: {
      text: string
      question_type: "mcq" | "essay"
      points: number
      choices: { text: string; is_correct: boolean }[]
    }[]
  }) =>
    request(`/exams/${examId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  submit: (data: {
    exam_id: string
    answers: {
      question_id: string
      selected_choice?: string | null
      essay_answer?: string | null
      essay_answer_image_url?: string | null
      essay_answer_image_path?: string | null
    }[]
  }) =>
    request("/exams/submit", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ====== جلسة الامتحان (الوقت والمسودة على السيرفر) ======

  // حالة جلسة الطالب: submitted / active / none
  getAttemptStatus: (examId: string) =>
    request(`/exams/${examId}/my-attempt`),

  // يبدأ أو يستأنف جلسة امتحان — بيرجّع session_token و remaining_seconds و draft_answers
  startAttempt: (examId: string) =>
    request(`/exams/${examId}/start`, { method: "POST" }),

  // يحفظ إجابة سؤال واحد فورًا أثناء الحل
  saveAnswer: (
    examId: string,
    data: {
      session_token: string
      question_id: string
      selected_choice?: string | null
      essay_answer?: string | null
      essay_answer_image_url?: string | null
      essay_answer_image_path?: string | null
    }
  ) =>
    request(`/exams/${examId}/save-answer`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // التسليم النهائي من الطالب
  submitAttempt: (examId: string, sessionToken: string) =>
    request(`/exams/${examId}/submit-attempt`, {
      method: "POST",
      body: JSON.stringify({ session_token: sessionToken }),
    }),

  getMyResult: (examId: string) => request(`/exams/my-result/${examId}`),

  getResults: (examId: string) => request(`/exams/results/${examId}`),

  getForReview: (examId: string) => request(`/exams/review/${examId}`),

  submitReview: (
    resultId: string,
    data: { question_id: string; earned_points: number; teacher_comment?: string }[]
  ) =>
    request(`/exams/review`, {
      method: "POST",
      body: JSON.stringify({ result_id: resultId, grades: data }),
    }),
}

// ============================================================
// HOMEWORK (نظام مستقل تمامًا عن الامتحانات)
// ============================================================

export const homeworkAPI = {
  getByCourse: (courseId: string) => request(`/homework/course/${courseId}`),

  getOne: (homeworkId: string) => request(`/homework/${homeworkId}`),

  getForAdmin: (homeworkId: string) => request(`/homework/admin/${homeworkId}`),

  create: (data: {
    title: string
    course_id: string
    lecture_id?: string
    unit_id?: string
    pass_score: number
    show_result_immediately?: boolean
    scheduled_at?: string | null
    deadline?: string | null
    questions: {
      text: string
      question_type: "mcq" | "essay"
      points: number
      choices?: { text: string; is_correct: boolean }[]
      image_url?: string
      image_path?: string
    }[]
  }) =>
    request("/homework/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  fullUpdate: (homeworkId: string, data: object) =>
    request(`/homework/${homeworkId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (homeworkId: string) =>
    request(`/homework/${homeworkId}`, { method: "DELETE" }),

  update: (homeworkId: string, data: {
    title?: string
    pass_score?: number
    deadline?: string | null
    show_result_immediately?: boolean
  }) =>
    request(`/homework/${homeworkId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateFull: (homeworkId: string, data: {
    title?: string
    pass_score?: number
    show_result_immediately?: boolean
    scheduled_at?: string | null
    deadline?: string | null
    questions?: {
      text: string
      question_type: "mcq" | "essay"
      points: number
      choices: { text: string; is_correct: boolean }[]
    }[]
  }) =>
    request(`/homework/${homeworkId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  submit: (data: {
    homework_id: string
    answers: {
      question_id: string
      selected_choice?: string | null
      essay_answer?: string | null
      essay_answer_image_url?: string | null
      essay_answer_image_path?: string | null
    }[]
  }) =>
    request("/homework/submit", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyResult: (homeworkId: string) => request(`/homework/my-result/${homeworkId}`),

  // ====== جلسة الواجب (المسودة على السيرفر) ======

  // حالة جلسة الطالب: submitted / active / none
  getAttemptStatus: (homeworkId: string) =>
    request(`/homework/${homeworkId}/my-attempt`),

  // يبدأ أو يستأنف جلسة واجب — بيرجّع session_token و draft_answers
  startAttempt: (homeworkId: string) =>
    request(`/homework/${homeworkId}/start`, { method: "POST" }),

  // يحفظ إجابة سؤال واحد فورًا أثناء الحل
  saveAnswer: (
    homeworkId: string,
    data: {
      session_token: string
      question_id: string
      selected_choice?: string | null
      essay_answer?: string | null
      essay_answer_image_url?: string | null
      essay_answer_image_path?: string | null
    }
  ) =>
    request(`/homework/${homeworkId}/save-answer`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // التسليم النهائي من الطالب
  submitAttempt: (homeworkId: string, sessionToken: string) =>
    request(`/homework/${homeworkId}/submit-attempt`, {
      method: "POST",
      body: JSON.stringify({ session_token: sessionToken }),
    }),

  getResults: (homeworkId: string) => request(`/homework/results/${homeworkId}`),

  getForReview: (homeworkId: string) => request(`/homework/review/${homeworkId}`),

  submitReview: (
    resultId: string,
    data: { question_id: string; earned_points: number; teacher_comment?: string }[]
  ) =>
    request(`/homework/review`, {
      method: "POST",
      body: JSON.stringify({ result_id: resultId, grades: data }),
    }),
}

// ============================================================
// USERS
// ============================================================

export const usersAPI = {
  getMyProfile: () => request("/users/me/profile"),

  updateProfile: (data: {
    first_name?: string
    last_name?: string
    governorate?: string | null
  }) =>
    request("/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  uploadAvatar: async (file: File): Promise<{ message: string; avatar_url: string }> => {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch(`${BASE_URL}/users/me/avatar`, {
      method: "POST",
      headers: await authHeader(),
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "فشل رفع الصورة")
    }
    return res.json()
  },

  deleteAvatar: () => request("/users/me/avatar", { method: "DELETE" }),

  getAll: (params?: { grade?: string; search?: string }) => {
    const query = new URLSearchParams()
    if (params?.grade) query.append("grade", params.grade)
    if (params?.search) query.append("search", params.search)
    const qs = query.toString()
    return request(`/users/${qs ? "?" + qs : ""}`)
  },

  toggleActive: (userId: string) =>
    request(`/users/${userId}/toggle-active`, { method: "PATCH" }),

  deleteStudent: (userId: string) =>
    request(`/users/${userId}`, { method: "DELETE" }),

  resetDevice: (userId: string) =>
    request(`/users/${userId}/reset-device`, { method: "PATCH" }),

  resetPassword: (userId: string, newPassword: string) =>
    request(`/users/${userId}/reset-password`, {
      method: "PATCH",
      body: JSON.stringify({ new_password: newPassword }),
    }),

  forceLogout: (userId: string) =>
    request(`/users/${userId}/force-logout`, { method: "POST" }),
}

// ============================================================
// ASSISTANTS
// ============================================================

export const assistantsAPI = {
  getAll: () => request("/users/assistants-list"),

  create: (data: {
    first_name: string
    last_name: string
    phone: string
    password: string
  }) =>
    request("/users/assistants", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (userId: string) =>
    request(`/users/${userId}`, { method: "DELETE" }),

  resetPassword: (userId: string, newPassword: string) =>
    request(`/users/${userId}/reset-password`, {
      method: "PATCH",
      body: JSON.stringify({ new_password: newPassword }),
    }),
}

// ============================================================
// PROGRESS
// ============================================================

export const progressAPI = {
  savePosition: (lectureId: string, position: number, duration: number) =>
    request(`/progress/lecture/${lectureId}/position`, {
      method: "POST",
      body: JSON.stringify({ position, duration }),
    }),

  getPosition: (lectureId: string) =>
    request(`/progress/lecture/${lectureId}/position`),

  getCourseProgress: (courseId: string) =>
    request(`/progress/course/${courseId}`),

  getStudentCourseProgress: (studentId: string, courseId: string) =>
    request(`/progress/student/${studentId}/course/${courseId}`),

  getStudentFullDetails: (studentId: string) =>
    request(`/progress/student/${studentId}/full`),
}

// ============================================================
// GAMIFICATION (XP + Levels + Leaderboard)
// ============================================================

export const gamificationAPI = {
  // بروفايل الطالب الحالي (Level / Title / XP / التقدّم)
  getMe: () => request("/gamification/me"),
  // XP الطالب في كورس معيّن
  getMyCourseXp: (courseId: string) => request(`/gamification/me/course/${courseId}`),
  // تحكّم الطالب في ظهوره في الترتيب
  setVisibility: (visible: boolean) =>
    request("/gamification/me/visibility", {
      method: "PATCH",
      body: JSON.stringify({ visible }),
    }),
  // لوحة المتصدرين (عامة — تشتغل من غير تسجيل دخول)
  getLeaderboard: (params?: { grade?: string; limit?: number }) => {
    const q = new URLSearchParams(
      Object.entries(params || {})
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return request(`/gamification/leaderboard${q ? `?${q}` : ""}`)
  },
  getLevels: () => request("/gamification/levels"),
}

// ============================================================
// STATS
// ============================================================

export const statsAPI = {
  getOverview: () => request("/stats/overview"),

  getTopCourses: () => request("/stats/top-courses"),

  getRecentStudents: () => request("/stats/recent-students"),
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notificationsAPI = {
  getAll: () => request("/notifications/"),

  getUnreadCount: () => request("/notifications/unread-count"),

  markRead: (notificationId: string) =>
    request(`/notifications/${notificationId}/read`, { method: "PATCH" }),

  markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),

  send: (data: {
    title: string
    body: string
    notification_type: string
    target_grade?: string
    target_user_id?: string
  }) =>
    request("/notifications/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}

// ============================================================
// ASSIGNMENTS
// ============================================================

export const assignmentsAPI = {
  getOne: (assignmentId: string) =>
    request(`/assignments/single/${assignmentId}`),

  getByLecture: (lectureId: string) =>
    request(`/assignments/lecture/${lectureId}`),

  getByCourse: (courseId: string) =>
    request(`/assignments/course/${courseId}`),

  getMySubmissions: () => request("/assignments/my-submissions"),

  getSubmissions: (assignmentId: string) =>
    request(`/assignments/${assignmentId}/submissions`),

  submit: (data: { assignment_id: string; text_answer: string }) =>
    request("/assignments/submit", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  grade: (submissionId: string, data: { grade: number | null; teacher_note?: string | null }) =>
    request(`/assignments/submissions/${submissionId}/grade`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  create: (data: {
    title: string
    description: string
    lecture_id: string
    course_id: string
    deadline?: string
  }) =>
    request("/assignments/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (assignmentId: string) =>
    request(`/assignments/${assignmentId}`, { method: "DELETE" }),
}

// ============================================================
// UPLOAD
// ============================================================

export const uploadAPI = {
  image: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData()
    formData.append("file", file)

    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null

    const res = await fetch(`${BASE_URL}/upload/image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "فشل رفع الصورة")
    }

    return res.json()
  },
}

// ============================================================
// MEDIA — Bunny.net (صور المراحل/الكورسات/أسئلة الواجب والاختبار + فيديوهات المحاضرات)
// كل هذه الدوال بتنادي FastAPI بس — مفيش أي مفتاح Bunny إداري هنا نهائيًا
// ============================================================

export type MediaImageCategory =
  | "education_stage"
  | "course"
  | "homework_question"
  | "exam_question"
  // صور إجابة الطالب على الأسئلة المقالية (بدل الكتابة)
  | "exam_answer"
  | "homework_answer"

export interface UploadedMediaImage {
  type: "image"
  category: MediaImageCategory
  path: string
  url: string
}

export type LectureVideoStatus = "uploading" | "processing" | "ready" | "failed"

export interface LectureVideoInfo {
  video_id: string
  status: LectureVideoStatus
  title?: string | null
  length_seconds?: number | null
  // رابط تشغيل جاهز (iframe) — بيظهر بس لما الفيديو يخلص معالجة (status === "ready")
  playback_url?: string | null
}

// تصريح رفع مؤقت وآمن لبروتوكول TUS — المتصفح بيستخدمه يرفع على Bunny
// مباشرة من غير ما يعدي على الباك اند بتاعنا خالص (ضروري لاستضافة زي Vercel)
export interface TusUploadCredentials {
  endpoint: string
  library_id: string
  video_id: string
  expiration_time: number
  signature: string
}

async function authHeader(): Promise<Record<string, string>> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const mediaAPI = {
  // ------- صور (Bunny Storage) -------
  uploadImage: async (file: File, category: MediaImageCategory): Promise<UploadedMediaImage> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("category", category)

    const res = await fetch(`${BASE_URL}/media/images`, {
      method: "POST",
      headers: await authHeader(),
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "فشل رفع الصورة")
    }
    const data = await res.json()
    return data.media as UploadedMediaImage
  },

  deleteImage: async (path: string): Promise<boolean> => {
    const res = await fetch(`${BASE_URL}/media/images?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers: await authHeader(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "فشل حذف الصورة")
    }
    const data = await res.json()
    return !!data.success
  },

  // ------- فيديوهات المحاضرات (Bunny Stream — رفع مباشر بـ TUS) -------

  // الخطوة ١: إنشاء سجل فيديو على Bunny + استلام "تصريح رفع" TUS مؤقت وآمن.
  // الرفع الفعلي بعد كده بيحصل مباشرة من المتصفح لـ Bunny (شوف uploadVideoFile)
  // من غير ما ملف الفيديو نفسه يعدي على الباك اند بتاعنا خالص — ضروري لأي
  // استضافة serverless زي Vercel (حدود صغيرة لحجم الطلب ومدة التنفيذ).
  createLectureVideo: async (title?: string): Promise<{ video_id: string; tus: TusUploadCredentials }> => {
    const headers = await authHeader()
    const createRes = await fetch(
      `${BASE_URL}/media/videos?title=${encodeURIComponent(title || "Lecture Video")}`,
      { method: "POST", headers }
    )
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}))
      throw new Error(err.detail || "فشل إنشاء الفيديو")
    }
    const created = await createRes.json()
    return {
      video_id: created.video?.video_id as string,
      tus: created.tus_upload as TusUploadCredentials,
    }
  },

  // الخطوة ٢: رفع ملف الفيديو الفعلي مباشرة على Bunny عبر بروتوكول TUS
  // (resumable) — بيدعم استئناف الرفع تلقائيًا لو حصل انقطاع شبكة أو حتى
  // refresh للصفحة (tus-js-client بيحفظ تقدّم الرفع في المتصفح بنفسه).
  uploadVideoFile: (
    tus: TusUploadCredentials,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const upload = new TusUpload(file, {
        endpoint: tus.endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000],
        headers: {
          AuthorizationSignature: tus.signature,
          AuthorizationExpire: String(tus.expiration_time),
          VideoId: tus.video_id,
          LibraryId: tus.library_id,
        },
        metadata: {
          filetype: file.type || "video/mp4",
          title: file.name,
        },
        onError: (error) => {
          reject(new Error("انقطع الاتصال أثناء رفع الفيديو — تحقق من الإنترنت وحاول تاني (" + error.message + ")"))
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (onProgress) onProgress(Math.round((bytesUploaded / bytesTotal) * 100))
        },
        onSuccess: () => resolve(),
      })

      // لو فيه رفع سابق متقطّع لنفس الملف محفوظ في المتصفح، بيكمّل منه بدل
      // ما يرفع من الأول
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0])
        }
        upload.start()
      })
    })
  },

  // دالة مختصرة بتعمل الخطوتين مع بعض (لأي استخدام بسيط مش محتاج التحكم
  // في إعادة استخدام video_id عند الفشل — استخدم createLectureVideo +
  // uploadVideoFile مباشرة لو محتاج retry بيعيد استخدام نفس السجل)
  uploadLectureVideo: async (
    file: File,
    title?: string,
    onProgress?: (percent: number) => void
  ): Promise<LectureVideoInfo> => {
    const { video_id, tus } = await mediaAPI.createLectureVideo(title || file.name)
    await mediaAPI.uploadVideoFile(tus, file, onProgress)
    return { video_id, status: "processing" }
  },

  getVideoStatus: async (videoId: string): Promise<LectureVideoInfo> => {
    const res = await fetch(`${BASE_URL}/media/videos/${videoId}/status`, {
      headers: await authHeader(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "فشل معرفة حالة الفيديو")
    }
    const data = await res.json()
    return data.video as LectureVideoInfo
  },

  deleteLectureVideo: async (videoId: string): Promise<boolean> => {
    const res = await fetch(`${BASE_URL}/media/videos/${videoId}`, {
      method: "DELETE",
      headers: await authHeader(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "فشل حذف الفيديو")
    }
    const data = await res.json()
    return !!data.success
  },
}

// ============================================================
// GRADE IMAGES (صور بطاقات السنوات الدراسية في الصفحة الرئيسية)
// ============================================================

export const gradeImagesAPI = {
  getAll: (): Promise<Record<string, string>> => request("/grade-images/"),

  update: (grade: string, image_url: string) =>
    request(`/grade-images/${grade}`, {
      method: "PATCH",
      body: JSON.stringify({ image_url }),
    }),
}
// ============================================================
// نظام السنتر (حضور + مدفوعات) — للمعلم والمساعدين
// ============================================================
export const centerAPI = {
  // ===== المراحل =====
  listStages: () => request("/center/stages"),
  createStage: (name: string) =>
    request("/center/stages", { method: "POST", body: JSON.stringify({ name }) }),
  updateStage: (stageId: string, name: string) =>
    request(`/center/stages/${stageId}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteStage: (stageId: string) =>
    request(`/center/stages/${stageId}`, { method: "DELETE" }),

  // ===== المجموعات =====
  listGroups: (stageId: string) => request(`/center/stages/${stageId}/groups`),
  createGroup: (stageId: string, name: string) =>
    request("/center/groups", { method: "POST", body: JSON.stringify({ stage_id: stageId, name }) }),
  updateGroup: (groupId: string, data: { name?: string; stage_id?: string }) =>
    request(`/center/groups/${groupId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteGroup: (groupId: string) =>
    request(`/center/groups/${groupId}`, { method: "DELETE" }),

  // ===== الطلاب =====
  listStudents: (groupId: string) => request(`/center/groups/${groupId}/students`),
  getAllStudents: () => request("/center/students-all"),
  getStudent: (studentId: string) => request(`/center/students/${studentId}`),
  createStudent: (data: {
    group_id: string
    name: string
    student_number: string
    parent_phone: string
    monthly_fee: number
  }) => request("/center/students", { method: "POST", body: JSON.stringify(data) }),
  updateStudent: (studentId: string, data: {
    name?: string
    student_number?: string
    parent_phone?: string
    monthly_fee?: number
    group_id?: string
  }) => request(`/center/students/${studentId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStudent: (studentId: string) =>
    request(`/center/students/${studentId}`, { method: "DELETE" }),
  regenerateQr: (studentId: string) =>
    request(`/center/students/${studentId}/regenerate-qr`, { method: "POST" }),

  // ===== المدفوعات =====
  recordPayment: (studentId: string, data: { month?: string; amount?: number; note?: string }) =>
    request(`/center/students/${studentId}/payments`, { method: "POST", body: JSON.stringify(data) }),
  deletePayment: (paymentId: string) =>
    request(`/center/payments/${paymentId}`, { method: "DELETE" }),

  // ===== الاسكان =====
  scan: (qrToken: string, clientTime?: string) =>
    request("/center/scan", { method: "POST", body: JSON.stringify({ qr_token: qrToken, client_time: clientTime }) }),
  scanBatch: (scans: { qr_token: string; client_time?: string }[]) =>
    request("/center/scan/batch", { method: "POST", body: JSON.stringify({ scans }) }),

  // ===== التقارير =====
  reportToday: (params?: { stage_id?: string; group_id?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return request(`/center/reports/today${q ? `?${q}` : ""}`)
  },
  reportUnpaid: (params?: { stage_id?: string; group_id?: string; month?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return request(`/center/reports/unpaid${q ? `?${q}` : ""}`)
  },
  reportMonthly: (params?: { stage_id?: string; group_id?: string; month?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return request(`/center/reports/monthly${q ? `?${q}` : ""}`)
  },
  groupSummary: (groupId: string) => request(`/center/groups/${groupId}/summary`),

  // ===== الحضور اليومي =====
  attendanceDay: (params?: { date?: string; stage_id?: string; group_id?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return request(`/center/attendance/day${q ? `?${q}` : ""}`)
  },
  markManual: (studentId: string, date?: string) =>
    request("/center/attendance/manual", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, date }),
    }),
  unmarkAttendance: (studentId: string, date: string) => {
    const q = new URLSearchParams({ student_id: studentId, date }).toString()
    return request(`/center/attendance?${q}`, { method: "DELETE" })
  },
}
