const accents = {
  sky: {
    glow: 'rgba(56,189,248,0.22)',
    mark: 'text-sky-300',
    markRing: 'ring-sky-400/25',
    line: 'from-sky-400/0 via-sky-400/60 to-sky-400/0',
    chipText: 'text-sky-200',
    subtitle: 'text-slate-300/80',
  },
  violet: {
    glow: 'rgba(167,139,250,0.22)',
    mark: 'text-violet-300',
    markRing: 'ring-violet-400/25',
    line: 'from-violet-400/0 via-violet-400/60 to-violet-400/0',
    chipText: 'text-violet-200',
    subtitle: 'text-slate-300/80',
  },
  emerald: {
    glow: 'rgba(45,212,191,0.22)',
    mark: 'text-teal-300',
    markRing: 'ring-teal-400/25',
    line: 'from-teal-400/0 via-teal-400/60 to-teal-400/0',
    chipText: 'text-teal-200',
    subtitle: 'text-slate-300/80',
  },
}

function CalendarGlyph() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  )
}

function StackGlyph() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75 12 3l8.25 3.75L12 10.5 3.75 6.75ZM3.75 12 12 15.75 20.25 12M3.75 17.25 12 21l8.25-3.75" />
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
  const color = accents[course.color] ? course.color : 'sky'
  const accent = accents[color]
  const nextSession = formatNextSession(course.nextSession)

  return (
    <header className="relative overflow-hidden bg-slate-950">
      {/* technical line grid */}
      <div className="pointer-events-none absolute inset-0 tech-grid" />
      {/* accent glow */}
      <div
        className="pointer-events-none absolute -top-24 right-[-10%] h-80 w-[36rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent.glow}, transparent 70%)` }}
      />
      {/* fade to body */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-white/10 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-5 py-9 md:px-8 md:py-12">
        {/* brand + live status row */}
        <div className="mb-9 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ${accent.markRing} backdrop-blur-sm`}>
              <span className={`font-mono text-lg font-bold ${accent.mark}`}>{course.icon}</span>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">מרתון עם רן פקלר</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">Exam Prep</p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className={`text-xs font-medium ${accent.chipText}`}>פעיל</span>
          </div>
        </div>

        {/* course title */}
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
          {course.name}
        </h1>
        <p className={`mt-3 max-w-xl text-[15px] leading-relaxed ${accent.subtitle}`}>
          {course.subtitle}
        </p>

        {/* meta strip */}
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <StackGlyph />
            <span className="font-mono tabular-nums text-slate-300">{course.meetings.length}</span>
            מפגשים
          </span>
          {nextSession && (
            <>
              <span className="hidden h-3 w-px bg-white/10 sm:block" />
              <span className="flex items-center gap-1.5">
                <CalendarGlyph />
                המפגש הבא
                <span className="font-mono text-slate-300">{nextSession}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* accent baseline */}
      <div className={`h-px w-full bg-gradient-to-l ${accent.line}`} />
    </header>
  )
}
