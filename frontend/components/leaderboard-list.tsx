"use client"

import { Crown, Medal } from "lucide-react"
import { DefaultAvatar } from "@/components/default-avatar"
import { getImageUrl } from "@/lib/utils/image"

export interface LbStudent {
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

const gradeLabels: Record<string, string> = {
  first_preparatory: "أولى إعدادي",
  second_preparatory: "تانية إعدادي",
  third_preparatory: "تالتة إعدادي",
  first_secondary: "أولى ثانوي",
  second_secondary: "تانية ثانوي",
  third_secondary: "تالتة ثانوي",
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" aria-label="الأول" />
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" aria-label="الثاني" />
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-700" aria-label="الثالث" />
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>
}

export function LeaderboardList({
  students,
  showGrade = true,
  highlightId,
}: {
  students: LbStudent[]
  showGrade?: boolean
  highlightId?: string
}) {
  return (
    <ol className="space-y-2.5">
      {students.map((s) => (
        <li
          key={s.id}
          className={`flex items-center gap-3 rounded-2xl border p-2.5 sm:p-3 transition-shadow hover:shadow-sm ${
            highlightId && s.id === highlightId
              ? "border-primary ring-2 ring-primary/30 bg-primary/5"
              : s.rank <= 3
              ? "border-primary/30 bg-background"
              : "border-border bg-background"
          }`}
        >
          <div className="w-6 flex justify-center shrink-0">
            <RankBadge rank={s.rank} />
          </div>

          {/* الصورة أو الأفاتار الافتراضي */}
          <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-2 ring-background shadow-sm">
            {s.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getImageUrl(s.avatar_url) || undefined}
                alt={s.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <DefaultAvatar gender={s.default_avatar} name={s.name} />
            )}
          </div>

          {/* الاسم و Level */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold truncate">{s.name}</p>
              {highlightId && s.id === highlightId && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
                  أنت
                </span>
              )}
              {showGrade && s.grade && (
                <span className="hidden sm:inline text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
                  {gradeLabels[s.grade] || s.grade}
                </span>
              )}
            </div>
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
  )
}
