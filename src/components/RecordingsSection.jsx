import { getCourseTheme } from '../theme'

export default function RecordingsSection({ course }) {
  const { recordings } = course
  const accent = getCourseTheme(course.color)

  if (recordings.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-inset">
          <svg className="h-6 w-6 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <p className="text-sm text-text-muted">עוד אין הקלטות לקורס הזה</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {recordings.map((r, i) => (
        <div
          key={r.id}
          className="group animate-fade-in-up cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div
            className="relative flex aspect-video items-center justify-center"
            style={{ background: 'repeating-linear-gradient(135deg, #EEF0F6 0 12px, #F4F5F9 12px 24px)' }}
          >
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/90 shadow-md transition-transform duration-200 group-hover:scale-110">
              <svg className="mr-[-2px] h-5 w-5" fill={accent.accent} viewBox="0 0 24 24">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </div>
            <span className="absolute bottom-2.5 left-2.5 rounded-md bg-[#15172A]/[0.78] px-2 py-0.5 font-mono text-[11.5px] font-semibold tracking-wide text-white">
              {r.duration}
            </span>
          </div>
          <div className="px-4 pb-4 pt-3.5">
            <p className="mb-1.5 text-[14.5px] font-semibold text-text">{r.title}</p>
            <p className="flex items-center gap-1.5 font-mono text-xs text-text-muted">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="17" rx="2.5" />
                <path d="M3 9h18M8 2v4M16 2v4" />
              </svg>
              {r.date}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
