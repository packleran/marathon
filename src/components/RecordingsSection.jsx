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
} from '../studentAccess'

const muxEnvKey = import.meta.env.VITE_MUX_ENV_KEY ?? ''

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
    providerAssetId: '',
    providerPlaybackId: '',
  })
  const [activeUpload, setActiveUpload] = useState(null)
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

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
        setActiveUpload({ recording: data.recording, uploadUrl: data.uploadUrl })
        onCreated(data.recording)
        setStatus({ type: 'success', text: 'נוצרה העלאה ישירה ל-Mux' })
      } else {
        const data = await createRecording({
          courseId,
          title: form.title,
          dateLabel: form.dateLabel,
          sourceUrl: mode === 'url' ? form.sourceUrl : '',
          providerAssetId: mode === 'existing' ? form.providerAssetId : '',
          providerPlaybackId: mode === 'existing' ? form.providerPlaybackId : '',
        })
        onCreated(data.recording)
        setStatus({ type: 'success', text: 'ההקלטה נוספה' })
      }

      setForm({
        title: '',
        dateLabel: '',
        sourceUrl: '',
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

  return (
    <div className="mb-6 rounded-2xl border border-border-subtle bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text">העלאת הקלטה ל-Mux</h2>
        </div>
        <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-inset p-1">
          {[
            { key: 'upload', label: 'מהמחשב' },
            { key: 'url', label: 'ייבוא URL' },
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

          {mode === 'url' && (
            <label className="mt-3 block text-xs font-semibold text-text-muted uppercase tracking-wider">
              URL נגיש ל-Mux
              <input
                dir="ltr"
                type="url"
                value={form.sourceUrl}
                onChange={(event) => updateField('sourceUrl', event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-left text-sm font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
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
            disabled={!canEditContent || isSubmitting || !form.title.trim()}
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
          </div>
          <div className="rounded-xl border border-dashed border-primary/35 bg-white p-4">
            <MuxUploader
              endpoint={activeUpload.uploadUrl}
              dynamicChunkSize
              pausable
              onSuccess={() => handleSync(activeUpload.recording.id)}
              style={{
                '--progress-bar-fill-color': '#4c57d4',
                '--progress-radial-fill-color': '#4c57d4',
                width: '100%',
              }}
            />
          </div>
        </div>
      )}

      {recordings.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border-subtle">
          {recordings.map((recording) => (
            <div key={recording.id} className="flex flex-col gap-3 border-b border-border-subtle bg-white px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text">{recording.title}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
                  <span>{statusText(recording.status)}</span>
                  {recording.dateLabel && <span>{recording.dateLabel}</span>}
                  {recording.duration && <span dir="ltr">{recording.duration}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSync(recording.id)}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-2 shadow-sm transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
                >
                  רענן
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(recording)}
                  className="rounded-lg border border-danger/20 bg-white px-3 py-1.5 text-xs font-medium text-danger shadow-sm transition-colors hover:border-danger/30 hover:bg-danger/10 cursor-pointer"
                >
                  מחק
                </button>
              </div>
            </div>
          ))}
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

  useEffect(() => {
    let ignore = false

    async function loadCourseRecordings() {
      setLoadState({ loading: true, error: '' })
      setPlayback(null)
      setActiveRecording(null)

      try {
        const loadedRecordings = await listRecordings(course.id)
        if (!ignore) {
          setRecordings(loadedRecordings)
          setLoadState({ loading: false, error: '' })
        }
      } catch (error) {
        if (!ignore) {
          setRecordings([])
          setLoadState({ loading: false, error: error.message })
        }
      }
    }

    loadCourseRecordings()

    return () => {
      ignore = true
    }
  }, [course.id])

  const activeRecordingId = activeRecording?.id ?? ''
  const viewer = useMemo(() => ({
    ...student,
    ...(playback?.viewer ?? {}),
  }), [playback, student])

  function upsertRecording(recording) {
    setRecordings((current) => {
      const exists = current.some((item) => item.id === recording.id)
      return exists
        ? current.map((item) => (item.id === recording.id ? recording : item))
        : [recording, ...current]
    })
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
      setPlaybackState({ loading: false, error: error.message })
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

      {activeRecording && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-[#11131f] shadow-sm">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-semibold text-white">{activeRecording.title}</div>
            {playbackState.error && (
              <div className="mt-1 text-xs text-red-200">{playbackState.error}</div>
            )}
          </div>
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
        </div>
      )}

      {loadState.error && !isAdminMode && recordings.length === 0 && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {loadState.error}
        </div>
      )}

      {loadState.loading ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm font-semibold text-text-muted shadow-sm">
          טוען הקלטות...
        </div>
      ) : recordings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
