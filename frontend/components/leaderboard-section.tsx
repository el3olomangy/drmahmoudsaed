"use client"

import { useEffect, useState } from "react"
import { gamificationAPI } from "@/lib/api"
import { Trophy, Loader2 } from "lucide-react"
import { LeaderboardList, type LbStudent } from "@/components/leaderboard-list"

const GRADES: { value: string; label: string }[] = [
  { value: "", label: "كل الصفوف" },
  { value: "first_preparatory", label: "أولى إعدادي" },
  { value: "second_preparatory", label: "تانية إعدادي" },
  { value: "third_preparatory", label: "تالتة إعدادي" },
  { value: "first_secondary", label: "أولى ثانوي" },
  { value: "second_secondary", label: "تانية ثانوي" },
  { value: "third_secondary", label: "تالتة ثانوي" },
]

export function LeaderboardSection() {
  const [students, setStudents] = useState<LbStudent[]>([])
  const [grade, setGrade] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const run = async () => {
      setLoading(true)
      try {
        const d: any = await gamificationAPI.getLeaderboard({
          grade: grade || undefined,
          limit: 10,
        })
        if (alive) setStudents(d?.students || [])
      } catch {
        if (alive) setStudents([])
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [grade])

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-primary font-bold">
            <Trophy className="w-6 h-6" />
            <span>ترتيب الطلاب</span>
          </div>
          <h2 className="mt-2 text-3xl font-extrabold">🏆 أشطر الطلاب على المنصة</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            الطلاب الأكتر إنجازًا ونشاطًا. ذاكر، حل، واتفرّج على محاضراتك عشان تطلع في القائمة.
          </p>
        </div>

        {/* فلتر الصف */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {GRADES.map((g) => (
            <button
              key={g.value}
              onClick={() => setGrade(g.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                grade === g.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* القائمة */}
        <div className="mt-8 max-w-2xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              لسه مفيش طلاب في الترتيب — كن أول واحد! 🚀
            </div>
          ) : (
            <LeaderboardList students={students} />
          )}
        </div>
      </div>
    </section>
  )
}
