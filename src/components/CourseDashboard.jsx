import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './Header'
import MeetingsSection from './MeetingsSection'
import RecordingsSection from './RecordingsSection'
import Sidebar from './Sidebar'
import { courses } from '../data'
import { duplicateCourseMaterials } from '../uploadedMaterials'
import {
  addCustomCourseOverride,
  addMeetingOverride,
  applyContentOverrides,
  createContentPolling,
  createBlankMeeting,
  createDuplicatedCourse,
  createDuplicatedMeeting,
  deleteCourseOverride,
  deleteMeetingOverride,
  loadContentOverrides,
  loadRemoteContentOverrides,
  mergeLocalContentIntoRemote,
  persistContentOverrides,
  persistRemoteContentOverrides,
  setCourseLockedOverride,
  subscribeToRemoteContentChanges,
  updateCourseOverride,
  updateMeetingOverride,
} from '../siteContent'

const APP_ROLE = import.meta.env.VITE_APP_ROLE === 'admin' ? 'admin' : 'student'
const IS_ADMIN_DEPLOYMENT = APP_ROLE === 'admin'

// Active controls are near-monochrome (slate-900) for a refined, "tool" feel.
// Per-course identity comes through as a subtle accent on the icon/dot.
const ACTIVE_TAB = 'bg-slate-900 text-white shadow-sm'

const courseAccents = {
  sky: 'text-sky-500',
  violet: 'text-violet-500',
  emerald: 'text-emerald-500',
}

const contentTabs = [
  { key: 'meetings', label: 'מפגשים' },
  { key: 'recordings', label: 'הקלטות' },
]

function toDatetimeLocal(value) {
  return value ? value.slice(0, 16) : ''
}

function formatJson(value) {
  return JSON.stringify(value ?? [], null, 2)
}

