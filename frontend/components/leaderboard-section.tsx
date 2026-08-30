"use client"

import { useEffect, useState } from "react"
import { gamificationAPI } from "@/lib/api"
import { getImageUrl } from "@/lib/utils/image"
import { Trophy, Crown, Medal, Loader2 } from "lucide-react"

interface LbStudent {
  id: string
  name: string
  avatar_url: string | null
  default_avatar: string
  grade: string | null
  total_xp: number
  level: number
  title: string
  rank: number
}

const GRADES: { value: string; label: string }[] = [
  { value: "", label: "كل الصفوف" },
  { value: "first_preparatory", label: "أولى إعدادي" },
  { value: "second_preparatory", label: "تانية إعدادي" },
  { value: "third_preparatory", label: "تالتة إعدادي" },
  { value: "first_secondary", label: "أولى ثانوي" },
  { value: "second_secondary", label: "تانية ثانوي" },
  { value: "third_secondary", label: "تالتة ثانوي" },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).trim() || "؟"
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return <Crown className="w-5 h-5 text-yellow-500" aria-label="الأول" />
  if (rank === 2)
    return <Medal className="w-5 h-5 text-slate-400" aria-label="الثاني" />
  if (rank === 3)
    return <Medal className="w-5 h-5 text-amber-700" aria-label="الثالث" />
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>
}

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
            <ol className="space-y-2.5">
              {students.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 bg-background transition-shadow hover:shadow-sm ${
                    s.rank <= 3 ? "border-primary/30" : "border-border"
                  }`}
                >
                  <div className="w-6 flex justify-center shrink-0">
                    <RankBadge rank={s.rank} />
                  </div>

                  {/* الصورة أو الأفاتار الافتراضي */}
                  <div
                    className={`w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold ${
                      s.default_avatar === "female"
                        ? "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300"
                        : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                    }`}
                  >
                    {s.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(s.avatar_url) || undefined}
                        alt={s.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials(s.name)
                    )}
                  </div>

                  {/* الاسم و Level */}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Level {s.level} — {s.title}
                    </p>
                  </div>

                  {/* XP */}
                  <div className="shrink-0 text-left">
                    <p className="font-extrabold text-primary leading-none">
                      {s.total_xp.toLocaleString("en-US")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">XP</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}