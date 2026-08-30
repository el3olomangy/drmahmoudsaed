/**
 * الأفاتار الافتراضي للطالب اللي لسه مرفعش صورة.
 * بيعرض شكل 3D (ولد/بنت) حسب النوع، ولو النوع مش معروف بيرجع للحروف الأولى من الاسم.
 * الكومبوننت بيملأ الحاوية اللي حواليه (المفروض تكون rounded-full overflow-hidden).
 */

function normalizeGender(gender?: string | null): "male" | "female" | null {
  const g = (gender || "").toLowerCase()
  if (["female", "f", "أنثى", "بنت", "girl"].includes(g)) return "female"
  if (["male", "m", "ذكر", "ولد", "boy"].includes(g)) return "male"
  return null
}

function initialsOf(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  const s = (parts[0]?.[0] || "") + (parts[1]?.[0] || "")
  return s.trim() || "؟"
}

export function DefaultAvatar({
  gender,
  name,
  className = "",
}: {
  gender?: string | null
  name?: string | null
  className?: string
}) {
  const g = normalizeGender(gender)

  if (g) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={g === "female" ? "/girl-face.svg" : "/boy-face.svg"}
        alt={name || "صورة الطالب"}
        className={`w-full h-full object-cover ${className}`}
      />
    )
  }

  // مفيش نوع معروف → حروف أولى
  return (
    <span className="w-full h-full flex items-center justify-center font-extrabold text-primary bg-primary/10">
      {initialsOf(name)}
    </span>
  )
}
