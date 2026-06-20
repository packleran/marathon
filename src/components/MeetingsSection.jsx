import { useState } from 'react'
import MeetingDetail from './MeetingDetail'
import { getCourseTheme, statusChipStyle } from '../theme'

function statusLabel(date) {
  const d = new Date(date)
  if (!date || Number.isNaN(d.getTime())) {
    return { tone: 'draft', text: 'טיוטה' }
  }

  const now = new Date()
  if (d < now) return { tone: 'ended', text: 'הסתיים' }
  const diff = d - now
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 3) return { tone: 'soon', text: days <= 0 ? 'היום' : `בעוד ${days} ימים` }
  return { tone: 'upcoming', text: 'עתידי' }
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 5.79L17.22 19.67A2.25 2.25 0 0114.977 21H9.023a2.25 2.25 0 01-2.243-2.33L5.84 5.79m12.32 0a48.108 48.108 0 00-3.478-.397m-12.56.563c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.16 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

function DuplicateIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.25h10.5v10.5H8.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 15.75V5.25h10.5" />
    </svg>
  )
}

export default function MeetingsSection({
  canEditContent = false,
  course,
  focusMeetingId,
  isAdminMode = false,
  onDeleteMeeting,
  onDuplicateMeeting,
  onUpdateMeeting,
  refreshToken,
}) {
  const [expandedId, setExpandedId] = useState(focusMeetingId ?? null)
  const accent = getCourseTheme(course.color)

  function handleDeleteMeeting(meeting) {
    if (!canEditContent || !window.confirm(`למחוק את המפגש "${meeting.title}"?`)) return

    setExpandedId((current) => (current === meeting.id ? null : current))
    onDeleteMeeting(course.id, meeting.id)
  }

  function handleDuplicateMeeting(meeting) {
    if (!canEditContent) return

    onDuplicateMeeting(course.id, meeting)
  }

  if (course.meetings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-text-muted">
        אין מפגשים בטאב הזה
      </div>
    )
  }

  return (
    <div className="space-y-3.5">
      {course.meetings.map((m, i) => {
        const isExpanded = expandedId === m.id
        const status = statusLabel(m.date)
        const chip = statusChipStyle(status.tone, status.text, accent)

        return (
          <div
            key={m.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className="rounded-2xl border bg-surface transition-all duration-300"
              style={{
                borderColor: isExpanded ? accent.tintBorder : 'var(--color-border)',
                boxShadow: isExpanded ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
              }}
            >
              <div className="flex items-start justify-between gap-4 p-5 md:p-[22px]">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="flex min-w-0 flex-1 items-start gap-4 text-right cursor-pointer"
                >
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl font-mono text-base font-semibold tabular-nums tracking-tight"
                      style={{ background: accent.tint, color: accent.accent }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold tracking-tight text-text md:text-[17px]">{m.title}</h3>
                      <p className="mt-1 line-clamp-1 text-sm text-text-2">{m.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
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
                </button>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex"
                    style={{ background: chip.bg, color: chip.fg, borderColor: chip.border }}
                  >
                    <span className="h-[5px] w-[5px] rounded-full" style={{ background: chip.dot }} />
                    {chip.text}
                  </span>
                  {canEditContent && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDuplicateMeeting(m)}
                        aria-label={`שכפל את ${m.title}`}
                        title="שכפל מפגש"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-faint transition-colors hover:bg-primary-soft hover:text-primary cursor-pointer"
                      >
                        <DuplicateIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMeeting(m)}
                        aria-label={`מחק את ${m.title}`}
                        title="מחק מפגש"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-faint transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                      >
                        <TrashIcon />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    aria-label={isExpanded ? 'סגור מפגש' : 'פתח מפגש'}
                    className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-inset text-text-muted transition-colors hover:text-text cursor-pointer"
                  >
                    <svg
                      className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {isExpanded && (
                <MeetingDetail
                  canEditContent={canEditContent}
                  courseColor={course.color}
                  courseId={course.id}
                  isAdminMode={isAdminMode}
                  meeting={m}
                  onUpdateMeeting={canEditContent ? (updates) => onUpdateMeeting(course.id, m.id, updates) : undefined}
                  refreshToken={refreshToken}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