function parseJsonArray(label, value) {
  const parsed = JSON.parse(value)
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} חייב להיות מערך JSON`)
  }

  return parsed
}

function clearModeQueryParams() {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('admin')
  url.searchParams.delete('student')
  window.history.replaceState(null, '', url)
}

function isStudentViewRequested() {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const adminParam = params.get('admin')
  const studentParam = params.get('student')

  if (studentParam === '1' || studentParam === 'true' || adminParam === '0') {
    return true
  }

  return false
}

function getInitialAdminMode() {
  return IS_ADMIN_DEPLOYMENT && !isStudentViewRequested()
}

function IconButtonSvg({ path, className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

function DuplicateIcon() {
  return (
    <IconButtonSvg
      path="M8.25 8.25h10.5v10.5H8.25z M5.25 15.75V5.25h10.5"
      className="h-4 w-4"
    />
  )
}

function PlusIcon() {
  return <IconButtonSvg path="M12 4.5v15m7.5-7.5h-15" />
}

function LockIcon() {
  return (
    <IconButtonSvg path="M16.5 10.5V7.5a4.5 4.5 0 00-9 0v3m-.75 0h10.5A1.5 1.5 0 0118.75 12v6.75a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5V12a1.5 1.5 0 011.5-1.5z" />
  )
}

function UnlockIcon() {
  return (
    <IconButtonSvg path="M13.5 10.5V7.5a4.5 4.5 0 018.75-1.5M6.75 10.5h10.5A1.5 1.5 0 0118.75 12v6.75a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5V12a1.5 1.5 0 011.5-1.5z" />
  )
}

function TrashIcon() {
  return (
    <IconButtonSvg path="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 5.79L17.22 19.67A2.25 2.25 0 0114.977 21H9.023a2.25 2.25 0 01-2.243-2.33L5.84 5.79m12.32 0a48.108 48.108 0 00-3.478-.397m-12.56.563c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.16 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  )
}

function DownloadIcon() {
  return <IconButtonSvg path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3" />
}

function EyeIcon() {
  return <IconButtonSvg path="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.01 9.964 7.183.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.01-9.964-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
}

function ModeToolbar({
  isAdminMode,
  onAdminView,
  onExport,
  syncStatus,
  onStudentView,
}) {
  return (
    <div className="border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isAdminMode ? 'bg-emerald-500' : 'bg-sky-500'}`} />
          <span className="text-sm font-semibold text-slate-700">
            {isAdminMode ? 'מצב ניהול פעיל' : 'תצוגת סטודנט פעילה'}
          </span>
          {syncStatus && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              syncStatus.type === 'error'
                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
            }`}>
              {syncStatus.text}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
            <button
              type="button"
              onClick={onStudentView}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                !isAdminMode
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-slate-700'
              }`}
            >
              <EyeIcon />
              סטודנט
            </button>
            <button
              type="button"
              onClick={onAdminView}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                isAdminMode
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-slate-700'
              }`}
            >
              <UnlockIcon />
              אדמין
            </button>
          </div>
          {isAdminMode && (
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-600 cursor-pointer"
            >
              <DownloadIcon />
              ייצוא עריכות
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CourseEditor({
  course,
  canDelete,
  canEditContent,
  isLocked,
  onAddMeeting,
  onDelete,
  onDuplicate,
  onLock,
  onSave,
  onUnlock,
}) {
  const [form, setForm] = useState({
    name: course.name,
    subtitle: course.subtitle,
    nextSession: toDatetimeLocal(course.nextSession),
    recordings: formatJson(course.recordings),
    deadlines: formatJson(course.deadlines),
    resources: formatJson(course.resources),
  })
  const [status, setStatus] = useState(null)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canEditContent) return

    let recordings
    let deadlines
    let resources

    try {
      recordings = parseJsonArray('הקלטות', form.recordings)
      deadlines = parseJsonArray('תאריכים חשובים', form.deadlines)
      resources = parseJsonArray('קישורים מהירים', form.resources)
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
      return
    }

    onSave({
      name: form.name.trim(),
      subtitle: form.subtitle.trim(),
      nextSession: form.nextSession,
      recordings,
      deadlines,
      resources,
    })
    setStatus({ type: 'success', text: 'פרטי הקורס נשמרו' })
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mb-6 rounded-2xl bg-white p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">ניהול קבוצה</h2>
          {isLocked && (
            <p className="mt-1 text-xs text-amber-600">הקבוצה סגורה לעריכת פרטים וחומרים.</p>
          )}
        </div>
        {isLocked ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
            <LockIcon />
            סגור לעריכה
          </span>
        ) : (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
            <UnlockIcon />
            פתוח לעריכה
          </span>
        )}
      </div>

      <fieldset disabled={!canEditContent} className={!canEditContent ? 'opacity-60' : ''}>
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
        <details className="mt-4 rounded-xl border border-slate-100 bg-white p-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500">
            עריכה מתקדמת: הקלטות, תאריכים וקישורים
          </summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              הקלטות
              <textarea
                dir="ltr"
                value={form.recordings}
                onChange={(event) => updateField('recordings', event.target.value)}
                rows={10}
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-normal leading-relaxed text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              תאריכים חשובים
              <textarea
                dir="ltr"
                value={form.deadlines}
                onChange={(event) => updateField('deadlines', event.target.value)}
                rows={10}
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-normal leading-relaxed text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              קישורים מהירים
              <textarea
                dir="ltr"
                value={form.resources}
                onChange={(event) => updateField('resources', event.target.value)}
                rows={10}
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-normal leading-relaxed text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>
        </details>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!canEditContent}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          שמור פרטי קבוצה
        </button>
        <button
          type="button"
          onClick={onAddMeeting}
          disabled={!canEditContent}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <PlusIcon />
          הוסף מפגש
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-600 cursor-pointer"
        >
          <DuplicateIcon />
          שכפל לקבוצה נוספת
        </button>
        {isLocked ? (
          <button
            type="button"
            onClick={onUnlock}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100 cursor-pointer"
          >
            <UnlockIcon />
            פתח לעריכה
          </button>
        ) : (
          <button
            type="button"
            onClick={onLock}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 cursor-pointer"
          >
            <LockIcon />
            סמן כסופי
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-white px-4 py-2 text-sm font-medium text-rose-500 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <TrashIcon />
          מחק קבוצה
        </button>
        {status && (
          <span className={`text-xs ${status.type === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
            {status.text}
          </span>
        )}
      </div>
    </form>
  )
}

