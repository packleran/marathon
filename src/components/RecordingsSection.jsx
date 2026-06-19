const accentGlows = [
  'rgba(56,189,248,0.20)',
  'rgba(167,139,250,0.20)',
  'rgba(45,212,191,0.20)',
  'rgba(99,102,241,0.20)',
]

export default function RecordingsSection({ course }) {
  const { recordings } = course

  if (recordings.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/70 shadow-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200/70">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">עוד אין הקלטות לקורס הזה</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {recordings.map((r, i) => (
        <div
          key={r.id}
          className="group cursor-pointer animate-fade-in-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-900/60 shadow-card transition-shadow duration-300 group-hover:shadow-card-hover">
            <div className="pointer-events-none absolute inset-0 tech-grid opacity-60" />
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-300 group-hover:opacity-100 opacity-70"
              style={{ background: `radial-gradient(circle at 70% 30%, ${accentGlows[i % accentGlows.length]}, transparent 65%)` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white group-hover:ring-white">
                <svg className="mr-[-2px] h-5 w-5 text-white transition-colors duration-300 group-hover:text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <div className="absolute bottom-3 left-3">
              <span className="rounded-md bg-black/40 px-2 py-0.5 text-[11px] font-mono font-medium tabular-nums text-white/90 ring-1 ring-white/10 backdrop-blur-sm">
                {r.duration}
              </span>
            </div>
          </div>
          <div className="mt-3.5 px-0.5">
            <p className="text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-slate-600">
              {r.title}
            </p>
            <p className="mt-1 text-xs text-slate-400 font-mono">{r.date}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
