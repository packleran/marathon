import { useEffect, useMemo, useState } from 'react'
import MuxPlayer from '@mux/mux-player-react'
import MuxUploader from '@mux/mux-uploader-react'
import { getCourseTheme } from '../theme'
import {
  createRecording,
  createRecordingDirectUpload,
  deleteRecording,
  getRecordingPlayback,
  listRecordings,
  syncRecording,
  updateRecording,
  unlockRecordings,
} from '../studentAccess'

const muxEnvKey = import.meta.env.VITE_MUX_ENV_KEY ?? ''
const RECORDINGS_PASSWORD_REQUIRED_CODE = 'recordings_password_required'

function browserOrigin() {
  if (typeof window === 'undefined') return ''

  return window.location.origin
}

function uploadErrorText(event) {
  const message = String(event?.detail?.message ?? '').trim()
  if (message.includes('Server responded with 0')) {
    return 'ההעלאה נחסמה לפני שהתקבלה תשובת שרת. בדרך כלל זו בעיית CORS או חיבור רשת. צור העלאה חדשה ונסה שוב.'
  }

  return message || 'ההעלאה נכשלה'
}

function PlayIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}

function statusText(status) {
  switch (status) {
    case 'ready':
      return 'מוכן'
    case 'waiting_upload':
      return 'ממתין להעלאה'
    case 'errored':
      return 'נכשל'
    case 'preparing':
    case 'processing':
    case 'created':
      return 'בעיבוד'
    default:
      return status ? 'בעיבוד' : ''
  }
}

function providerText(provider) {
  if (provider === 'onedrive') return 'OneDrive'
  if (provider === 'googledrive') return 'Google Drive'
  if (provider === 'mux') return 'Mux'

  return ''
}

function externalPlaybackTitle(provider) {
  if (provider === 'googledrive') return 'צפייה ב-Google Drive'
  if (provider === 'onedrive') return 'צפייה ב-OneDrive / Teams'

  return 'צפייה בקישור חיצוני'
}

function recordingSortTime(recording) {
  const value = Date.parse(recording?.createdAt ?? '')
  return Number.isFinite(value) ? value : 0
}

function sortRecordingsOldestFirst(recordings) {
  return [...recordings].sort((a, b) => recordingSortTime(a) - recordingSortTime(b))
}

function formatViewerLabel(student) {
  const name = String(student?.name ?? '').trim()
  const phone = String(student?.phone ?? '').trim()
  return [name, phone].filter(Boolean).join(' · ')
}

