import { useState, useEffect } from 'react'
import { courseInfo, deadlines, resources } from '../data'

function getTimeLeft(target) {
  const diff = new Date(target) - new Date()
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

const iconMap = {
  folder: { bg: 'bg-amber-100', text: 'text-amber-600', path: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z' },
  pdf: { bg: 'bg-rose-100', text: 'text-rose-500', path: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  link: { bg: 'bg-sky-100', text: 'text-sky-600', path: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244' },
}

export default function Sidebar() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(courseInfo.nextSession))

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(courseInfo.nextSession)), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
      {timeLeft && (
        <div className="rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-blue-200/30 animate-fade-in-up">
          <p className="text-xs font-medium text-sky-200 mb-3">המפגש הבא מתחיל בעוד</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: timeLeft.days, l: 'ימים' },
              { v: timeLeft.hours, l: 'שעות' },
              { v: timeLeft.minutes, l: 'דקות' },
              { v: timeLeft.seconds, l: 'שניות' },
            ].map((item) => (
              <div key={item.l} className="rounded-xl bg-white/15 backdrop-blur-sm py-2.5">
                <div className="text-xl font-bold font-mono tabular-nums leading-none">
                  {String(item.v).padStart(2, '0')}
                </div>
                <div className="text-[10px] text-sky-200 mt-1.5">{item.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">תאריכים חשובים</h3>
        <div className="space-y-2.5">
          {deadlines.map((d) => {
            const days = daysUntil(d.date)
            const isUrgent = days <= 14
            return (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">{d.label}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{d.display}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  isUrgent
                    ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {days === 0 ? 'היום!' : `${days} ימים`}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">קישורים מהירים</h3>
        <div className="space-y-2">
          {resources.map((r) => {
            const ic = iconMap[r.icon]
            return (
              <a
                key={r.id}
                href={r.url}
                className="group flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 transition-colors"
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${ic.bg} ${ic.text}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={ic.path} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-600 group-hover:text-sky-600 transition-colors truncate">{r.title}</p>
                  <p className="text-[11px] text-slate-400 truncate">{r.description}</p>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
