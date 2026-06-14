import { topics } from '../data'

const colorMap = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-400' },
}

export default function TopicsCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">נושאי הליבה</h2>
      </div>

      <div className="space-y-3">
        {topics.map((t) => {
          const c = colorMap[t.color]
          return (
            <div key={t.id} className="rounded-xl bg-white p-3.5 border border-slate-100/80">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                <span className={`inline-flex rounded-md ${c.bg} ${c.text} px-2.5 py-0.5 text-xs font-medium`}>
                  {t.name}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500 pr-4">{t.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
