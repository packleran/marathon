import { resources } from '../data'

function FolderIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}

const iconMap = {
  folder: { Icon: FolderIcon, bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20' },
  pdf: { Icon: PdfIcon, bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'ring-rose-500/20' },
  link: { Icon: LinkIcon, bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/20' },
}

export default function ResourcesCard() {
  return (
    <div className="glass-card glow-border rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-zinc-100">קישורים מהירים</h2>
      </div>

      <div className="space-y-2">
        {resources.map((r) => {
          const { Icon, bg, text, ring } = iconMap[r.icon]
          return (
            <a
              key={r.id}
              href={r.url}
              className="group flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all duration-200"
            >
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${bg} ${text} ring-1 ${ring}`}>
                <Icon />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{r.title}</p>
                <p className="text-[11px] text-zinc-600 truncate">{r.description}</p>
              </div>
              <svg className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            </a>
          )
        })}
      </div>
    </div>
  )
}
