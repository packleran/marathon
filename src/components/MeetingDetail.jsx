import { useState } from 'react'

const detailTabs = [
  { key: 'overview', label: 'סקירה', icon: 'M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5' },
  { key: 'materials', label: 'חומרים', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { key: 'questions', label: 'שאלות', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
]

function OverviewTab({ meeting }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 leading-relaxed">{meeting.description}</p>
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">נושאים</h4>
        <div className="flex flex-wrap gap-2">
          {meeting.topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center rounded-lg bg-gradient-to-b from-sky-50 to-blue-50 px-3 py-1.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200/50"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
        <div className="flex items-center gap-3 text-sm">
          {meeting.type === 'zoom' ? (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-700">מפגש בזום</p>
                <p className="text-xs text-slate-400">קישור יפורסם בקבוצה לפני המפגש</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-700">מפגש פרונטלי</p>
                <p className="text-xs text-slate-400">{meeting.location}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MaterialsTab({ meeting }) {
  const { presentations, exercises } = meeting.materials
  const empty = presentations.length === 0 && exercises.length === 0

  if (empty) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">חומרים יעלו לקראת המפגש</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {presentations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">מצגות</h4>
          <div className="space-y-2">
            {presentations.map((p, i) => (
              <a key={i} href={p.url} className="group flex items-center gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-sky-700 transition-colors">{p.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      {exercises.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">תרגילים ודפי עבודה</h4>
          <div className="space-y-2">
            {exercises.map((e, i) => (
              <a key={i} href={e.url} className="group flex items-center gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-500">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-sky-700 transition-colors">{e.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionsTab({ meeting }) {
  const { questions } = meeting.materials
  const [openQ, setOpenQ] = useState(null)

  if (questions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">עוד אין שאלות למפגש הזה</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {questions.map((q, i) => (
        <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
          <button
            onClick={() => setOpenQ(openQ === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors"
          >
            <span className="text-sm font-medium text-slate-700">{q.question}</span>
            <svg
              className={`h-4 w-4 text-slate-400 flex-shrink-0 mr-3 transition-transform duration-200 ${openQ === i ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openQ === i && (
            <div className="px-4 pb-4 border-t border-slate-100">
              <p className="pt-3 text-sm text-slate-600 leading-relaxed">{q.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function MeetingDetail({ meeting }) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="animate-expand border-t border-slate-100">
      <div className="p-5 md:p-6 pt-0 md:pt-0">
        <div className="flex gap-1 border-b border-slate-100 mb-5 -mx-1">
          {detailTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px cursor-pointer ${
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && <OverviewTab meeting={meeting} />}
        {activeTab === 'materials' && <MaterialsTab meeting={meeting} />}
        {activeTab === 'questions' && <QuestionsTab meeting={meeting} />}
      </div>
    </div>
  )
}
