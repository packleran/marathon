import { recordings } from '../data'

const gradients = [
  'from-indigo-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-fuchsia-500 to-pink-600',
]

function PlayIcon() {
  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
        <svg className="h-4 w-4 text-slate-800 mr-[-2px]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  )
}

export default function RecordingsCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 shadow-sm md:col-span-2">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">הקלטות אחרונות</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {recordings.map((r, i) => (
          <div key={r.id} className="group cursor-pointer">
            <div className={`relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br ${gradients[i % gradients.length]} mb-3`}>
              <div className="absolute inset-0 flex items-end p-3">
                <span className="rounded-md bg-black/30 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  {r.duration}
                </span>
              </div>
              <PlayIcon />
            </div>
            <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors">
              {r.title}
            </p>
            <p className="mt-1 text-xs text-slate-400">{r.date}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