export default function CourseDashboard() {
  const [activeCourseId, setActiveCourseId] = useState(courses[0].id)
  const [activeContent, setActiveContent] = useState('meetings')
  const [contentOverrides, setContentOverrides] = useState(loadContentOverrides)
  const [isAdminMode, setIsAdminMode] = useState(getInitialAdminMode)
  const [focusedMeetingId, setFocusedMeetingId] = useState(null)
  const [contentSyncStatus, setContentSyncStatus] = useState(null)
  const [remoteRefreshToken, setRemoteRefreshToken] = useState(0)
  const contentOverridesRef = useRef(contentOverrides)

  const editableCourses = useMemo(
    () => applyContentOverrides(courses, contentOverrides),
    [contentOverrides],
  )
  const visibleCourses = editableCourses.length > 0 ? editableCourses : courses
  const course = visibleCourses.find((c) => c.id === activeCourseId) ?? visibleCourses[0]
  const isCourseLocked = Boolean(course.locked)
  const canEditContent = IS_ADMIN_DEPLOYMENT && isAdminMode && !isCourseLocked

  useEffect(() => {
    contentOverridesRef.current = contentOverrides
  }, [contentOverrides])

  useEffect(() => {
    let ignore = false

    async function refreshRemoteContent() {
      try {
        const remoteOverrides = await loadRemoteContentOverrides()
        if (ignore || remoteOverrides === null) return

        const localOverrides = loadContentOverrides()
        const mergedOverrides = IS_ADMIN_DEPLOYMENT
          ? mergeLocalContentIntoRemote(remoteOverrides, localOverrides)
          : remoteOverrides
        const recoveredLocalChanges = IS_ADMIN_DEPLOYMENT && mergedOverrides !== remoteOverrides

        contentOverridesRef.current = mergedOverrides
        setContentOverrides(mergedOverrides)
        persistContentOverrides(mergedOverrides)

        if (recoveredLocalChanges) {
          setContentSyncStatus({ type: 'success', text: 'משחזר קבוצות מקומיות...' })
          await persistRemoteContentOverrides(mergedOverrides)
          if (!ignore) {
            setContentSyncStatus({ type: 'success', text: 'הקבוצות שוחזרו לסטודנטים' })
          }
          return
        }

        setContentSyncStatus(null)
      } catch {
        if (!ignore && IS_ADMIN_DEPLOYMENT) {
          setContentSyncStatus({
            type: 'error',
            text: 'אין חיבור לתוכן המשותף',
          })
        }
      }
    }

    function handleRemoteChange() {
      setRemoteRefreshToken((current) => current + 1)
      refreshRemoteContent()
    }

    refreshRemoteContent()
    const unsubscribeEvents = subscribeToRemoteContentChanges(handleRemoteChange)
    const stopPolling = createContentPolling(handleRemoteChange)
    window.addEventListener('focus', handleRemoteChange)
    clearModeQueryParams()

    return () => {
      ignore = true
      unsubscribeEvents()
      stopPolling()
      window.removeEventListener('focus', handleRemoteChange)
    }
  }, [])

  function saveOverrides(update) {
    if (!IS_ADMIN_DEPLOYMENT) return

    const next = update(contentOverridesRef.current)
    contentOverridesRef.current = next
    setContentOverrides(next)
    persistContentOverrides(next)
    setContentSyncStatus({ type: 'success', text: 'שומר...' })

    persistRemoteContentOverrides(next)
      .then(() => setContentSyncStatus({ type: 'success', text: 'נשמר לסטודנטים' }))
      .catch(() => setContentSyncStatus({
        type: 'error',
        text: 'השינוי לא נשמר לסטודנטים',
      }))
  }

  function setAdminMode(enabled) {
    if (!IS_ADMIN_DEPLOYMENT) {
      setIsAdminMode(false)
      return
    }

    clearModeQueryParams()
    setIsAdminMode(enabled)
  }

  function handleExportContent() {
    const blob = new Blob([JSON.stringify(contentOverrides, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `marathon-content-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleSelectCourse(courseId) {
    setActiveCourseId(courseId)
    setActiveContent('meetings')
    setFocusedMeetingId(null)
  }

  function handleUpdateCourse(courseId, updates) {
    if (!canEditContent) return
    saveOverrides((current) => updateCourseOverride(current, courseId, updates))
  }

  function handleLockCourse(courseId) {
    if (!window.confirm('לסמן את הקבוצה כסופית ולסגור עריכת פרטים וחומרים?')) return
    saveOverrides((current) => setCourseLockedOverride(current, courseId, true))
  }

  function handleUnlockCourse(courseId) {
    if (!window.confirm('לפתוח את הקבוצה שוב לעריכה?')) return
    saveOverrides((current) => setCourseLockedOverride(current, courseId, false))
  }

  function handleAddMeeting(sourceCourse) {
    if (!canEditContent) return

    const meeting = createBlankMeeting(sourceCourse)
    saveOverrides((current) => addMeetingOverride(current, sourceCourse.id, meeting))
    setActiveContent('meetings')
    setFocusedMeetingId(meeting.id)
  }

  function handleDuplicateCourse(sourceCourse) {
    if (!canEditContent) return

    const duplicatedCourse = createDuplicatedCourse(sourceCourse)
    const meetings = sourceCourse.meetings.map((meeting, index) => ({
      sourceMeetingId: meeting.id,
      targetMeetingId: duplicatedCourse.meetings[index]?.id ?? meeting.id,
    }))

    saveOverrides((current) => addCustomCourseOverride(current, duplicatedCourse))
    setActiveCourseId(duplicatedCourse.id)
    setActiveContent('meetings')
    setFocusedMeetingId(null)
    setContentSyncStatus({ type: 'success', text: 'משכפל קבוצה וחומרים...' })

    duplicateCourseMaterials({
      sourceCourseId: sourceCourse.id,
      targetCourseId: duplicatedCourse.id,
      meetings,
    })
      .then(({ copiedMaterials = 0, copiedDeletedMaterials = 0 } = {}) => {
        setRemoteRefreshToken((current) => current + 1)

        const copiedCount = copiedMaterials + copiedDeletedMaterials
        setContentSyncStatus({
          type: 'success',
          text: copiedCount > 0
            ? `הקבוצה שוכפלה עם ${copiedCount} חומרים`
            : 'הקבוצה שוכפלה',
        })
      })
      .catch(() => {
        setContentSyncStatus({
          type: 'error',
          text: 'הקבוצה שוכפלה, אבל החומרים לא הועתקו',
        })
      })
  }

  function handleDeleteCourse(courseId) {
    if (visibleCourses.length <= 1) return

    const targetCourse = visibleCourses.find((item) => item.id === courseId)
    const remainingCourses = visibleCourses.filter((item) => item.id !== courseId)

    if (!window.confirm(`למחוק את הקבוצה "${targetCourse?.name ?? ''}"?`)) return

    saveOverrides((current) => deleteCourseOverride(current, courseId))
    setActiveCourseId(remainingCourses[0].id)
    setActiveContent('meetings')
    setFocusedMeetingId(null)
  }

  function handleUpdateMeeting(courseId, meetingId, updates) {
    if (!canEditContent) return
    saveOverrides((current) => updateMeetingOverride(current, courseId, meetingId, updates))
  }

  function handleDeleteMeeting(courseId, meetingId) {
    if (!canEditContent) return
    saveOverrides((current) => deleteMeetingOverride(current, courseId, meetingId))
  }

  function handleDuplicateMeeting(courseId, meeting) {
    if (!canEditContent) return

    const duplicatedMeeting = createDuplicatedMeeting(meeting)
    saveOverrides((current) => addMeetingOverride(current, courseId, duplicatedMeeting))
    setFocusedMeetingId(duplicatedMeeting.id)
  }

  return (
    <div className="min-h-screen">
      <Header course={course} />
      {IS_ADMIN_DEPLOYMENT && (
        <ModeToolbar
          isAdminMode={isAdminMode}
          onAdminView={() => setAdminMode(true)}
          onExport={handleExportContent}
          syncStatus={contentSyncStatus}
          onStudentView={() => setAdminMode(false)}
        />
      )}

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-card border border-slate-200/70 overflow-x-auto">
            {visibleCourses.map((c) => {
              const isActive = activeCourseId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCourse(c.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? ACTIVE_TAB
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className={`font-mono text-xs ${isActive ? 'text-white/60' : courseAccents[c.color] ?? 'text-slate-400'}`}>
                    {c.icon}
                  </span>
                  {c.name}
                  {c.locked && (
                    <span className="opacity-70">
                      <LockIcon />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-card border border-slate-200/70 w-fit">
            {contentTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveContent(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeContent === tab.key
                    ? ACTIVE_TAB
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isAdminMode && activeContent === 'meetings' && (
          <CourseEditor
            key={course.id}
            course={course}
            canDelete={visibleCourses.length > 1}
            canEditContent={canEditContent}
            isLocked={isCourseLocked}
            onAddMeeting={() => handleAddMeeting(course)}
            onDelete={() => handleDeleteCourse(course.id)}
            onDuplicate={() => handleDuplicateCourse(course)}
            onLock={() => handleLockCourse(course.id)}
            onSave={(updates) => handleUpdateCourse(course.id, updates)}
            onUnlock={() => handleUnlockCourse(course.id)}
          />
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 min-w-0" key={`${activeCourseId}-${activeContent}`}>
            {activeContent === 'meetings' && (
              <MeetingsSection
                key={`${course.id}-${focusedMeetingId ?? 'list'}`}
                canEditContent={canEditContent}
                course={course}
                focusMeetingId={focusedMeetingId}
                isAdminMode={isAdminMode}
                onDeleteMeeting={handleDeleteMeeting}
                onDuplicateMeeting={handleDuplicateMeeting}
                onUpdateMeeting={handleUpdateMeeting}
                refreshToken={remoteRefreshToken}
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
