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
    <div className="glass-card glow-border rounded-2xl p-6 flex flex-col animate-fade-in" style={{ animationDelay: '240ms' }}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-zinc-100">לוח זמנים</h2>
      </div>

      {timeLeft && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/10 p-4 mb-5 ring-1 ring-indigo-500/20">
          <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
          <p className="text-[11px] font-medium text-indigo-300/80 mb-3">המפגש הבא בעוד</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: timeLeft.days, l: 'ימים' },
              { v: timeLeft.hours, l: 'שעות' },
              { v: timeLeft.minutes, l: 'דקות' },
              { v: timeLeft.seconds, l: 'שניות' },
            ].map((item) => (
              <div key={item.l} className="rounded-lg bg-white/[0.06] py-2.5 ring-1 ring-white/[0.06]">
                <div className="text-xl font-bold font-mono tabular-nums leading-none text-white">
                  {String(item.v).padStart(2, '0')}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1.5">{item.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1">
        <p className="text-[11px] font-medium text-zinc-600 mb-3 uppercase tracking-wider">תאריכים חשובים</p>
        <div className="space-y-2">
          {deadlines.map((d) => {
            const days = daysUntil(d.date)
            const isUrgent = days <= 14
            return (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3 border border-white/[0.04]">
                <div>
                  <p className="text-sm font-medium text-zinc-300">{d.label}</p>
                  <p className="text-[11px] text-zinc-600 font-mono">{d.display}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${
                  isUrgent
                    ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
                    : 'bg-white/[0.04] text-zinc-500 ring-white/[0.06]'
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
