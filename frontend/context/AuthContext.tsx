"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  first_name: string
  last_name: string
  phone: string
  role: "student" | "teacher" | "assistant"
  grade?: string
  governorate?: string
  gender?: string
  avatar_url?: string | null
  is_active: boolean
  enrolled_courses: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (token: string, user: User, refreshToken?: string) => void
  logout: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // تحميل البيانات من localStorage عند بدء التطبيق
  useEffect(() => {
    const init = async () => {
      try {
        const savedToken = localStorage.getItem("token")
        const savedUser = localStorage.getItem("user")

        if (savedToken && savedUser) {
          const parsedUser = JSON.parse(savedUser)
          setToken(savedToken)
          setUser(parsedUser)
          document.cookie = `token=${savedToken}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
          document.cookie = `user_role=${parsedUser.role}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`

          // جيب أحدث بيانات المستخدم من الـ API (خصوصاً enrolled_courses)
          try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1"}/auth/me`,
              { headers: { Authorization: `Bearer ${savedToken}` } }
            )
            if (res.ok) {
              const freshUser = await res.json()
              const updatedUser = { ...parsedUser, ...freshUser }
              localStorage.setItem("user", JSON.stringify(updatedUser))
              setUser(updatedUser)
            }
          } catch {}
        }
      } catch (error) {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const login = useCallback((newToken: string, newUser: User, refreshToken?: string) => {
    localStorage.setItem("token", newToken)
    localStorage.setItem("user", JSON.stringify(newUser))
    if (refreshToken) localStorage.setItem("refresh_token", refreshToken)
    document.cookie = `token=${newToken}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    document.cookie = `user_role=${newUser.role}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token")
      const accessToken = localStorage.getItem("token")
      if (refreshToken && accessToken) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1"}/auth/logout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }
        ).catch(() => {})
      }
    } finally {
      localStorage.removeItem("token")
      localStorage.removeItem("refresh_token")
      localStorage.removeItem("user")
      document.cookie = "token=; path=/; max-age=0"
      document.cookie = "user_role=; path=/; max-age=0"
      setToken(null)
      setUser(null)
      router.push("/login")
    }
  }, [router])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null
      const updated = { ...prev, ...updates }
      localStorage.setItem("user", JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth لازم يتستخدم جوا AuthProvider")
  return ctx
}