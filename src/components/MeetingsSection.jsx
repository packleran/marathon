import { useState } from 'react'
import { meetings } from '../data'
import MeetingDetail from './MeetingDetail'

function statusLabel(date) {
  const d = new Date(date)
  const now = new Date()
  if (d < now) return { text: 'הסתיים', color: 'bg-slate-100 text-slate-500' }
  const diff = d - now
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 3) return { text: `בעוד ${days} ימים`, color: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60' }
  return { text: 'קרוב', color: 'bg-sky-50 text-sky-600 ring-1 ring-sky-200/60' }
}

export default function MeetingsSection() {
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="space-y-4">
      {meetings.map((m, i) => {
        const isExpanded = expandedId === m.id
        const status = statusLabel(m.date)

        return (
          <div
            key={m.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className={`rounded-2xl bg-white border transition-all duration-300 ${
                isExpanded
                  ? 'border-sky-200 shadow-[0_4px_24px_rgba(14,165,233,0.08)] ring-1 ring-sky-100'
                  : 'border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-slate-200'
              }`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
                className="w-full text-right p-5 md:p-6 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl font-bold text-sm ${
                      isExpanded
                        ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-200'
                        : 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 ring-1 ring-slate-200/60'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-800 md:text-lg">{m.title}</h3>
                      <p className="mt-1 text-sm text-slate-500 line-clamp-1">{m.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                          </svg>
                          {m.day}, {m.dateDisplay}
                        </span>
                        <span className="flex items-center gap-1.5 font-mono">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {m.time}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {m.type === 'zoom' ? (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                          )}
                          {m.location}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`hidden sm:inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${status.color}`}>
                      {status.text}
                    </span>
                    <svg
                      className={`h-5 w-5 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {isExpanded && <MeetingDetail meeting={m} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
