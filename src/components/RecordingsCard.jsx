import { recordings } from '../data'

const gradients = [
  'from-indigo-600 via-indigo-500 to-blue-500',
  'from-violet-600 via-purple-500 to-fuchsia-500',
  'from-blue-600 via-cyan-500 to-teal-400',
  'from-rose-600 via-pink-500 to-orange-400',
]

export default function RecordingsCard() {
  return (
    <div className="glass-card glow-border rounded-2xl p-6 md:col-span-2 animate-fade-in" style={{ animationDelay: '180ms' }}>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <svg className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-zinc-100">הקלטות אחרונות</h2>
        </div>
        <button className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">
          הכל &larr;
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {recordings.map((r, i) => (
          <div key={r.id} className="group cursor-pointer">
            <div className={`relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br ${gradients[i]} shimmer`}>
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md ring-1 ring-white/30">
                  <svg className="h-5 w-5 text-white mr-[-2px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2">
                <span className="rounded-md bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[11px] font-mono font-medium text-white/90 ring-1 ring-white/10">
                  {r.duration}
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-300 leading-snug group-hover:text-white transition-colors">
              {r.title}
            </p>
            <p className="mt-1 text-xs text-zinc-600">{r.date}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
