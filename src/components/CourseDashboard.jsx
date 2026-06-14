import { useState } from 'react'
import Header from './Header'
import MeetingsSection from './MeetingsSection'
import RecordingsSection from './RecordingsSection'
import Sidebar from './Sidebar'
import { courses } from '../data'

const colorStyles = {
  sky: {
    activeCourseTab: 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-200/50',
    activeContentTab: 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-sm shadow-blue-200',
  },
  violet: {
    activeCourseTab: 'bg-gradient-to-b from-violet-500 to-purple-600 text-white shadow-sm shadow-violet-200/50',
    activeContentTab: 'bg-gradient-to-b from-violet-500 to-purple-600 text-white shadow-sm shadow-violet-200',
  },
  emerald: {
    activeCourseTab: 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-200/50',
    activeContentTab: 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-200',
  },
}

const contentTabs = [
  { key: 'meetings', label: 'מפגשים' },
  { key: 'recordings', label: 'הקלטות' },
]

export default function CourseDashboard() {
  const [activeCourseId, setActiveCourseId] = useState(courses[0].id)
  const [activeContent, setActiveContent] = useState('meetings')

  const course = courses.find((c) => c.id === activeCourseId)
  const styles = colorStyles[course.color]

  return (
    <div className="min-h-screen bg-[#fafbfd]">
      <Header course={course} />

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 rounded-xl bg-white p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 overflow-x-auto">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveCourseId(c.id); setActiveContent('meetings') }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeCourseId === c.id
                    ? colorStyles[c.color].activeCourseTab
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono text-xs opacity-70">{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 w-fit">
            {contentTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveContent(tab.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  activeContent === tab.key
                    ? styles.activeContentTab
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 min-w-0" key={`${activeCourseId}-${activeContent}`}>
            {activeContent === 'meetings' && <MeetingsSection course={course} />}
            {activeContent === 'recordings' && <RecordingsSection course={course} />}
          </div>
          <Sidebar course={course} />
        </div>
      </main>
    </div>
  )
}
