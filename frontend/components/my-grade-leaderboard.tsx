"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Medal } from "lucide-react"
import { gamificationAPI } from "@/lib/api"
import { LeaderboardList, type LbStudent } from "@/components/leaderboard-list"

interface MyRank {
  ranked: boolean
  rank: number | null
  total_ranked: number
  total_xp: number
  level: number
  title: string
}

export function MyGradeLeaderboard({
  grade,
  myId,
}: {
  grade?: string | null
  myId?: string
}) {
  const [students, setStudents] = useState<LbStudent[]>([])
  const [myRank, setMyRank] = useState<MyRank | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const run = async () => {
      setLoading(true)
      try {
        const [top, mine]: [any, any] = await Promise.all([
          gamificationAPI.getLeaderboard({ grade: grade || undefined, limit: 5 }),
          gamificationAPI.getMyRank().catch(() => null),
        ])
        if (!alive) return
        setStudents(top?.students || [])
        setMyRank(mine || null)
      } catch {
        if (alive) {
          setStudents([])
          setMyRank(null)
        }
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [grade])

  // لو الطالب ضمن الـ Top 5 المعروضين، مش محتاجين نكرر سطر "ترتيبك"
  const inTop = !!myId && students.some((s) => s.id === myId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          أوائل مرحلتك
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            لسه مفيش أوائل في مرحلتك — ذاكر وحل واتفرّج على محاضراتك عشان تبقى أنت الأول! 🚀
          </div>
        ) : (
          <>
            <LeaderboardList students={students} showGrade={false} highlightId={myId} />

            {/* ترتيب الطالب نفسه */}
            {myRank && myRank.ranked && !inTop && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Medal className="w-4 h-4 text-primary" />
                  <span className="font-bold">ترتيبك</span>
                  <span className="text-muted-foreground">من {myRank.total_ranked} في مرحلتك</span>
                </div>
                <span className="text-lg font-extrabold text-primary">#{myRank.rank}</span>
              </div>
            )}

            {myRank && !myRank.ranked && (
              <p className="mt-3 text-xs text-muted-foreground text-center">
                لسه مالكش ترتيب — أول ما تجمّع XP هتدخل القائمة.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
