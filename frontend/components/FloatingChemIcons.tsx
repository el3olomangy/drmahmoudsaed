"use client"

import { useEffect, useState } from "react"

const RED = "#fe2c55"
const BLUE = "#19c7ff"

function FlaskIcon() {
  return (
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M22 8 L22 32 L10 52 L50 52 L38 32 L38 8 Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <line x1="22" y1="8" x2="38" y2="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M18 38 L42 38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5"/>
      <circle cx="20" cy="44" r="2.5" fill="currentColor" fillOpacity="0.8"/>
      <circle cx="30" cy="46" r="2" fill="currentColor" fillOpacity="0.6"/>
      <circle cx="38" cy="43" r="1.5" fill="currentColor" fillOpacity="0.7"/>
      <line x1="26" y1="4" x2="26" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="32" y1="4" x2="32" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function AtomIcon() {
  return (
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <circle cx="30" cy="30" r="5" fill="currentColor"/>
      <ellipse cx="30" cy="30" rx="24" ry="9" stroke="currentColor" strokeWidth="2" fill="none" strokeOpacity="0.8"/>
      <ellipse cx="30" cy="30" rx="24" ry="9" stroke="currentColor" strokeWidth="2" fill="none" strokeOpacity="0.8" transform="rotate(60 30 30)"/>
      <ellipse cx="30" cy="30" rx="24" ry="9" stroke="currentColor" strokeWidth="2" fill="none" strokeOpacity="0.8" transform="rotate(120 30 30)"/>
      <circle cx="54" cy="30" r="3" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="18" cy="9" r="3" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="18" cy="51" r="3" fill="currentColor" fillOpacity="0.9"/>
    </svg>
  )
}

function MoleculeIcon() {
  return (
    <svg viewBox="0 0 70 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <circle cx="15" cy="30" r="9" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="55" cy="30" r="9" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="35" cy="12" r="9" fill="currentColor" fillOpacity="0.7"/>
      <circle cx="35" cy="48" r="7" fill="currentColor" fillOpacity="0.6"/>
      <line x1="24" y1="30" x2="46" y2="30" stroke="currentColor" strokeWidth="3" strokeOpacity="0.7"/>
      <line x1="20" y1="23" x2="29" y2="17" stroke="currentColor" strokeWidth="3" strokeOpacity="0.7"/>
      <line x1="50" y1="23" x2="41" y2="17" stroke="currentColor" strokeWidth="3" strokeOpacity="0.7"/>
      <line x1="20" y1="37" x2="29" y2="43" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.6"/>
      <line x1="50" y1="37" x2="41" y2="43" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.6"/>
    </svg>
  )
}

function BeakerIcon() {
  return (
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect x="18" y="6" width="24" height="34" rx="2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="18" y1="6" x2="42" y2="6" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <path d="M18 40 Q18 54 30 54 Q42 54 42 40" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="24" cy="46" r="2" fill="currentColor" fillOpacity="0.8"/>
      <circle cx="33" cy="48" r="1.5" fill="currentColor" fillOpacity="0.7"/>
      <circle cx="38" cy="44" r="2.5" fill="currentColor" fillOpacity="0.6"/>
    </svg>
  )
}

function DNAIcon() {
  return (
    <svg viewBox="0 0 40 70" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M8 5 Q32 17 8 29 Q32 41 8 53 Q32 65 8 65" stroke="currentColor" strokeWidth="2.5" fill="none" strokeOpacity="0.9" strokeLinecap="round"/>
      <path d="M32 5 Q8 17 32 29 Q8 41 32 53 Q8 65 32 65" stroke="currentColor" strokeWidth="2.5" fill="none" strokeOpacity="0.9" strokeLinecap="round"/>
      <line x1="11" y1="12" x2="29" y2="12" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
      <line x1="11" y1="22" x2="29" y2="22" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
      <line x1="11" y1="35" x2="29" y2="35" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
      <line x1="11" y1="47" x2="29" y2="47" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
      <line x1="11" y1="57" x2="29" y2="57" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
    </svg>
  )
}

function MicroscopeIcon() {
  return (
    <svg viewBox="0 0 60 70" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <circle cx="30" cy="14" r="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="30" cy="14" r="5" fill="currentColor" fillOpacity="0.5"/>
      <line x1="30" y1="24" x2="30" y2="40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="22" y1="40" x2="38" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="22" y1="40" x2="16" y2="58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="38" y1="40" x2="44" y2="58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12" y1="58" x2="48" y2="58" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

function TestTubeIcon() {
  return (
    <svg viewBox="0 0 30 70" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect x="8" y="4" width="14" height="46" rx="2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 50 Q8 66 15 66 Q22 66 22 50" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2"/>
      <line x1="8" y1="4" x2="22" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="13" cy="56" r="2" fill="currentColor" fillOpacity="0.8"/>
      <circle cx="18" cy="59" r="1.5" fill="currentColor" fillOpacity="0.6"/>
    </svg>
  )
}

function PeriodicFeIcon() {
  return (
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect x="4" y="4" width="52" height="52" rx="6" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2"/>
      <text x="30" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontWeight="bold" fill="currentColor" fillOpacity="0.9">Fe</text>
      <text x="30" y="44" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="currentColor" fillOpacity="0.6">26</text>
    </svg>
  )
}

function PeriodicAuIcon() {
  return (
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect x="4" y="4" width="52" height="52" rx="6" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2"/>
      <text x="30" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontWeight="bold" fill="currentColor" fillOpacity="0.9">Au</text>
      <text x="30" y="44" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="currentColor" fillOpacity="0.6">79</text>
    </svg>
  )
}

function PeriodicCaIcon() {
  return (
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect x="4" y="4" width="52" height="52" rx="6" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2"/>
      <text x="30" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontWeight="bold" fill="currentColor" fillOpacity="0.9">Ca</text>
      <text x="30" y="44" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="currentColor" fillOpacity="0.6">20</text>
    </svg>
  )
}

function ElectronIcon() {
  return (
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <circle cx="30" cy="30" r="26" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" fill="none" strokeDasharray="4 4"/>
      <circle cx="30" cy="30" r="17" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" fill="none" strokeDasharray="3 3"/>
      <circle cx="30" cy="30" r="5" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="56" cy="30" r="3" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="4" cy="30" r="3" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="30" cy="4" r="3" fill="currentColor" fillOpacity="0.7"/>
      <circle cx="30" cy="56" r="3" fill="currentColor" fillOpacity="0.7"/>
    </svg>
  )
}

function BunsenBurnerIcon() {
  return (
    <svg viewBox="0 0 50 70" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M25 32 Q18 20 22 8 Q25 2 25 2 Q25 2 28 8 Q32 20 25 32Z" fill={RED} fillOpacity="0.8"/>
      <path d="M25 32 Q21 24 23 14 Q25 8 25 8 Q25 8 27 14 Q29 24 25 32Z" fill="#ff9800" fillOpacity="0.9"/>
      <rect x="18" y="32" width="14" height="22" rx="2" fill="currentColor" fillOpacity="0.8" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="12" y="54" width="26" height="8" rx="3" fill="currentColor" fillOpacity="0.9"/>
    </svg>
  )
}

function MagnetIcon() {
  return (
    <svg viewBox="0 0 60 50" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M8 8 L8 30 Q8 44 22 44 Q36 44 36 30 L36 8" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <rect x="4" y="4" width="12" height="10" rx="2" fill={RED} fillOpacity="0.95"/>
      <rect x="32" y="4" width="12" height="10" rx="2" fill={BLUE} fillOpacity="0.95"/>
      <text x="8" y="12" fontFamily="sans-serif" fontSize="7" fontWeight="bold" fill="white">N</text>
      <text x="36" y="12" fontFamily="sans-serif" fontSize="7" fontWeight="bold" fill="white">S</text>
    </svg>
  )
}

function ChemBondIcon() {
  return (
    <svg viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <circle cx="12" cy="20" r="10" fill="currentColor" fillOpacity="0.85"/>
      <circle cx="68" cy="20" r="10" fill="currentColor" fillOpacity="0.85"/>
      <line x1="22" y1="17" x2="58" y2="17" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.7"/>
      <line x1="22" y1="23" x2="58" y2="23" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.7"/>
      <text x="7" y="24" fontFamily="Georgia, serif" fontSize="11" fontWeight="bold" fill="white">C</text>
      <text x="62" y="24" fontFamily="Georgia, serif" fontSize="11" fontWeight="bold" fill="white">O</text>
    </svg>
  )
}

function H2OIcon() {
  return (
    <svg viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <text x="4" y="32" fontFamily="Georgia, serif" fontSize="28" fontWeight="bold" fill="currentColor" fillOpacity="0.9">H₂O</text>
    </svg>
  )
}

function CO2Icon() {
  return (
    <svg viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <text x="2" y="30" fontFamily="Georgia, serif" fontSize="26" fontWeight="bold" fill="currentColor" fillOpacity="0.9">CO₂</text>
    </svg>
  )
}

function NaClIcon() {
  return (
    <svg viewBox="0 0 90 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <text x="2" y="30" fontFamily="Georgia, serif" fontSize="24" fontWeight="bold" fill="currentColor" fillOpacity="0.9">NaCl</text>
    </svg>
  )
}

function O2Icon() {
  return (
    <svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <text x="2" y="30" fontFamily="Georgia, serif" fontSize="28" fontWeight="bold" fill="currentColor" fillOpacity="0.9">O₂</text>
    </svg>
  )
}

function RulerIcon() {
  return (
    <svg viewBox="0 0 80 30" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect x="2" y="6" width="76" height="18" rx="3" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2"/>
      {[10,20,30,40,50,60,70].map((x,i) => (
        <line key={i} x1={x} y1="6" x2={x} y2={i%2===0?"20":"15"} stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.7"/>
      ))}
    </svg>
  )
}

// 20 أيقونة بألوان ثابتة عبر style
const ICONS = [
  { C: FlaskIcon,       color: RED,  op: 0.85, w: 52, h: 52, x: 1,  y: 10, d: 6,  dl: 0,   r: -15 },
  { C: AtomIcon,        color: BLUE, op: 0.80, w: 56, h: 56, x: 3,  y: 38, d: 8,  dl: 1.5, r: 8   },
  { C: DNAIcon,         color: RED,  op: 0.70, w: 36, h: 60, x: 7,  y: 65, d: 10, dl: 3,   r: 5   },
  { C: H2OIcon,         color: BLUE, op: 0.80, w: 80, h: 36, x: 0,  y: 52, d: 14, dl: 0.5, r: -6  },
  { C: BunsenBurnerIcon,color: RED,  op: 0.75, w: 44, h: 60, x: 8,  y: 80, d: 9,  dl: 2,   r: -10 },
  { C: PeriodicFeIcon,  color: BLUE, op: 0.70, w: 50, h: 50, x: 4,  y: 22, d: 11, dl: 4,   r: 12  },
  { C: BeakerIcon,      color: BLUE, op: 0.85, w: 48, h: 48, x: 91, y: 8,  d: 7,  dl: 0,   r: 10  },
  { C: MicroscopeIcon,  color: RED,  op: 0.80, w: 44, h: 56, x: 88, y: 35, d: 9,  dl: 2.5, r: -8  },
  { C: MoleculeIcon,    color: BLUE, op: 0.65, w: 64, h: 56, x: 85, y: 62, d: 8,  dl: 1,   r: 6   },
  { C: CO2Icon,         color: RED,  op: 0.75, w: 76, h: 36, x: 89, y: 48, d: 13, dl: 3.5, r: 8   },
  { C: TestTubeIcon,    color: RED,  op: 0.80, w: 28, h: 64, x: 94, y: 78, d: 7,  dl: 1,   r: 15  },
  { C: PeriodicAuIcon,  color: BLUE, op: 0.65, w: 50, h: 50, x: 88, y: 20, d: 12, dl: 4,   r: -12 },
  { C: ElectronIcon,    color: RED,  op: 0.55, w: 48, h: 48, x: 30, y: 2,  d: 11, dl: 2,   r: 0   },
  { C: O2Icon,          color: BLUE, op: 0.60, w: 56, h: 36, x: 55, y: 4,  d: 9,  dl: 1,   r: -8  },
  { C: ChemBondIcon,    color: RED,  op: 0.55, w: 72, h: 36, x: 28, y: 88, d: 12, dl: 0.5, r: 5   },
  { C: NaClIcon,        color: BLUE, op: 0.60, w: 80, h: 36, x: 55, y: 85, d: 10, dl: 3,   r: -5  },
  { C: MagnetIcon,      color: BLUE, op: 0.65, w: 52, h: 40, x: 42, y: 1,  d: 13, dl: 5,   r: 10  },
  { C: RulerIcon,       color: RED,  op: 0.50, w: 72, h: 28, x: 38, y: 91, d: 15, dl: 2.5, r: -3  },
  { C: PeriodicCaIcon,  color: RED,  op: 0.55, w: 46, h: 46, x: 20, y: 5,  d: 8,  dl: 6,   r: 18  },
  { C: FlaskIcon,       color: BLUE, op: 0.45, w: 40, h: 40, x: 72, y: 90, d: 10, dl: 4,   r: -15 },
]

export function FloatingChemIcons() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <style>{`
        @keyframes cf { 0%,100%{transform:translateY(0) rotate(var(--r));} 50%{transform:translateY(-18px) rotate(calc(var(--r) + 4deg));} }
        @keyframes cs { 0%,100%{transform:translateY(0) translateX(0) rotate(var(--r));} 33%{transform:translateY(-10px) translateX(6px) rotate(calc(var(--r) - 3deg));} 66%{transform:translateY(6px) translateX(-4px) rotate(calc(var(--r) + 3deg));} }
        .ani-f { animation: cf var(--d) ease-in-out infinite; animation-delay: var(--dl); }
        .ani-s { animation: cs var(--d) ease-in-out infinite; animation-delay: var(--dl); }
      `}</style>
      {ICONS.map(({ C, color, op, w, h, x, y, d, dl, r }, i) => (
        <div
          key={i}
          className={i % 2 === 0 ? "ani-f" : "ani-s"}
          style={{
            position: "absolute",
            left: `${x}%`, top: `${y}%`,
            width: w, height: h,
            color, opacity: op,
            "--r": `${r}deg`, "--d": `${d}s`, "--dl": `${dl}s`,
            transform: `rotate(${r}deg)`,
            willChange: "transform",
          } as React.CSSProperties}
        >
          <C />
        </div>
      ))}
    </div>
  )
}