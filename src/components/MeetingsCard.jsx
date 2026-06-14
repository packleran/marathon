import { meetings } from '../data'

export default function MeetingsCard() {
  return (
    <div className="glass-card glow-border rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '0ms' }}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20">
          <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-zinc-100">המפגשים שלי</h2>
      </div>

      <div className="space-y-2.5">
        {meetings.map((m) => (
          <div
            key={m.id}
            className="group rounded-xl bg-white/[0.03] p-3.5 border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-zinc-200">{m.day}, {m.date}</p>
                <p className="mt-1 text-xs text-zinc-500 font-mono">{m.time}</p>
              </div>
              {m.type === 'zoom' && (
                <span className="rounded-full bg-blue-500/10 ring-1 ring-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                  זום
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-zinc-600">
              {m.type === 'zoom' ? (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              ) : (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              )}
              <span>{m.location}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
