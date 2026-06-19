import { useEffect, useState } from 'react'

function getTimeLeft(target, now = new Date()) {
  const diff = new Date(target) - now
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

const countdownAccent = {
  sky: { glow: 'rgba(56,189,248,0.18)', digit: 'text-sky-300', label: 'text-slate-400' },
  violet: { glow: 'rgba(167,139,250,0.18)', digit: 'text-violet-300', label: 'text-slate-400' },
  emerald: { glow: 'rgba(45,212,191,0.18)', digit: 'text-teal-300', label: 'text-slate-400' },
}

const iconMap = {
  folder: { bg: 'bg-amber-100', text: 'text-amber-600', path: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z' },
  pdf: { bg: 'bg-rose-100', text: 'text-rose-500', path: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  link: { bg: 'bg-sky-100', text: 'text-sky-600', path: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244' },
}

export default function Sidebar({ course }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeLeft = getTimeLeft(course.nextSession, now)
  const accent = countdownAccent[course.color] ?? countdownAccent.sky

  return (
    <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
      {timeLeft && (
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-5 shadow-pop animate-fade-in-up">
          <div className="pointer-events-none absolute inset-0 tech-grid opacity-70" />
          <div
            className="pointer-events-none absolute -top-16 left-[-20%] h-40 w-48 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent.glow}, transparent 70%)` }}
          />
          <div className="relative">
            <p className={`mb-3 flex items-center gap-1.5 text-xs font-medium ${accent.label}`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              המפגש הבא מתחיל בעוד
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { v: timeLeft.days, l: 'ימים' },
                { v: timeLeft.hours, l: 'שעות' },
                { v: timeLeft.minutes, l: 'דקות' },
                { v: timeLeft.seconds, l: 'שניות' },
              ].map((item) => (
                <div key={item.l} className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5">
                  <div className={`text-2xl font-bold font-mono tabular-nums leading-none ${accent.digit}`}>
                    {String(item.v).padStart(2, '0')}
                  </div>
                  <div className={`mt-1.5 text-[10px] ${accent.label}`}>{item.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {course.deadlines.length > 0 && (
        <div className="rounded-2xl bg-white p-5 border border-slate-200/70 shadow-card animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            תאריכים חשובים
          </h3>
          <div className="space-y-2">
            {course.deadlines.map((d) => {
              const days = daysUntil(d.date)
              const isUrgent = days <= 14
              return (
                <div key={d.id} className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-200/60">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.label}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{d.display}</p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-mono font-medium tabular-nums ${
                    isUrgent
                      ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200/70'
                  }`}>
                    {days === 0 ? 'היום!' : `${days} ימים`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 border border-slate-200/70 shadow-card animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">קישורים מהירים</h3>
        <div className="space-y-2">
          {course.resources.map((r) => {
            const ic = iconMap[r.icon]
            return (
              <a
                key={r.id}
                href={r.url}
                className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-all hover:border-slate-200/70 hover:bg-slate-50"
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${ic.bg} ${ic.text}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={ic.path} />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 transition-colors group-hover:text-slate-900">{r.title}</p>
                  <p className="truncate text-[11px] text-slate-400">{r.description}</p>
                </div>
                <svg className="h-4 w-4 flex-shrink-0 text-slate-300 transition-all group-hover:text-slate-500 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
