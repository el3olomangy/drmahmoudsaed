"use client"

import { useEffect, useState } from "react"
import { gradeImagesAPI } from "@/lib/api"
import { getImageUrl } from "@/lib/utils/image"

// ===== أيقونات SVG علمية مخصصة لكل مرحلة =====

// الإعدادي — أيقونة ميزان + كوكب
function PrepIcon1() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
      {/* كوكب مع حلقة */}
      <circle cx="40" cy="38" r="16" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="2"/>
      <ellipse cx="40" cy="38" rx="28" ry="8" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 3"/>
      {/* نجوم صغيرة */}
      <circle cx="20" cy="18" r="1.5" fill="white" fillOpacity="0.8"/>
      <circle cx="62" cy="22" r="2" fill="white" fillOpacity="0.6"/>
      <circle cx="14" cy="52" r="1" fill="white" fillOpacity="0.7"/>
      <circle cx="68" cy="55" r="1.5" fill="white" fillOpacity="0.5"/>
      {/* علامة + داخل الكوكب */}
      <line x1="40" y1="31" x2="40" y2="45" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="33" y1="38" x2="47" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

// الإعدادي ٢ — معادلة رياضية + بوصلة
function PrepIcon2() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
      {/* بوصلة */}
      <circle cx="40" cy="40" r="22" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="2"/>
      <circle cx="40" cy="40" r="3" fill="white"/>
      {/* إبرة البوصلة */}
      <polygon points="40,18 37,40 40,44 43,40" fill="white" fillOpacity="0.9"/>
      <polygon points="40,62 37,40 40,36 43,40" fill="white" fillOpacity="0.4"/>
      {/* تقسيمات */}
      <line x1="40" y1="19" x2="40" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="40" y1="57" x2="40" y2="61" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="19" y1="40" x2="23" y2="40" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="57" y1="40" x2="61" y2="40" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// الإعدادي ٣ — أنبوب اختبار + ذرة
function PrepIcon3() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
      {/* أنبوب اختبار */}
      <path d="M28 16 L28 52 Q28 62 38 62 Q48 62 48 52 L48 16 Z"
        fill="white" fillOpacity="0.2" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="28" y1="16" x2="48" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      {/* سائل داخل الأنبوب */}
      <path d="M29 46 L29 52 Q29 61 38 61 Q47 61 47 52 L47 46 Z"
        fill="white" fillOpacity="0.5"/>
      {/* فقاعات */}
      <circle cx="36" cy="50" r="2" fill="white" fillOpacity="0.8"/>
      <circle cx="41" cy="53" r="1.5" fill="white" fillOpacity="0.6"/>
      {/* نجوم جانبية */}
      <circle cx="60" cy="24" r="2" fill="white" fillOpacity="0.7"/>
      <circle cx="64" cy="38" r="1.5" fill="white" fillOpacity="0.5"/>
      <circle cx="18" cy="32" r="1.5" fill="white" fillOpacity="0.6"/>
    </svg>
  )
}

// ثانوي ١ — مصباح + دوائر منطقية
function SecIcon1() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
      {/* مصباح */}
      <path d="M30 44 Q22 36 22 28 Q22 16 40 16 Q58 16 58 28 Q58 36 50 44 Z"
        fill="white" fillOpacity="0.25" stroke="white" strokeWidth="2"/>
      {/* قاعدة المصباح */}
      <rect x="32" y="44" width="16" height="5" rx="2" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="1.5"/>
      <rect x="33" y="49" width="14" height="4" rx="2" fill="white" fillOpacity="0.4" stroke="white" strokeWidth="1.5"/>
      {/* خيط التوهج */}
      <path d="M36 36 Q38 30 40 36 Q42 42 44 36" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* أشعة */}
      <line x1="40" y1="10" x2="40" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="55" y1="14" x2="52" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="25" y1="14" x2="28" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="62" y1="28" x2="58" y2="28" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="28" x2="22" y2="28" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      {/* نص صغير في الأسفل */}
      <text x="40" y="60" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="8" fontFamily="sans-serif" fontWeight="bold">١</text>
    </svg>
  )
}

// ثانوي ٢ — دالة رياضية + رسم بياني
function SecIcon2() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
      {/* محورين */}
      <line x1="16" y1="60" x2="66" y2="60" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="16" y1="60" x2="16" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      {/* سهم المحاور */}
      <polyline points="13,20 16,14 19,20" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <polyline points="62,57 68,60 62,63" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* منحنى دالة */}
      <path d="M16 58 Q24 58 28 46 Q34 28 40 32 Q46 36 52 24 Q58 14 66 18"
        stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* نقاط على المنحنى */}
      <circle cx="28" cy="46" r="2.5" fill="white"/>
      <circle cx="40" cy="32" r="2.5" fill="white"/>
      <circle cx="52" cy="24" r="2.5" fill="white"/>
      {/* علامة f(x) */}
      <text x="54" y="70" textAnchor="middle" fill="white" fillOpacity="0.8" fontSize="8" fontFamily="serif" fontStyle="italic">f(x)</text>
    </svg>
  )
}

