import { useEffect, useState } from 'react'
import { getCourseTheme } from '../theme'

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

function splitDisplay(display = '') {
  const [day, ...rest] = display.trim().split(' ')
  return { day: day || '', month: rest.join(' ') }
}

const iconMap = {
  folder: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
  pdf: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  link: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
}

export default function Sidebar({ course }) {
  const [now, setNow] = useState(() => new Date())
  const accent = getCourseTheme(course.color)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeLeft = getTimeLeft(course.nextSession, now)

  return (
    <div className="w-full flex-shrink-0 space-y-4 lg:w-[300px]">
      {timeLeft && (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm animate-fade-in-up">
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent.accent }} />
          <div className="mb-4 flex items-center gap-2">
            <span className="h-[7px] w-[7px] animate-live-pulse rounded-full" style={{ background: accent.accent }} />
            <span className="text-[13px] font-semibold text-text-2">המפגש הבא מתחיל בעוד</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: timeLeft.days, l: 'ימים' },
              { v: timeLeft.hours, l: 'שעות' },
              { v: timeLeft.minutes, l: 'דקות' },
              { v: timeLeft.seconds, l: 'שניות' },
            ].map((item) => (
              <div key={item.l} className="rounded-[11px] border border-border-subtle bg-elevated py-2.5">
                <div
                  className="font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums"
                  style={{ color: accent.accent }}
                >
                  {String(item.v).padStart(2, '0')}
                </div>
                <div className="mt-1.5 text-[10.5px] font-medium text-text-faint">{item.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {course.deadlines.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <h3 className="mb-2 text-sm font-semibold text-text">תאריכים חשובים</h3>
          <div className="flex flex-col">
            {course.deadlines.map((d, i) => {
              const days = daysUntil(d.date)
              const { day, month } = splitDisplay(d.display)
              const dot = days <= 7 ? '#D14343' : days <= 21 ? accent.accent : '#C4C9D4'
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3.5 py-2.5"
                  style={{ borderBottom: i === course.deadlines.length - 1 ? 'none' : '1px solid #F0F2F6' }}
                >
                  <div className="w-11 flex-none text-center">
                    <div className="font-mono text-[17px] font-semibold leading-none text-text">{day}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-text-faint">{month}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-text">{d.label}</p>
                    <p className="text-[11.5px] text-text-faint">{days === 0 ? 'היום' : `בעוד ${days} ימים`}</p>
                  </div>
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: dot }} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <h3 className="mb-2.5 text-sm font-semibold text-text">קישורים מהירים</h3>
        <div className="flex flex-col gap-0.5">
          {course.resources.map((r) => (
            <a
              key={r.id}
              href={r.url}
              className="group flex items-center gap-3 rounded-[10px] p-2.5 transition-colors hover:bg-inset"
            >
              <span
                className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg"
                style={{ background: accent.tint, color: accent.accent }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                  <path strokeLinecap="round" strokeLinejoin="round" d={iconMap[r.icon] ?? iconMap.link} />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-text">{r.title}</span>
                <span className="block truncate text-[11px] text-text-faint">{r.description}</span>
              </span>
              <svg className="h-[15px] w-[15px] flex-none text-text-faint transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
