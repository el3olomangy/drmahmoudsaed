"use client"

import { useEffect, useState } from "react"
import { gamificationAPI } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Users, Sparkles } from "lucide-react"
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

export default function AdminLeaderboardPage() {
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
          limit: 50,
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

  const totalXp = students.reduce((sum, s) => sum + (s.total_xp || 0), 0)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* رأس بنفس استايل نظام التقييم */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white p-5">
        <Sparkles className="w-40 h-40 absolute -top-6 -left-6 opacity-15" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/25">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">ترتيب الطلاب على المنصة</h1>
            <p className="text-sm text-white/90">
              تابع أشطر الطلاب في كل مرحلة حسب الـ XP والـ Level
            </p>
          </div>
        </div>
      </div>

      {/* ملخّص */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-extrabold leading-none">{students.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {grade ? "طالب في الصف" : "طالب في الترتيب"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-extrabold leading-none">
                {totalXp.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">إجمالي XP المعروض</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* فلتر الصف */}
      <div className="flex flex-wrap items-center gap-2">
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
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>لسه مفيش طلاب في الترتيب — أول ما الطلاب يجمعوا XP هيظهروا هنا.</p>
          </CardContent>
        </Card>
      ) : (
        <LeaderboardList students={students} />
      )}
    </div>
  )
}
