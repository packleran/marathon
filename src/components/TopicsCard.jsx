import { topics } from '../data'

const colorMap = {
  indigo: { ring: 'ring-indigo-500/20', bg: 'bg-indigo-500/10', text: 'text-indigo-400', dot: 'bg-indigo-400' },
  violet: { ring: 'ring-violet-500/20', bg: 'bg-violet-500/10', text: 'text-violet-400', dot: 'bg-violet-400' },
  blue: { ring: 'ring-blue-500/20', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  cyan: { ring: 'ring-cyan-500/20', bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
}

export default function TopicsCard() {
  return (
    <div className="glass-card glow-border rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '60ms' }}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
          <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-zinc-100">נושאי הליבה</h2>
      </div>

      <div className="space-y-2.5">
        {topics.map((t) => {
          const c = colorMap[t.color]
          return (
            <div key={t.id} className="rounded-xl bg-white/[0.03] p-3.5 border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all duration-200">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot} shadow-[0_0_6px] shadow-current`} />
                <span className={`inline-flex rounded-md ${c.bg} ${c.text} ring-1 ${c.ring} px-2.5 py-0.5 text-xs font-medium`}>
                  {t.name}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-500 pr-3.5">{t.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
