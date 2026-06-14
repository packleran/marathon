import { recordings } from '../data'

const gradients = [
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-teal-500',
  'from-blue-500 to-indigo-600',
]

export default function RecordingsSection() {
  return (
    <div>
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
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
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
    </div>
  )
}