function RecordingWatermark({ student }) {
  const label = formatViewerLabel(student)
  if (!label) return null

  return (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-2 content-around gap-y-10 overflow-hidden px-6 py-8 text-[13px] font-semibold text-white/28 sm:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={`watermark-${index}`}
          className="select-none whitespace-nowrap text-center"
          style={{ transform: `rotate(-18deg) translateX(${index % 2 === 0 ? 0 : 26}px)` }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-inset">
        <svg className="h-6 w-6 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>
      <p className="text-sm text-text-muted">עוד אין הקלטות לקורס הזה</p>
    </div>
  )
}

function RecordingsPasswordGate({
  error,
  isSubmitting,
  onPasswordChange,
  onSubmit,
  password,
}) {
  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-white p-6 text-right shadow-sm"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7.5a4.5 4.5 0 00-9 0v3m-.75 0h10.5A1.5 1.5 0 0118.75 12v6.75a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5V12a1.5 1.5 0 011.5-1.5z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-text">הקלטות נעולות</h2>
          <p className="mt-1 text-sm text-text-muted">יש להזין סיסמה כדי לצפות בהקלטות של מודלים.</p>
        </div>
      </div>

      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
        סיסמת הקלטות
        <input
          autoComplete="current-password"
          autoFocus
          className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
          onChange={(event) => onPasswordChange(event.target.value)}
          type="password"
          value={password}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting || !password.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          כניסה להקלטות
        </button>
        {error && (
          <span className="text-xs text-danger" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  )
}

function RecordingCard({ accent, index, isActive, onPlay, recording }) {
  const isReady = recording.status === 'ready'

  return (
    <button
      type="button"
      onClick={isReady ? onPlay : undefined}
      disabled={!isReady}
      className={`group animate-fade-in-up overflow-hidden rounded-2xl border bg-surface text-right shadow-sm transition-all duration-200 ${
        isReady
          ? 'cursor-pointer border-border hover:-translate-y-0.5 hover:shadow-lg'
          : 'cursor-not-allowed border-border-subtle opacity-75'
      } ${isActive ? 'ring-2 ring-primary-soft' : ''}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div
        className="relative flex aspect-video items-center justify-center"
        style={{ background: 'repeating-linear-gradient(135deg, #EEF0F6 0 12px, #F4F5F9 12px 24px)' }}
      >
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/90 text-primary shadow-md transition-transform duration-200 group-hover:scale-110">
          <PlayIcon className="mr-[-2px] h-5 w-5" />
        </div>
        {recording.duration && (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-[#15172A]/[0.78] px-2 py-0.5 font-mono text-[11.5px] font-semibold tracking-wide text-white">
            {recording.duration}
          </span>
        )}
        {recording.status && recording.status !== 'ready' && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-text-2 shadow-sm">
            {statusText(recording.status)}
          </span>
        )}
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <p className="mb-1.5 text-[14.5px] font-semibold text-text">{recording.title}</p>
        <p className="flex items-center gap-1.5 font-mono text-xs text-text-muted">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="17" rx="2.5" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          {recording.date || recording.dateLabel || 'ללא תאריך'}
        </p>
        {isActive && (
          <span
            className="mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ background: accent.accent }}
          >
            מתנגן עכשיו
          </span>
        )}
      </div>
    </button>
  )
}

function AdminRecordingPanel({ canEditContent, courseId, onCreated, onDeleted, onSynced, recordings }) {
  const [mode, setMode] = useState('upload')
  const [form, setForm] = useState({
    title: '',
    dateLabel: '',
    sourceUrl: '',
    accessNote: '',
    providerAssetId: '',
    providerPlaybackId: '',
  })
  const [activeUpload, setActiveUpload] = useState(null)
  const [editingRecordingId, setEditingRecordingId] = useState('')
  const [editForm, setEditForm] = useState({ title: '', dateLabel: '', accessNote: '' })
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateEditField(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  function startEditing(recording) {
    setEditingRecordingId(recording.id)
    setEditForm({
      title: recording.title ?? '',
      dateLabel: recording.dateLabel ?? recording.date ?? '',
      accessNote: recording.accessNote ?? '',
    })
    setStatus(null)
  }

  function stopEditing() {
    setEditingRecordingId('')
    setEditForm({ title: '', dateLabel: '', accessNote: '' })
  }

  const canSubmit = canEditContent &&
    !isSubmitting &&
    Boolean(form.title.trim()) &&
    (!['mux-url', 'onedrive', 'googledrive'].includes(mode) || Boolean(form.sourceUrl.trim())) &&
    (mode !== 'existing' || Boolean(form.providerAssetId.trim() || form.providerPlaybackId.trim()))

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canEditContent) return

    setStatus(null)
    setIsSubmitting(true)

    try {
      if (mode === 'upload') {
        const data = await createRecordingDirectUpload({
          courseId,
          title: form.title,
          dateLabel: form.dateLabel,
        })
        setActiveUpload({ recording: data.recording, uploadUrl: data.uploadUrl, uploadOrigin: data.uploadOrigin })
        onCreated(data.recording)
        setStatus({ type: 'success', text: 'נוצרה העלאה ישירה ל-Mux' })
      } else if (mode === 'mux-url') {
        const data = await createRecording({
          provider: 'mux',
          courseId,
          title: form.title,
          dateLabel: form.dateLabel,
          sourceUrl: form.sourceUrl,
        })
        onCreated(data.recording)
        setStatus({ type: 'success', text: 'ייבוא הקישור ל-Mux התחיל' })
      } else if (mode === 'onedrive') {
        const data = await createRecording({
          provider: 'onedrive',
          courseId,
          title: form.title,
          dateLabel: form.dateLabel,
          sourceUrl: form.sourceUrl,
          accessNote: form.accessNote,
        })
        onCreated(data.recording)
        setStatus({ type: 'success', text: 'קישור OneDrive נוסף' })
      } else if (mode === 'googledrive') {
        const data = await createRecording({
          provider: 'googledrive',
          courseId,
          title: form.title,
          dateLabel: form.dateLabel,
          sourceUrl: form.sourceUrl,
          accessNote: form.accessNote,
        })
        onCreated(data.recording)
        setStatus({ type: 'success', text: 'קישור Google Drive נוסף' })
      } else {
        const data = await createRecording({
          provider: 'mux',
          courseId,
          title: form.title,
          dateLabel: form.dateLabel,
          providerAssetId: form.providerAssetId,
          providerPlaybackId: form.providerPlaybackId,
        })
        onCreated(data.recording)
        setStatus({ type: 'success', text: 'ההקלטה נוספה' })
      }

      setForm({
        title: '',
        dateLabel: '',
        sourceUrl: '',
        accessNote: '',
        providerAssetId: '',
        providerPlaybackId: '',
      })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSync(recordingId) {
    setStatus(null)
    try {
      const data = await syncRecording(recordingId)
      onSynced(data.recording)
      setStatus({ type: 'success', text: 'סטטוס ההקלטה עודכן' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    }
  }

  function handleUploadError(event) {
    setStatus({ type: 'error', text: uploadErrorText(event) })
  }

  async function handleDelete(recording) {
    if (!window.confirm(`למחוק את ההקלטה "${recording.title}" מהאתר?`)) return

    setStatus(null)
    try {
      await deleteRecording(recording.id)
      onDeleted(recording.id)
      setStatus({ type: 'success', text: 'ההקלטה נמחקה מהאתר' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    }
  }

  async function handleSaveEdit(event, recording) {
    event.preventDefault()
    if (!canEditContent || !editForm.title.trim()) return

    setStatus(null)
    setIsEditing(true)

    try {
      const updates = {
        title: editForm.title,
        dateLabel: editForm.dateLabel,
      }

      if (recording.provider === 'onedrive' || recording.provider === 'googledrive') {
        updates.accessNote = editForm.accessNote
      }

      const data = await updateRecording(recording.id, updates)
      onSynced(data.recording)
      stopEditing()
      setStatus({ type: 'success', text: 'ההקלטה עודכנה' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsEditing(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-border-subtle bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text">הוספת הקלטה</h2>
        </div>
        <div className="flex w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-inset p-1 sm:w-fit">
          {[
            { key: 'upload', label: 'Mux מהמחשב' },
            { key: 'mux-url', label: 'Mux מקישור' },
            { key: 'onedrive', label: 'קישור OneDrive' },
            { key: 'googledrive', label: 'קישור Google Drive' },
            { key: 'existing', label: 'Mux קיים' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setMode(item.key)
                setStatus(null)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                mode === item.key ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:bg-white hover:text-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit}>
        <fieldset disabled={!canEditContent || isSubmitting} className={!canEditContent ? 'opacity-60' : ''}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              כותרת
              <input
                required
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
              />
            </label>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              תאריך/תיאור קצר
              <input
                value={form.dateLabel}
                onChange={(event) => updateField('dateLabel', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
              />
            </label>
          </div>

          {mode === 'mux-url' && (
            <label className="mt-3 block text-xs font-semibold text-text-muted uppercase tracking-wider">
              קישור ציבורי לייבוא
              <input
                dir="ltr"
                type="url"
                value={form.sourceUrl}
                onChange={(event) => updateField('sourceUrl', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-left text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
              />
            </label>
          )}

          {mode === 'onedrive' && (
            <label className="mt-3 block text-xs font-semibold text-text-muted uppercase tracking-wider">
              קישור OneDrive / Teams
              <input
                dir="ltr"
                type="url"
                value={form.sourceUrl}
                onChange={(event) => updateField('sourceUrl', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-left text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
              />
            </label>
          )}

          {mode === 'googledrive' && (
            <label className="mt-3 block text-xs font-semibold text-text-muted uppercase tracking-wider">
              קישור Google Drive
              <input
                dir="ltr"
                type="url"
                value={form.sourceUrl}
                onChange={(event) => updateField('sourceUrl', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-left text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
              />
            </label>
          )}

          {(mode === 'onedrive' || mode === 'googledrive') && (
            <label className="mt-3 block text-xs font-semibold text-text-muted uppercase tracking-wider">
              סיסמה / הערה
              <input
                value={form.accessNote}
                onChange={(event) => updateField('accessNote', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
              />
            </label>
          )}

          {mode === 'existing' && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Mux Asset ID
                <input
                  dir="ltr"
                  value={form.providerAssetId}
                  onChange={(event) => updateField('providerAssetId', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-left text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                />
              </label>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Playback ID
                <input
                  dir="ltr"
                  value={form.providerPlaybackId}
                  onChange={(event) => updateField('providerPlaybackId', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-left text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                />
              </label>
            </div>
          )}

          {mode === 'upload' && !activeUpload && (
            <div className="mt-4 rounded-xl border border-dashed border-primary/35 bg-primary-soft px-4 py-4">
              <div className="text-sm font-semibold text-primary">בחירת קובץ וידאו</div>
            </div>
          )}
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {mode === 'upload' ? 'המשך לבחירת קובץ' : 'הוסף הקלטה'}
          </button>
          {status && (
            <span className={`text-xs ${status.type === 'error' ? 'text-danger' : 'text-success'}`}>
              {status.text}
            </span>
          )}
        </div>
      </form>

      {activeUpload?.uploadUrl && (
        <div className="mt-5 rounded-2xl border border-primary/25 bg-primary-soft p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold text-text">בחר או גרור קובץ וידאו</div>
            <div className="mt-1 text-xs text-text-muted">{activeUpload.recording.title}</div>
            {activeUpload.uploadOrigin && activeUpload.uploadOrigin !== browserOrigin() && (
              <div className="mt-1 text-xs text-danger">
                מקור ההעלאה לא תואם לכתובת האתר הנוכחית.
              </div>
            )}
          </div>
          <div className="rounded-xl border border-dashed border-primary/35 bg-white p-4">
            <MuxUploader
              endpoint={activeUpload.uploadUrl}
              dynamicChunkSize
              pausable
              onUploadStart={() => setStatus(null)}
              onUploadError={handleUploadError}
              onSuccess={() => handleSync(activeUpload.recording.id)}
              style={{
                '--progress-bar-fill-color': '#4c57d4',
                '--progress-radial-fill-color': '#4c57d4',
                width: '100%',
              }}
            >
              <button
                slot="file-select"
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover cursor-pointer"
              >
                בחר קובץ וידאו
              </button>
            </MuxUploader>
          </div>
        </div>
      )}

      {recordings.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border-subtle">
          {recordings.map((recording) => {
            const isEditingCurrent = editingRecordingId === recording.id

            return (
              <div key={recording.id} className="border-b border-border-subtle bg-white px-4 py-3 last:border-b-0">
                {isEditingCurrent ? (
                  <form noValidate onSubmit={(event) => handleSaveEdit(event, recording)} className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        כותרת
                        <input
                          required
                          value={editForm.title}
                          onChange={(event) => updateEditField('title', event.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                        />
                      </label>
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        תאריך/תיאור קצר
                        <input
                          value={editForm.dateLabel}
                          onChange={(event) => updateEditField('dateLabel', event.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                        />
                      </label>
                    </div>
                    {(recording.provider === 'onedrive' || recording.provider === 'googledrive') && (
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        סיסמה / הערה
                        <input
                          value={editForm.accessNote}
                          onChange={(event) => updateEditField('accessNote', event.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                        />
                      </label>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="submit"
                        disabled={isEditing || !editForm.title.trim()}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        שמור
                      </button>
                      <button
                        type="button"
                        onClick={stopEditing}
                        disabled={isEditing}
                        className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-2 shadow-sm transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        ביטול
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text">{recording.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
                        {providerText(recording.provider) && <span>{providerText(recording.provider)}</span>}
                        <span>{statusText(recording.status)}</span>
                        {recording.dateLabel && <span>{recording.dateLabel}</span>}
                        {recording.duration && <span dir="ltr">{recording.duration}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(recording)}
                        className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-2 shadow-sm transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
                      >
                        ערוך
                      </button>
                      {recording.provider === 'mux' && (
                        <button
                          type="button"
                          onClick={() => handleSync(recording.id)}
                          className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-2 shadow-sm transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
                        >
                          רענן
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(recording)}
                        className="rounded-lg border border-danger/20 bg-white px-3 py-1.5 text-xs font-medium text-danger shadow-sm transition-colors hover:border-danger/30 hover:bg-danger/10 cursor-pointer"
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function RecordingsSection({ canEditContent = false, course, isAdminMode = false, student = null }) {
  const accent = getCourseTheme(course.color)
  const [recordings, setRecordings] = useState([])
  const [loadState, setLoadState] = useState({ loading: true, error: '' })
  const [activeRecording, setActiveRecording] = useState(null)
  const [playback, setPlayback] = useState(null)
  const [playbackState, setPlaybackState] = useState({ loading: false, error: '' })
  const [passwordGate, setPasswordGate] = useState({ required: false, unlocking: false, error: '' })
  const [recordingsPassword, setRecordingsPassword] = useState('')
  const [recordingsReloadToken, setRecordingsReloadToken] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadCourseRecordings() {
      setLoadState({ loading: true, error: '' })
      setPlayback(null)
      setActiveRecording(null)
      setPasswordGate({ required: false, unlocking: false, error: '' })

      try {
        const loadedRecordings = await listRecordings(course.id)
        if (!ignore) {
          setRecordings(sortRecordingsOldestFirst(loadedRecordings))
          setLoadState({ loading: false, error: '' })
        }
      } catch (error) {
        if (!ignore) {
          if (!isAdminMode && error.code === RECORDINGS_PASSWORD_REQUIRED_CODE) {
            setRecordings([])
            setLoadState({ loading: false, error: '' })
            setPasswordGate({ required: true, unlocking: false, error: '' })
            return
          }

          setRecordings([])
          setLoadState({ loading: false, error: error.message })
        }
      }
    }

    loadCourseRecordings()

    return () => {
      ignore = true
    }
  }, [course.id, isAdminMode, recordingsReloadToken])

  const activeRecordingId = activeRecording?.id ?? ''
  const viewer = useMemo(() => ({
    ...student,
    ...(playback?.viewer ?? {}),
  }), [playback, student])

  function upsertRecording(recording) {
    setRecordings((current) => {
      const exists = current.some((item) => item.id === recording.id)
      const nextRecordings = exists
        ? current.map((item) => (item.id === recording.id ? recording : item))
        : [...current, recording]

      return sortRecordingsOldestFirst(nextRecordings)
    })
    setActiveRecording((current) => (current?.id === recording.id ? recording : current))
  }

  function removeRecording(recordingId) {
    setRecordings((current) => current.filter((recording) => recording.id !== recordingId))
    if (activeRecordingId === recordingId) {
      setActiveRecording(null)
      setPlayback(null)
    }
  }

  async function handlePlay(recording) {
    setActiveRecording(recording)
    setPlayback(null)
    setPlaybackState({ loading: true, error: '' })

    try {
      const playbackData = await getRecordingPlayback(recording.id)
      setPlayback(playbackData)
      setPlaybackState({ loading: false, error: '' })
    } catch (error) {
      if (!isAdminMode && error.code === RECORDINGS_PASSWORD_REQUIRED_CODE) {
        setActiveRecording(null)
        setPlaybackState({ loading: false, error: '' })
        setPasswordGate({ required: true, unlocking: false, error: '' })
        return
      }

      setPlaybackState({ loading: false, error: error.message })
    }
  }

  async function handleUnlockRecordings(event) {
    event.preventDefault()

    const password = recordingsPassword.trim()
    if (!password) {
      setPasswordGate((current) => ({ ...current, error: 'יש להזין סיסמה' }))
      return
    }

    setPasswordGate((current) => ({ ...current, unlocking: true, error: '' }))

    try {
      await unlockRecordings({ courseId: course.id, password })
      setRecordingsPassword('')
      setPasswordGate({ required: false, unlocking: false, error: '' })
      setRecordingsReloadToken((current) => current + 1)
    } catch (error) {
      setPasswordGate((current) => ({
        ...current,
        unlocking: false,
        error: error.message || 'לא ניתן לפתוח את ההקלטות',
      }))
    }
  }

  return (
    <div>
      {isAdminMode && (
        <AdminRecordingPanel
          canEditContent={canEditContent}
          courseId={course.id}
          onCreated={upsertRecording}
          onDeleted={removeRecording}
          onSynced={upsertRecording}
          recordings={recordings}
        />
      )}

      {passwordGate.required && !isAdminMode && (
        <RecordingsPasswordGate
          error={passwordGate.error}
          isSubmitting={passwordGate.unlocking}
          onPasswordChange={setRecordingsPassword}
          onSubmit={handleUnlockRecordings}
          password={recordingsPassword}
        />
      )}

      {!passwordGate.required && activeRecording && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <div className="text-sm font-semibold text-text">{activeRecording.title}</div>
            {playbackState.error && (
              <div className="mt-1 text-xs text-danger">{playbackState.error}</div>
            )}
          </div>
          {playback?.player === 'external' ? (
            <div className="p-5">
              <div className="rounded-xl border border-border bg-inset p-4">
                <div className="text-sm font-semibold text-text">{externalPlaybackTitle(playback.provider)}</div>
                {playback.accessNote && (
                  <div className="mt-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-2">
                    {playback.accessNote}
                  </div>
                )}
                <div className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
                  הפצת ההקלטה מהווה עבירה פלילית
                </div>
                <a
                  href={playback.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
                >
                  פתח קישור
                </a>
              </div>
            </div>
          ) : (
            <div className="relative aspect-video bg-black">
              {playbackState.loading && (
                <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/70">
                  טוען נגן...
                </div>
              )}
              {playback?.player === 'mux' && (
                <>
                  <MuxPlayer
                    playbackId={playback.playbackId}
                    tokens={playback.tokens}
                    envKey={playback.envKey || muxEnvKey || undefined}
                    metadataVideoId={activeRecording.id}
                    metadataVideoTitle={activeRecording.title}
                    metadataViewerUserId={viewer.phone || viewer.name || undefined}
                    streamType="on-demand"
                    accentColor={accent.accent}
                    style={{
                      display: 'block',
                      height: '100%',
                      width: '100%',
                      '--media-object-fit': 'contain',
                    }}
                  />
                  <RecordingWatermark student={viewer} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {loadState.error && !isAdminMode && recordings.length === 0 && !passwordGate.required && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {loadState.error}
        </div>
      )}

      {passwordGate.required && !isAdminMode ? null : loadState.loading ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm font-semibold text-text-muted shadow-sm">
          טוען הקלטות...
        </div>
      ) : recordings.length === 0 ? (
        <EmptyState />
      ) : (
        <div dir="rtl" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recordings.map((recording, index) => (
            <RecordingCard
              key={recording.id}
              accent={accent}
              index={index}
              isActive={recording.id === activeRecordingId}
              onPlay={() => handlePlay(recording)}
              recording={recording}
            />
          ))}
        </div>
      )}
    </div>
  )
}
