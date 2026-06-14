const gradients = [
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-teal-500',
  'from-blue-500 to-indigo-600',
]

export default function RecordingsSection({ course }) {
  const { recordings } = course

  if (recordings.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
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
          <div className={`relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br ${gradients[i % gradients.length]} shadow-sm`}>
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-xl backdrop-blur-sm">
                <svg className="h-6 w-6 text-slate-800 mr-[-2px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <div className="absolute bottom-3 left-3">
              <span className="rounded-md bg-black/30 backdrop-blur-sm px-2 py-0.5 text-[11px] font-mono font-medium text-white/90">
                {r.duration}
              </span>
            </div>
          </div>
          <div className="mt-3.5 px-0.5">
            <p className="text-sm font-semibold text-slate-800 leading-snug group-hover:text-sky-600 transition-colors">
              {r.title}
            </p>
            <p className="mt-1 text-xs text-slate-400">{r.date}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
