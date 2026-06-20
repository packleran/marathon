import { courseGradientBar, getCourseTheme } from '../theme'

function CalendarGlyph({ stroke = 'currentColor', className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  )
}

function StackGlyph({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#8c93a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  )
}

function formatNextSession(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function Header({ course }) {
  const accent = getCourseTheme(course.color)
  const nextSession = formatNextSession(course.nextSession)

  return (
    <header className="mx-auto max-w-7xl px-5 pt-6 md:px-8">
      <div
        className="relative overflow-hidden rounded-[20px] border border-border shadow-md"
        style={{ background: 'linear-gradient(180deg, #EEF1FD 0%, #F6F8FE 55%, #FFFFFF 100%)' }}
      >
        {/* soft mesh */}
        <div
          className="pointer-events-none absolute inset-0 animate-mesh-float opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(closest-side at 78% 18%, rgba(76,87,212,.16), transparent 70%), radial-gradient(closest-side at 12% 88%, rgba(122,86,201,.13), transparent 70%), radial-gradient(closest-side at 50% 50%, rgba(31,156,139,.08), transparent 72%)',
          }}
        />
        {/* course gradient hairline */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: courseGradientBar }} />

        <div className="relative px-6 py-8 md:px-11 md:py-10">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E1E4EE] bg-white/70 px-3 py-1.5 backdrop-blur-sm">
              <span
                className="h-[7px] w-[7px] animate-live-pulse rounded-full bg-success"
                style={{ boxShadow: '0 0 0 3px rgba(30,158,106,.16)' }}
              />
              <span className="text-xs font-semibold text-[#3B7A5C]">משדר חי</span>
            </span>
            <span className="text-[13px] font-semibold tracking-wide text-text-2">מרתון עם רן פקלר</span>
          </div>

          <h1 className="max-w-[20ch] text-3xl font-bold leading-[1.12] tracking-tight text-[#15172A] md:text-[2.75rem]">
            {course.name}
          </h1>
          <p className="mt-3.5 text-[15px] font-medium text-text-2 md:text-[17px]">
            {course.subtitle}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            {nextSession && (
              <div className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2 shadow-sm">
                <CalendarGlyph stroke={accent.accent} className="h-4 w-4" />
                <span className="text-[13.5px] font-medium text-text-2">המפגש הבא</span>
                <span className="font-mono text-[13.5px] font-semibold tracking-tight text-text">{nextSession}</span>
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 shadow-sm">
              <StackGlyph className="h-4 w-4" />
              <span className="text-[13.5px] font-semibold text-text">
                <span className="font-mono">{course.meetings.length}</span> מפגשים
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
