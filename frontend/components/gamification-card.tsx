"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Sparkles, Eye, Loader2 } from "lucide-react"
import { gamificationAPI } from "@/lib/api"

interface Gami {
  level: number
  title: string
  total_xp: number
  next_level_min_xp: number | null
  next_level_title: string | null
  xp_remaining: number
  progress_percent: number
  is_max_level: boolean
  leaderboard_visible: boolean
}

export function GamificationCard() {
  const [data, setData] = useState<Gami | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingVis, setSavingVis] = useState(false)

  useEffect(() => {
    let alive = true
    gamificationAPI
      .getMe()
      .then((d: any) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const toggleVisibility = async (visible: boolean) => {
    if (!data) return
    setSavingVis(true)
    const prev = data.leaderboard_visible
    setData({ ...data, leaderboard_visible: visible }) // تفاؤلي
    try {
      await gamificationAPI.setVisibility(visible)
    } catch {
      setData({ ...data, leaderboard_visible: prev }) // رجوع لو فشل
    } finally {
      setSavingVis(false)
    }
  }

  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />
  if (!data) return null

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      {/* رأس ملوّن — Level و Title و XP */}
      <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white p-5">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <Sparkles className="w-40 h-40 absolute -top-6 -left-6" />
        </div>
        <div className="relative flex items-center gap-4">
          {/* شارة الـ Level */}
          <div className="shrink-0 w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex flex-col items-center justify-center border border-white/25">
            <span className="text-[10px] font-medium opacity-90 leading-none">LEVEL</span>
            <span className="text-2xl font-extrabold leading-none mt-0.5">{data.level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold truncate">{data.title}</p>
            <p className="text-sm text-white/90 mt-0.5 flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              {data.total_xp.toLocaleString("en-US")} XP
            </p>
          </div>
        </div>

        {/* شريط التقدّم */}
        <div className="relative mt-4">
          <div className="h-3 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${data.progress_percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-xs text-white/90">
            {data.is_max_level ? (
              <span className="font-medium">وصلت لأعلى Level 🎉</span>
            ) : (
              <>
                <span>
                  {data.total_xp.toLocaleString("en-US")} /{" "}
                  {data.next_level_min_xp?.toLocaleString("en-US")} XP
                </span>
                <span className="font-medium">
                  باقي {data.xp_remaining.toLocaleString("en-US")} XP لـ {data.next_level_title}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* إعداد الظهور في الترتيب */}
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">إظهار حسابي في ترتيب الطلاب</p>
              <p className="text-xs text-muted-foreground">
                لو قفلته، مش هتظهر في لوحة المتصدرين في الصفحة الرئيسية.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savingVis && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={data.leaderboard_visible}
              onCheckedChange={toggleVisibility}
              disabled={savingVis}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
