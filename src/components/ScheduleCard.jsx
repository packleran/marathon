import { useState, useEffect } from 'react'
import { courseInfo, deadlines } from '../data'

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

export default function ScheduleCard() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(courseInfo.nextSession))

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(courseInfo.nextSession)), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 shadow-sm flex flex-col">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">לוח זמנים</h2>
      </div>

      {timeLeft && (
        <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-4 text-white mb-5">
          <p className="text-xs font-medium text-indigo-200 mb-3">המפגש הבא בעוד</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: timeLeft.days, l: 'ימים' },
              { v: timeLeft.hours, l: 'שעות' },
              { v: timeLeft.minutes, l: 'דקות' },
              { v: timeLeft.seconds, l: 'שניות' },
            ].map((item) => (
              <div key={item.l} className="rounded-lg bg-white/10 py-2">
                <div className="text-xl font-bold font-mono tabular-nums leading-none">
                  {String(item.v).padStart(2, '0')}
                </div>
                <div className="text-[10px] text-indigo-200 mt-1">{item.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1">
        <p className="text-xs font-medium text-slate-500 mb-3">תאריכים חשובים</p>
        <div className="space-y-2.5">
          {deadlines.map((d) => {
            const days = daysUntil(d.date)
            return (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-100/80">
                <div>
                  <p className="text-sm font-medium text-slate-700">{d.label}</p>
                  <p className="text-xs text-slate-400">{d.display}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  days <= 14
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {days === 0 ? 'היום!' : `עוד ${days} ימים`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