// ثانوي ٣ — ذرة + معادلة
function SecIcon3() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
      {/* نواة */}
      <circle cx="40" cy="40" r="7" fill="white" fillOpacity="0.4" stroke="white" strokeWidth="2"/>
      <circle cx="38" cy="38" r="2" fill="white"/>
      <circle cx="43" cy="41" r="2" fill="white" fillOpacity="0.7"/>
      {/* مدارات */}
      <ellipse cx="40" cy="40" rx="28" ry="10" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.8"/>
      <ellipse cx="40" cy="40" rx="28" ry="10" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.8"
        transform="rotate(60 40 40)"/>
      <ellipse cx="40" cy="40" rx="28" ry="10" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.8"
        transform="rotate(120 40 40)"/>
      {/* إلكترونات */}
      <circle cx="68" cy="40" r="3" fill="white"/>
      <circle cx="26" cy="27" r="3" fill="white"/>
      <circle cx="26" cy="53" r="3" fill="white"/>
    </svg>
  )
}

const gradesMeta = [
  {
    id: "first_preparatory",
    title: "الصف الأول الإعدادي",
    description: "كورسات وشروحات متكاملة لمنهج أولى إعدادي",
    color: "from-blue-500 to-blue-600",
    Icon: PrepIcon1,
    image: "", // ضع هنا رابط أو مسار الصورة، مثال: "/grades/first_preparatory.jpg"
  },
  {
    id: "second_preparatory",
    title: "الصف الثاني الإعدادي",
    description: "كورسات وشروحات متكاملة لمنهج تانية إعدادي",
    color: "from-cyan-500 to-cyan-600",
    Icon: PrepIcon2,
    image: "",
  },
  {
    id: "third_preparatory",
    title: "الصف الثالث الإعدادي",
    description: "كورسات وشروحات متكاملة لمنهج تالتة إعدادي",
    color: "from-teal-500 to-teal-600",
    Icon: PrepIcon3,
    image: "",
  },
  {
    id: "first_secondary",
    title: "الصف الأول الثانوي",
    description: "كورسات وشروحات متكاملة لمنهج أولى ثانوي",
    color: "from-[#fe2c55] to-[#d41f43]",
    Icon: SecIcon1,
    image: "",
  },
  {
    id: "second_secondary",
    title: "الصف الثاني الثانوي",
    description: "كورسات وشروحات متكاملة لمنهج تانية ثانوي",
    color: "from-[#19c7ff] to-[#0da8dd]",
    Icon: SecIcon2,
    image: "",
  },
  {
    id: "third_secondary",
    title: "الصف الثالث الثانوي",
    description: "كورسات وشروحات متكاملة لمنهج تالتة ثانوي",
    color: "from-violet-500 to-violet-700",
    Icon: SecIcon3,
    image: "",
  },
]

export function GradesSection() {
  const [gradeImages, setGradeImages] = useState<Record<string, string>>({})

  useEffect(() => {
    gradeImagesAPI
      .getAll()
      .then(setGradeImages)
      .catch(() => {})
  }, [])

  const grades = gradesMeta.map((grade) => ({
    ...grade,
    image: gradeImages[grade.id] || grade.image,
  }))

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-balance">
            <span className="text-secondary">السنوات</span>{" "}
            <span className="text-primary">الدراسية</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            اختار سنتك الدراسية وابدأ رحلة التفوق معانا
          </p>
        </div>

        {/* الإعدادي */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex-1 h-px bg-border" />
            <span className="text-sm font-bold text-muted-foreground">المرحلة الإعدادية</span>
            <span className="flex-1 h-px bg-border" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {grades.slice(0, 3).map(grade => (
              <GradeCard key={grade.id} grade={grade} />
            ))}
          </div>
        </div>

        {/* الثانوي */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="flex-1 h-px bg-border" />
            <span className="text-sm font-bold text-muted-foreground">المرحلة الثانوية</span>
            <span className="flex-1 h-px bg-border" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {grades.slice(3).map(grade => (
              <GradeCard key={grade.id} grade={grade} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function GradeCard({ grade }: { grade: typeof gradesMeta[0] }) {
  const { Icon } = grade
  const resolvedImage = getImageUrl(grade.image)
  const hasImage = Boolean(resolvedImage)

  return (
    <div className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/30 transition-all hover:shadow-lg">
      {/* الجزء العلوي — صورة مخصصة أو خلفية لون + أيقونة */}
      {hasImage ? (
        <div className="h-40 relative overflow-hidden">
          <img
            src={resolvedImage!}
            alt={grade.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          {/* تعتيم خفيف لضمان وضوح أي عناصر فوق الصورة */}
          <div className="absolute inset-0 bg-black/20" />
        </div>
      ) : (
        <div className={`h-40 bg-linear-to-l ${grade.color} flex items-center justify-center relative overflow-hidden`}>
          {/* باترن نقاط خفي في الخلفية */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          {/* حلقة ضوئية خلف الأيقونة */}
          <div className="absolute w-32 h-32 rounded-full bg-white/10 blur-xl" />
          {/* الأيقونة */}
          <div className="relative z-10 drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
            <Icon />
          </div>
        </div>
      )}

      {/* محتوى الكارد */}
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2 text-card-foreground">{grade.title}</h3>
        <p className="text-muted-foreground mb-4">{grade.description}</p>
      </div>
    </div>
  )
}