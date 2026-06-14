import { useEffect, useRef, useState } from 'react'
import {
  deleteMeetingRequest,
  deleteUploadedMaterial,
  getDeletedMaterialIds,
  getMeetingRequests,
  getUploadedMaterials,
  saveDeletedMaterial,
  saveMeetingRequest,
  saveUploadedMaterial,
} from '../uploadedMaterials'

const detailTabs = [
  { key: 'overview', label: 'סקירה', icon: 'M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5' },
  { key: 'materials', label: 'חומרים', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { key: 'requests', label: 'תיבת בקשות', icon: 'M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
]

const acceptedMaterialTypes = [
  '.pdf',
  '.ppt',
  '.pptx',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.zip',
  '.png',
  '.jpg',
  '.jpeg',
  '.txt',
].join(',')

const acceptedQuestionTypes = [
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
].join(',')

const materialSections = {
  presentations: {
    title: 'מצגות',
    uploadLabel: 'מצגת',
    emptyText: 'אין עדיין מצגות במפגש הזה',
    iconClassName: 'bg-orange-100 text-orange-500',
  },
  exercises: {
    title: 'תרגילים ודפי עבודה',
    uploadLabel: 'חומר',
    emptyText: 'אין עדיין תרגילים או דפי עבודה במפגש הזה',
    iconClassName: 'bg-rose-100 text-rose-500',
  },
}

const emptyUploadedMaterials = {
  presentations: [],
  exercises: [],
}

function storedMaterialId(category, item) {
  return `${category}:${item.url}`
}

function groupUploadedMaterials(materials) {
  return materials.reduce((groups, material) => {
    if (!groups[material.category]) return groups
    groups[material.category].push(material)
    return groups
  }, { presentations: [], exercises: [] })
}

function formatBytes(bytes) {
  if (!bytes) return ''

  const units = ['B', 'KB', 'MB', 'GB']
  const sizeIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** sizeIndex

  return `${size.toFixed(size >= 10 || sizeIndex === 0 ? 0 : 1)} ${units[sizeIndex]}`
}

function normalizeTopics(topicsText) {
  return topicsText
    .split('\n')
    .map((topic) => topic.trim())
    .filter(Boolean)
}

function MeetingEditor({ meeting, onSave }) {
  const [form, setForm] = useState({
    title: meeting.title,
    description: meeting.description,
    date: meeting.date,
    dateDisplay: meeting.dateDisplay,
    day: meeting.day,
    time: meeting.time,
    location: meeting.location,
    type: meeting.type,
    topics: meeting.topics.join('\n'),
  })
  const [status, setStatus] = useState(null)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
      dateDisplay: form.dateDisplay.trim(),
      day: form.day.trim(),
      time: form.time.trim(),
      location: form.location.trim(),
      type: form.type,
      topics: normalizeTopics(form.topics),
    })
    setStatus('פרטי המפגש נשמרו')
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <h4 className="mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">עריכת פרטי מפגש</h4>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          כותרת
          <input
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          סוג מפגש
          <select
            value={form.type}
            onChange={(event) => updateField('type', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          >
            <option value="in-person">פרונטלי</option>
            <option value="zoom">זום</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          תאריך מערכת
          <input
            type="date"
            value={form.date}
            onChange={(event) => updateField('date', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          תאריך לתצוגה
          <input
            value={form.dateDisplay}
            onChange={(event) => updateField('dateDisplay', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          יום
          <input
            value={form.day}
            onChange={(event) => updateField('day', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          שעה
          <input
            value={form.time}
            onChange={(event) => updateField('time', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider md:col-span-2">
          מיקום / קישור
          <input
            value={form.location}
            onChange={(event) => updateField('location', event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider md:col-span-2">
          תיאור
          <textarea
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal leading-relaxed text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider md:col-span-2">
          נושאים
          <textarea
            value={form.topics}
            onChange={(event) => updateField('topics', event.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal leading-relaxed text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-200 transition-colors hover:bg-sky-700 cursor-pointer">
          שמור פרטי מפגש
        </button>
        {status && <span className="text-xs text-emerald-600">{status}</span>}
      </div>
    </form>
  )
}

function OverviewTab({ meeting, onUpdateMeeting }) {
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
      {onUpdateMeeting && (
        <MeetingEditor key={meeting.id} meeting={meeting} onSave={onUpdateMeeting} />
      )}
    </div>
  )
}

function FileIcon({ className }) {
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${className}`}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H6.75A2.25 2.25 0 004.5 4.5v15A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25v-4.5z" />
      </svg>
    </div>
  )
}

function UploadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V3.75m0 0L7.5 8.25M12 3.75l4.5 4.5M4.5 20.25h15" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 5.79L17.22 19.67A2.25 2.25 0 0114.977 21H9.023a2.25 2.25 0 01-2.243-2.33L5.84 5.79m12.32 0a48.108 48.108 0 00-3.478-.397m-12.56.563c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.16 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

function MaterialItem({ item, iconClassName, onDelete }) {
  return (
    <div className="group flex items-center gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all">
      <FileIcon className={iconClassName} />
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1"
      >
        <span className="block truncate text-sm font-medium text-slate-700 group-hover:text-sky-700 transition-colors">
          {item.title}
        </span>
        {item.uploaded && (
          <span className="mt-1 block text-xs text-slate-400">
            {formatBytes(item.size)}
          </span>
        )}
      </a>
      <button
        type="button"
        onClick={() => onDelete(item)}
        aria-label={`מחק ${item.title}`}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
      >
        <TrashIcon />
      </button>
    </div>
  )
}

function MaterialSection({
  category,
  items,
  onDelete,
  onUpload,
  savingCategory,
}) {
  const meta = materialSections[category]

  return (
    <div>
      <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{meta.title}</h4>
        <label className={`inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-600 cursor-pointer ${
          savingCategory === category ? 'pointer-events-none opacity-60' : ''
        }`}>
          <input
            type="file"
            multiple
            accept={acceptedMaterialTypes}
            className="sr-only"
            onChange={(event) => onUpload(category, event)}
          />
          <UploadIcon />
          {savingCategory === category ? 'שומר...' : `העלה ${meta.uploadLabel}`}
        </label>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <MaterialItem
              key={item.id ?? item.url}
              item={item}
              iconClassName={meta.iconClassName}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-sm text-slate-400">
          {meta.emptyText}
        </div>
      )}
    </div>
  )
}

function MaterialsTab({ courseId, meeting }) {
  const { presentations, exercises } = meeting.materials
  const [uploadedMaterials, setUploadedMaterials] = useState(emptyUploadedMaterials)
  const [deletedMaterialIds, setDeletedMaterialIds] = useState([])
  const [loadingUploads, setLoadingUploads] = useState(true)
  const [savingCategory, setSavingCategory] = useState(null)
  const [status, setStatus] = useState(null)
  const objectUrlsRef = useRef(new Set())

  useEffect(() => {
    let ignore = false
    const objectUrls = objectUrlsRef.current

    async function loadMaterials() {
      setLoadingUploads(true)

      try {
        const [records, deletedIds] = await Promise.all([
          getUploadedMaterials({ courseId, meetingId: meeting.id }),
          getDeletedMaterialIds({ courseId, meetingId: meeting.id }),
        ])

        if (ignore) return

        const materials = records.map((record) => {
          const url = URL.createObjectURL(record.blob)
          objectUrls.add(url)

          return { ...record, url, uploaded: true }
        })

        setUploadedMaterials(groupUploadedMaterials(materials))
        setDeletedMaterialIds(deletedIds)
      } catch {
        if (!ignore) {
          setStatus({ type: 'error', text: 'שמירת קבצים לא זמינה בדפדפן הזה' })
        }
      } finally {
        if (!ignore) {
          setLoadingUploads(false)
        }
      }
    }

    loadMaterials()

    return () => {
      ignore = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.clear()
    }
  }, [courseId, meeting.id])

  async function handleUpload(category, event) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    setSavingCategory(category)
    setStatus(null)

    try {
      const savedMaterials = []

      for (const file of files) {
        const record = await saveUploadedMaterial({
          courseId,
          meetingId: meeting.id,
          category,
          file,
        })
        const url = URL.createObjectURL(record.blob)
        objectUrlsRef.current.add(url)
        savedMaterials.push({ ...record, url, uploaded: true })
      }

      setUploadedMaterials((current) => ({
        ...current,
        [category]: [...current[category], ...savedMaterials],
      }))
      setStatus({
        type: 'success',
        text: files.length === 1 ? 'הקובץ נשמר בחומרים' : `${files.length} קבצים נשמרו בחומרים`,
      })
    } catch {
      setStatus({ type: 'error', text: 'לא הצלחתי לשמור את הקובץ' })
    } finally {
      event.target.value = ''
      setSavingCategory(null)
    }
  }

  async function handleDelete(item) {
    setStatus(null)

    try {
      if (item.uploaded) {
        await deleteUploadedMaterial(item.id)
        URL.revokeObjectURL(item.url)
        objectUrlsRef.current.delete(item.url)
        setUploadedMaterials((current) => ({
          ...current,
          [item.category]: current[item.category].filter((material) => material.id !== item.id),
        }))
      } else {
        await saveDeletedMaterial({
          courseId,
          meetingId: meeting.id,
          category: item.category,
          materialId: item.id,
        })
        setDeletedMaterialIds((current) => [...current, item.id])
      }

      setStatus({ type: 'success', text: 'הקובץ הוסר מהחומרים' })
    } catch {
      setStatus({ type: 'error', text: 'לא הצלחתי למחוק את הקובץ' })
    }
  }

  const sectionItems = {
    presentations: [
      ...presentations
        .map((item) => ({ ...item, id: storedMaterialId('presentations', item), category: 'presentations', uploaded: false }))
        .filter((item) => !deletedMaterialIds.includes(item.id)),
      ...uploadedMaterials.presentations,
    ],
    exercises: [
      ...exercises
        .map((item) => ({ ...item, id: storedMaterialId('exercises', item), category: 'exercises', uploaded: false }))
        .filter((item) => !deletedMaterialIds.includes(item.id)),
      ...uploadedMaterials.exercises,
    ],
  }

  return (
    <div className="space-y-5">
      <MaterialSection
        category="presentations"
        items={sectionItems.presentations}
        onDelete={handleDelete}
        onUpload={handleUpload}
        savingCategory={savingCategory}
      />
      <MaterialSection
        category="exercises"
        items={sectionItems.exercises}
        onDelete={handleDelete}
        onUpload={handleUpload}
        savingCategory={savingCategory}
      />
      {loadingUploads && (
        <p className="text-xs text-slate-400">טוען חומרים שמורים...</p>
      )}
      {status && (
        <p className={`rounded-lg px-3 py-2 text-xs ${
          status.type === 'error'
            ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
        }`}>
          {status.text}
        </p>
      )}
    </div>
  )
}

function formatRequestDate(value) {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function RequestsTab({ courseId, meeting }) {
  const [requests, setRequests] = useState([])
  const [requestText, setRequestText] = useState('')
  const [requestFile, setRequestFile] = useState(null)
  const [reviewInClass, setReviewInClass] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [savingRequest, setSavingRequest] = useState(false)
  const [status, setStatus] = useState(null)
  const objectUrlsRef = useRef(new Set())
  const fileInputRef = useRef(null)

  useEffect(() => {
    let ignore = false
    const objectUrls = objectUrlsRef.current

    async function loadRequests() {
      setLoadingRequests(true)

      try {
        const records = await getMeetingRequests({ courseId, meetingId: meeting.id })

        if (!ignore) {
          setRequests(records.map((record) => {
            if (!record.blob) return record

            const fileUrl = URL.createObjectURL(record.blob)
            objectUrls.add(fileUrl)

            return { ...record, fileUrl }
          }))
        }
      } catch {
        if (!ignore) {
          setStatus({ type: 'error', text: 'שמירת בקשות לא זמינה בדפדפן הזה' })
        }
      } finally {
        if (!ignore) {
          setLoadingRequests(false)
        }
      }
    }

    loadRequests()

    return () => {
      ignore = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.clear()
    }
  }, [courseId, meeting.id])

  async function handleSubmit(event) {
    event.preventDefault()

    const text = requestText.trim()
    if (!text && !requestFile) {
      setStatus({ type: 'error', text: 'צריך לכתוב שאלה או להעלות קובץ' })
      return
    }

    setSavingRequest(true)
    setStatus(null)

    try {
      const record = await saveMeetingRequest({
        courseId,
        meetingId: meeting.id,
        text,
        reviewInClass,
        file: requestFile,
      })
      const savedRecord = requestFile
        ? { ...record, fileUrl: URL.createObjectURL(record.blob) }
        : record

      if (savedRecord.fileUrl) {
        objectUrlsRef.current.add(savedRecord.fileUrl)
      }

      setRequests((current) => [savedRecord, ...current])
      setRequestText('')
      setRequestFile(null)
      setReviewInClass(true)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setStatus({ type: 'success', text: 'הבקשה נשמרה בתיבה' })
    } catch {
      setStatus({ type: 'error', text: 'לא הצלחתי לשמור את הבקשה' })
    } finally {
      setSavingRequest(false)
    }
  }

  async function handleDeleteRequest(request) {
    setStatus(null)

    try {
      await deleteMeetingRequest(request.id)
      if (request.fileUrl) {
        URL.revokeObjectURL(request.fileUrl)
        objectUrlsRef.current.delete(request.fileUrl)
      }
      setRequests((current) => current.filter((item) => item.id !== request.id))
      setStatus({ type: 'success', text: 'הבקשה הוסרה מהתיבה' })
    } catch {
      setStatus({ type: 'error', text: 'לא הצלחתי למחוק את הבקשה' })
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <label htmlFor={`request-${meeting.id}`} className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">
          שאלה למפגש
        </label>
        <textarea
          id={`request-${meeting.id}`}
          value={requestText}
          onChange={(event) => setRequestText(event.target.value)}
          rows={4}
          className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="כתבו כאן את השאלה"
        />
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">קובץ שאלה ממבחן</p>
              {requestFile && (
                <p className="mt-1 text-sm text-slate-600">
                  {requestFile.name} · {formatBytes(requestFile.size)}
                </p>
              )}
            </div>
            <label className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-600 cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedQuestionTypes}
                className="sr-only"
                onChange={(event) => setRequestFile(event.target.files?.[0] ?? null)}
              />
              <UploadIcon />
              העלה שאלה
            </label>
          </div>
          {requestFile && (
            <button
              type="button"
              onClick={() => {
                setRequestFile(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className="mt-3 text-xs font-medium text-rose-500 hover:text-rose-600 cursor-pointer"
            >
              הסר קובץ
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={reviewInClass}
              onChange={(event) => setReviewInClass(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
            />
            לעבור עליה בכיתה
          </label>
          <button
            type="submit"
            disabled={savingRequest}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-200 transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {savingRequest ? 'שומר...' : 'שלח בקשה'}
          </button>
        </div>
      </form>

      <div>
        <h4 className="mb-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">בקשות שנשלחו</h4>
        {loadingRequests ? (
          <p className="text-xs text-slate-400">טוען בקשות שמורות...</p>
        ) : requests.length > 0 ? (
          <div className="space-y-2.5">
            {requests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {request.text && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{request.text}</p>
                    )}
                    {request.fileUrl && (
                      <a
                        href={request.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                      >
                        <FileIcon className="bg-sky-100 text-sky-600" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-700">{request.fileName}</span>
                          <span className="mt-1 block text-xs text-slate-400">{formatBytes(request.fileSize)}</span>
                        </span>
                      </a>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {request.reviewInClass && (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-100">
                          לעבור בכיתה
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">{formatRequestDate(request.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRequest(request)}
                    aria-label="מחק בקשה"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-sm text-slate-400">
            עוד אין בקשות למפגש הזה
          </div>
        )}
      </div>

      {status && (
        <p className={`rounded-lg px-3 py-2 text-xs ${
          status.type === 'error'
            ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
        }`}>
          {status.text}
        </p>
      )}
    </div>
  )
}

export default function MeetingDetail({ courseId, meeting, onUpdateMeeting }) {
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

        {activeTab === 'overview' && <OverviewTab meeting={meeting} onUpdateMeeting={onUpdateMeeting} />}
        {activeTab === 'materials' && <MaterialsTab courseId={courseId} meeting={meeting} />}
        {activeTab === 'requests' && <RequestsTab courseId={courseId} meeting={meeting} />}
      </div>
    </div>
  )
}
