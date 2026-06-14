import { useMemo, useState } from 'react'
import Header from './Header'
import MeetingsSection from './MeetingsSection'
import RecordingsSection from './RecordingsSection'
import Sidebar from './Sidebar'
import { courses } from '../data'
import {
  applyContentOverrides,
  loadContentOverrides,
  persistContentOverrides,
  updateCourseOverride,
  updateMeetingOverride,
} from '../siteContent'

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

function toDatetimeLocal(value) {
  return value ? value.slice(0, 16) : ''
}

function CourseEditor({ course, onSave }) {
  const [form, setForm] = useState({
    name: course.name,
    subtitle: course.subtitle,
    nextSession: toDatetimeLocal(course.nextSession),
  })
  const [status, setStatus] = useState(null)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave({
      name: form.name.trim(),
      subtitle: form.subtitle.trim(),
      nextSession: form.nextSession,
    })
    setStatus('פרטי הקורס נשמרו')
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mb-6 rounded-2xl bg-white p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h2 className="mb-4 text-sm font-semibold text-slate-800">עריכת פרטי קורס</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          שם הקורס
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          כותרת משנה
          <input
            value={form.subtitle}
            onChange={(event) => updateField('subtitle', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          המפגש הבא
          <input
            type="datetime-local"
            value={form.nextSession}
            onChange={(event) => updateField('nextSession', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-200 transition-colors hover:bg-sky-700 cursor-pointer">
          שמור פרטי קורס
        </button>
        {status && <span className="text-xs text-emerald-600">{status}</span>}
      </div>
    </form>
  )
}

export default function CourseDashboard() {
  const [activeCourseId, setActiveCourseId] = useState(courses[0].id)
  const [activeContent, setActiveContent] = useState('meetings')
  const [contentOverrides, setContentOverrides] = useState(loadContentOverrides)

  const editableCourses = useMemo(
    () => applyContentOverrides(courses, contentOverrides),
    [contentOverrides],
  )
  const course = editableCourses.find((c) => c.id === activeCourseId)
  const styles = colorStyles[course.color]

  function saveOverrides(update) {
    setContentOverrides((current) => {
      const next = update(current)
      persistContentOverrides(next)
      return next
    })
  }

  function handleUpdateCourse(courseId, updates) {
    saveOverrides((current) => updateCourseOverride(current, courseId, updates))
  }

  function handleUpdateMeeting(courseId, meetingId, updates) {
    saveOverrides((current) => updateMeetingOverride(current, courseId, meetingId, updates))
  }

  return (
    <div className="min-h-screen bg-[#fafbfd]">
      <Header course={course} />

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 rounded-xl bg-white p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 overflow-x-auto">
            {editableCourses.map((c) => (
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

        {activeContent === 'meetings' && (
          <CourseEditor
            key={course.id}
            course={course}
            onSave={(updates) => handleUpdateCourse(course.id, updates)}
          />
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 min-w-0" key={`${activeCourseId}-${activeContent}`}>
            {activeContent === 'meetings' && (
              <MeetingsSection
                course={course}
                onUpdateMeeting={handleUpdateMeeting}
              />
            )}
            {activeContent === 'recordings' && <RecordingsSection course={course} />}
          </div>
          <Sidebar course={course} />
        </div>
      </main>
    </div>
  )
}
