import { useEffect, useMemo, useState } from 'react'
import {
  createStudent,
  listStudents,
  resetStudentPassword,
  revokeStudentSessions,
  updateStudent,
} from '../studentAccess'

function IconButtonSvg({ path, className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

function KeyIcon() {
  return <IconButtonSvg path="M15.75 7.5a5.25 5.25 0 11-2.95 4.73L21 4.03V7.5h-3.47v3.47h-3.47" />
}

function CopyIcon() {
  return <IconButtonSvg path="M8.25 8.25h10.5v10.5H8.25z M5.25 15.75V5.25h10.5" />
}

function WhatsAppIcon() {
  return <IconButtonSvg path="M20.25 11.94a8.25 8.25 0 01-12.1 7.3L3.75 20.25l1.05-4.28A8.25 8.25 0 1120.25 11.94z M9.4 8.66c-.18-.4-.37-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.66 2.66 4.1 3.62 2.02.8 2.44.64 2.88.6.44-.04 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28l-1.36-.67c-.24-.12-.42-.18-.6.18-.18.36-.7 1.14-.86 1.34-.16.2-.32.22-.58.08-.26-.14-1.08-.4-2.05-1.27-.76-.68-1.27-1.52-1.42-1.78-.15-.26-.02-.4.11-.53.12-.12.26-.32.4-.48.13-.16.18-.28.26-.46.08-.18.04-.34-.02-.48l-.66-1.95z" />
}

function RefreshIcon() {
  return <IconButtonSvg path="M16.02 9.35h4.07V5.28 M20.09 9.35A8.25 8.25 0 105.3 16.52" />
}

function BlockIcon() {
  return <IconButtonSvg path="M18.36 5.64L5.64 18.36 M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
}

function LogoutIcon() {
  return <IconButtonSvg path="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3H21m0 0l-3-3m3 3l-3 3" />
}

function CheckIcon() {
  return <IconButtonSvg path="M4.5 12.75l5.25 5.25L19.5 6" />
}

function formatDate(value) {
  if (!value) return 'עדיין לא התחבר'

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function upsertStudent(students, nextStudent) {
  const exists = students.some((student) => student.id === nextStudent.id)
  if (!exists) return [nextStudent, ...students]

  return students.map((student) => (
    student.id === nextStudent.id ? nextStudent : student
  ))
}

function whatsAppStatusType(whatsApp) {
  if (!whatsApp || whatsApp?.status === 'sent' || whatsApp?.status === 'skipped') return 'success'
  return 'error'
}

function appendWhatsAppStatus(text, whatsApp) {
  if (!whatsApp || whatsApp.status === 'skipped') return text
  return `${text}. ${whatsApp.text}`
}

function firstCourseId(student) {
  return Array.isArray(student.courseIds) ? student.courseIds[0] ?? '' : ''
}

function isPhoneLoginCourseId(courseId, phoneLoginCourseIdSet = new Set()) {
  const normalizedCourseId = String(courseId ?? '')
  if (phoneLoginCourseIdSet.has(normalizedCourseId)) return true

  return [...phoneLoginCourseIdSet].some((rootId) => normalizedCourseId.startsWith(`${rootId}-group-`))
}

function courseName(courses, courseId, phoneLoginCourseIdSet = new Set()) {
  const label = courses.find((course) => String(course.id) === String(courseId))?.name ?? courseId
  return isPhoneLoginCourseId(courseId, phoneLoginCourseIdSet) ? `${label} (ללא סיסמה)` : label
}

function toWhatsAppPhoneNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return `972${digits.slice(1)}`

  return digits
}

function createCredentialsMessage(credentials) {
  return [
    `שלום${credentials.name ? ` ${credentials.name}` : ''},`,
    'פרטי הכניסה שלך לאתר המרתון:',
    `שם משתמש: ${credentials.phone}`,
    `סיסמה: ${credentials.password}`,
    credentials.courseName ? `קורס: ${credentials.courseName}` : null,
  ].filter(Boolean).join('\n')
}

function createWhatsAppWebUrl(credentials) {
  const phone = toWhatsAppPhoneNumber(credentials?.phone)
  if (!phone) return ''

  return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(createCredentialsMessage(credentials))}`
}

export default function StudentAccessPanel({ courses = [], phoneLoginCourseIds = [] }) {
  const [students, setStudents] = useState([])
  const [form, setForm] = useState({ phone: '', name: '', courseId: '', password: '' })
  const [passwordMode, setPasswordMode] = useState('auto')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [credentials, setCredentials] = useState(null)

  const activeCount = useMemo(
    () => students.filter((student) => student.active).length,
    [students],
  )
  const selectedCourseId = form.courseId || (courses[0]?.id ? String(courses[0].id) : '')
  const phoneLoginCourseIdSet = useMemo(
    () => new Set(phoneLoginCourseIds.map(String)),
    [phoneLoginCourseIds],
  )

  useEffect(() => {
    let ignore = false

    async function loadStudents() {
      setIsLoading(true)
      try {
        const loadedStudents = await listStudents()
        if (!ignore) {
          setStudents(loadedStudents)
          setStatus(null)
        }
      } catch {
        if (!ignore) {
          setStatus({ type: 'error', text: 'לא ניתן לטעון את רשימת הסטודנטים' })
        }
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    loadStudents()

    return () => {
      ignore = true
    }
  }, [])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function createCredentialsPayload(student, password, whatsApp) {
    const courseId = firstCourseId(student)

    return {
      phone: student.phone,
      name: student.name,
      password,
      courseName: courseId ? courseName(courses, courseId, phoneLoginCourseIdSet) : '',
      whatsApp,
    }
  }

  async function handleCreateStudent(event) {
    event.preventDefault()
    setIsSaving(true)
    setStatus(null)
    setCredentials(null)

    try {
      const data = await createStudent({
        phone: form.phone,
        name: form.name,
        courseIds: [selectedCourseId],
        password: passwordMode === 'manual' ? form.password : '',
      })
      setStudents((current) => upsertStudent(current, data.student))
      setCredentials(createCredentialsPayload(data.student, data.password, data.whatsApp))
      setForm({ phone: '', name: '', courseId: '', password: '' })
      setPasswordMode('auto')
      setStatus({
        type: whatsAppStatusType(data.whatsApp),
        text: appendWhatsAppStatus('הגישה לסטודנט נפתחה', data.whatsApp),
      })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResetPassword(student) {
    if (!window.confirm(`לאפס סיסמה ל-${student.phone}?`)) return

    setStatus(null)
    setCredentials(null)

    try {
      const data = await resetStudentPassword(student.id)
      setStudents((current) => upsertStudent(current, data.student))
      setCredentials(createCredentialsPayload(data.student, data.password, data.whatsApp))
      setStatus({
        type: whatsAppStatusType(data.whatsApp),
        text: appendWhatsAppStatus('הסיסמה אופסה', data.whatsApp),
      })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    }
  }

  async function handleToggleActive(student) {
    const nextActive = !student.active
    if (!nextActive && !window.confirm(`לחסום את הגישה של ${student.phone}?`)) return

    setStatus(null)

    try {
      const data = await updateStudent(student.id, { active: nextActive })
      setStudents((current) => upsertStudent(current, data.student))
      setStatus({
        type: 'success',
        text: nextActive ? 'המשתמש הופעל' : 'המשתמש נחסם',
      })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    }
  }

  async function handleUpdateCourse(student, courseId) {
    if (!courseId) return

    setStatus(null)

    try {
      const data = await updateStudent(student.id, { courseIds: [courseId] })
      setStudents((current) => upsertStudent(current, data.student))
      setStatus({ type: 'success', text: 'שיוך הקורס עודכן' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    }
  }

  async function handleRevokeSessions(student) {
    if (!window.confirm(`לנתק את כל החיבורים הפעילים של ${student.phone}?`)) return

    setStatus(null)

    try {
      const data = await revokeStudentSessions(student.id)
      setStudents((current) => upsertStudent(current, data.student))
      setStatus({
        type: 'success',
        text: data.revokedSessions > 0 ? 'החיבורים הפעילים נותקו' : 'לא היו חיבורים פעילים לניתוק',
      })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    }
  }

  async function handleCopyCredentials() {
    if (!credentials) return

    await navigator.clipboard.writeText(createCredentialsMessage(credentials))
    setStatus({ type: 'success', text: 'פרטי הכניסה הועתקו' })
  }

  function handleOpenWhatsAppWeb() {
    const url = createWhatsAppWebUrl(credentials)
    if (!url) {
      setStatus({ type: 'error', text: 'אין מספר טלפון תקין לפתיחה ב-WhatsApp' })
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
    setStatus({ type: 'success', text: 'נפתח WhatsApp Web עם הודעה מוכנה לשליחה' })
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
            <KeyIcon />
            גישה לסטודנטים
          </h2>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            פתיחת משתמש אחרי תשלום. בקורסים בתשלום אפשר חיבור פעיל אחד בלבד; כדי לעבור מחשב צריך לצאת או לנתק חיבורים פעילים.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          {activeCount} פעילים
        </div>
      </div>

      <form noValidate onSubmit={handleCreateStudent} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.2fr_auto] lg:items-end">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          טלפון
          <input
            value={form.phone}
            onChange={(event) => updateForm('phone', event.target.value)}
            inputMode="tel"
            placeholder="0521234567"
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
            required
          />
        </label>

        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          שם
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
            placeholder="שם הסטודנט"
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
        </label>

        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          קורס
          <select
            value={selectedCourseId}
            onChange={(event) => updateForm('courseId', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
            required
          >
            <option value="" disabled>בחר קורס</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {courseName(courses, course.id, phoneLoginCourseIdSet)}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="mb-1.5 flex items-center gap-1 rounded-lg border border-border bg-inset p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setPasswordMode('auto')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                passwordMode === 'auto'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:bg-white hover:text-text'
              }`}
            >
              סיסמה אוטומטית
            </button>
            <button
              type="button"
              onClick={() => setPasswordMode('manual')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                passwordMode === 'manual'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:bg-white hover:text-text'
              }`}
            >
              סיסמה ידנית
            </button>
          </div>
          <input
            value={form.password}
            onChange={(event) => updateForm('password', event.target.value)}
            disabled={passwordMode === 'auto'}
            placeholder={passwordMode === 'auto' ? 'תיווצר אוטומטית' : 'לפחות 8 תווים'}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft disabled:bg-inset disabled:text-text-muted"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving || !form.phone.trim() || !selectedCourseId || (passwordMode === 'manual' && form.password.length < 8)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <KeyIcon />
          פתח גישה
        </button>
      </form>

      {(status || credentials) && (
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {credentials && (
            <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-text">
              <div className="font-semibold text-success">פרטי כניסה למסירה לסטודנט</div>
              <div className="mt-1 font-mono text-[13px]" dir="ltr">
                {credentials.phone} / {credentials.password}
              </div>
              {credentials.whatsApp && credentials.whatsApp.status !== 'skipped' && (
                <div className={`mt-2 text-xs ${
                  credentials.whatsApp.status === 'sent' ? 'text-success' : 'text-danger'
                }`}>
                  {credentials.whatsApp.text}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {credentials && (
              <>
                <button
                  type="button"
                  onClick={handleOpenWhatsAppWeb}
                  className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-white px-3 py-2 text-xs font-medium text-success shadow-sm transition-colors hover:border-success/50 hover:bg-success/10 cursor-pointer"
                >
                  <WhatsAppIcon />
                  WhatsApp Web
                </button>
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-text-2 shadow-sm transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
                >
                  <CopyIcon />
                  העתק
                </button>
              </>
            )}
            {status && (
              <span className={`text-xs ${status.type === 'error' ? 'text-danger' : 'text-success'}`}>
                {status.text}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-border-subtle">
        <div className="grid grid-cols-[1fr_auto] gap-3 bg-inset px-4 py-2 text-xs font-semibold text-text-muted md:grid-cols-[1.1fr_1fr_1fr_1fr_auto]">
          <span>טלפון</span>
          <span className="hidden md:block">שם</span>
          <span className="hidden md:block">קורס</span>
          <span className="hidden md:block">חיבור</span>
          <span>פעולות</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-5 text-sm text-text-muted">טוען סטודנטים...</div>
        ) : students.length === 0 ? (
          <div className="px-4 py-5 text-sm text-text-muted">עדיין לא נפתחו משתמשי סטודנטים.</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {students.map((student) => (
              <div
                key={student.id}
                className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm md:grid-cols-[1.1fr_1fr_1fr_1fr_auto] md:items-center"
              >
                <div>
                  <div className="font-mono text-[13px] font-semibold text-text" dir="ltr">{student.phone}</div>
                  <div className={`mt-1 text-xs ${student.active ? 'text-success' : 'text-danger'}`}>
                    {student.active ? 'פעיל' : 'חסום'}
                  </div>
                </div>
                <div className="hidden text-text-2 md:block">{student.name || '-'}</div>
                <div className="hidden md:block">
                  <select
                    value={firstCourseId(student)}
                    onChange={(event) => handleUpdateCourse(student, event.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-xs font-medium text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                    aria-label={`שיוך קורס עבור ${student.phone}`}
                  >
                    <option value="" disabled>ללא קורס</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {courseName(courses, course.id, phoneLoginCourseIdSet)}
                      </option>
                    ))}
                    {firstCourseId(student) && !courses.some((course) => String(course.id) === firstCourseId(student)) && (
                      <option value={firstCourseId(student)}>
                        {courseName(courses, firstCourseId(student), phoneLoginCourseIdSet)}
                      </option>
                    )}
                  </select>
                </div>
                <div className="hidden md:block">
                  <div className={student.activeSessionCount > 0 ? 'font-semibold text-success' : 'text-text-muted'}>
                    {student.activeSessionCount > 0 ? 'מחובר עכשיו' : 'לא מחובר'}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">{formatDate(student.lastLoginAt)}</div>
                  <div className="mt-1 font-mono text-xs text-text-muted" dir="ltr">
                    {student.phoneLoginOnly || isPhoneLoginCourseId(firstCourseId(student), phoneLoginCourseIdSet)
                      ? 'Phone login: open'
                      : student.activeSessionCount > 0
                        ? 'Session: active'
                        : 'Session: none'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleResetPassword(student)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-text-2 shadow-sm transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
                  >
                    <RefreshIcon />
                    איפוס
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevokeSessions(student)}
                    disabled={student.activeSessionCount < 1}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-text-2 shadow-sm transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <LogoutIcon />
                    נתק
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(student)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm transition-colors cursor-pointer ${
                      student.active
                        ? 'border-danger/20 bg-white text-danger hover:bg-danger/10'
                        : 'border-success/20 bg-white text-success hover:bg-success/10'
                    }`}
                  >
                    {student.active ? <BlockIcon /> : <CheckIcon />}
                    {student.active ? 'חסום' : 'הפעל'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
