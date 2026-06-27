const STORAGE_KEY = 'marathon-content-overrides'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const CONTENT_BACKEND = import.meta.env.VITE_CONTENT_BACKEND ?? 'api'
const CONTENT_POLL_MS = Number(import.meta.env.VITE_CONTENT_POLL_MS ?? 10000)

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function cloneContent(value) {
  return JSON.parse(JSON.stringify(value))
}

function hasOwnKeys(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0)
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0
}

function readStorage() {
  if (typeof localStorage === 'undefined') return {}

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function loadContentOverrides() {
  return readStorage()
}

export function persistContentOverrides(overrides) {
  if (typeof localStorage === 'undefined') return

  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export function hasContentOverrides(overrides) {
  if (!hasOwnKeys(overrides)) return false

  return Object.entries(overrides).some(([key, value]) => {
    if (key === 'customCourses' || key === 'deletedCourseIds') {
      return hasItems(value)
    }

    if (!value || typeof value !== 'object') return false

    return (
      hasOwnKeys(value.course) ||
      hasOwnKeys(value.meetings) ||
      hasItems(value.customMeetings) ||
      hasItems(value.deletedMeetingIds)
    )
  })
}

export function mergeLocalContentIntoRemote(remoteOverrides, localOverrides) {
  if (!hasContentOverrides(localOverrides)) return remoteOverrides ?? {}
  if (!hasContentOverrides(remoteOverrides)) return cloneContent(localOverrides)

  const next = cloneContent(remoteOverrides)
  const remoteCustomCourses = Array.isArray(next.customCourses) ? next.customCourses : []
  const remoteCustomCourseIds = new Set(remoteCustomCourses.map((course) => String(course.id)))
  const remoteDeletedCourseIds = new Set((next.deletedCourseIds ?? []).map(String))
  const localCustomCourses = Array.isArray(localOverrides.customCourses) ? localOverrides.customCourses : []
  let changed = false

  localCustomCourses.forEach((course) => {
    const courseId = String(course.id)
    if (remoteCustomCourseIds.has(courseId) || remoteDeletedCourseIds.has(courseId)) return

    remoteCustomCourses.push(cloneContent(course))
    remoteCustomCourseIds.add(courseId)
    changed = true

    if (localOverrides[course.id] && !next[course.id]) {
      next[course.id] = cloneContent(localOverrides[course.id])
    }
  })

  Object.entries(localOverrides).forEach(([courseId, courseOverride]) => {
    if (courseId === 'customCourses' || courseId === 'deletedCourseIds') return
    if (next[courseId] || !hasContentOverrides({ [courseId]: courseOverride })) return

    next[courseId] = cloneContent(courseOverride)
    changed = true
  })

  if (changed) {
    next.customCourses = remoteCustomCourses
  }

  return changed ? next : remoteOverrides
}

function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

function shouldUseRemoteContent() {
  return CONTENT_BACKEND !== 'local'
}

async function readJsonResponse(response) {
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }

  return response.json()
}

export async function loadRemoteContentOverrides({ signal } = {}) {
  if (!shouldUseRemoteContent()) return null

  const data = await readJsonResponse(await fetch(apiUrl('/api/content'), {
    credentials: 'include',
    signal,
  }))

  return data.overrides ?? {}
}

export async function persistRemoteContentOverrides(overrides) {
  if (!shouldUseRemoteContent()) return null

  return readJsonResponse(await fetch(apiUrl('/api/content'), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overrides }),
  }))
}

export function subscribeToRemoteContentChanges(onChange) {
  if (!shouldUseRemoteContent() || typeof EventSource === 'undefined') {
    return () => {}
  }

  const events = new EventSource(apiUrl('/api/content/events'), { withCredentials: true })
  events.onmessage = () => onChange()
  events.onerror = () => {}

  return () => events.close()
}

export function createContentPolling(onChange) {
  if (!shouldUseRemoteContent() || !CONTENT_POLL_MS) {
    return () => {}
  }

  const interval = window.setInterval(onChange, CONTENT_POLL_MS)
  return () => window.clearInterval(interval)
}

export function applyContentOverrides(courses, overrides) {
  const customCourses = Array.isArray(overrides.customCourses) ? overrides.customCourses : []
  const deletedCourseIds = new Set((overrides.deletedCourseIds ?? []).map(String))
  const baseCourseIds = new Set(courses.map((course) => String(course.id)))
  const newCustomCourses = customCourses.filter((course) => !baseCourseIds.has(String(course.id)))

  return [...courses, ...newCustomCourses].filter((course) => !deletedCourseIds.has(String(course.id))).map((course) => {
    const courseOverride = overrides[course.id] ?? {}
    const meetingOverrides = courseOverride.meetings ?? {}
    const customMeetings = Array.isArray(courseOverride.customMeetings) ? courseOverride.customMeetings : []
    const deletedMeetingIds = new Set((courseOverride.deletedMeetingIds ?? []).map(String))

    return {
      ...course,
      ...(courseOverride.course ?? {}),
      meetings: [...course.meetings, ...customMeetings]
        .filter((meeting) => !deletedMeetingIds.has(String(meeting.id)))
        .map((meeting) => ({
          ...meeting,
          ...(meetingOverrides[meeting.id] ?? {}),
        })),
    }
  })
}

export function createDuplicatedCourse(course) {
  return {
    ...cloneContent(course),
    id: `${course.id}-group-${createId()}`,
    sourceCourseId: course.sourceCourseId ?? course.id,
    name: `${course.name} - קבוצה נוספת`,
    locked: false,
    approvedPhones: [],
  }
}

export function createBlankMeeting(course) {
  const fallbackDate = new Date().toISOString().slice(0, 10)
  const lastMeeting = course.meetings[course.meetings.length - 1]
  const nextMeetingNumber = course.meetings.length + 1

  return {
    id: `meeting-${createId()}`,
    dateDisplay: 'תאריך חדש',
    day: 'יום',
    time: '18:00–21:00',
    date: lastMeeting?.date ?? fallbackDate,
    location: '',
    type: 'in-person',
    title: `מפגש ${nextMeetingNumber}`,
    description: '',
    topics: [],
    materials: {
      presentations: [],
      exercises: [],
      questions: [],
    },
  }
}

export function createDuplicatedMeeting(meeting) {
  return {
    ...cloneContent(meeting),
    id: `meeting-${createId()}`,
    title: `${meeting.title} - עותק`,
  }
}

export function addCustomCourseOverride(overrides, course) {
  const customCourses = Array.isArray(overrides.customCourses) ? overrides.customCourses : []

  return {
    ...overrides,
    customCourses: [...customCourses, course],
  }
}

export function deleteCourseOverride(overrides, courseId) {
  const rest = { ...overrides }
  delete rest[courseId]

  const customCourses = Array.isArray(rest.customCourses) ? rest.customCourses : []
  const deletedCourseIds = new Set((rest.deletedCourseIds ?? []).map(String))

  deletedCourseIds.add(String(courseId))

  return {
    ...rest,
    customCourses: customCourses.filter((course) => String(course.id) !== String(courseId)),
    deletedCourseIds: [...deletedCourseIds],
  }
}

export function updateCourseOverride(overrides, courseId, updates) {
  const currentCourse = overrides[courseId] ?? {}

  return {
    ...overrides,
    [courseId]: {
      ...currentCourse,
      course: {
        ...(currentCourse.course ?? {}),
        ...updates,
      },
    },
  }
}

export function setCourseLockedOverride(overrides, courseId, locked) {
  return updateCourseOverride(overrides, courseId, { locked })
}

export function addMeetingOverride(overrides, courseId, meeting) {
  const currentCourse = overrides[courseId] ?? {}
  const customMeetings = Array.isArray(currentCourse.customMeetings) ? currentCourse.customMeetings : []

  return {
    ...overrides,
    [courseId]: {
      ...currentCourse,
      customMeetings: [...customMeetings, meeting],
    },
  }
}

export function updateMeetingOverride(overrides, courseId, meetingId, updates) {
  const currentCourse = overrides[courseId] ?? {}

  return {
    ...overrides,
    [courseId]: {
      ...currentCourse,
      meetings: {
        ...(currentCourse.meetings ?? {}),
        [meetingId]: {
          ...(currentCourse.meetings?.[meetingId] ?? {}),
          ...updates,
        },
      },
    },
  }
}

export function deleteMeetingOverride(overrides, courseId, meetingId) {
  const currentCourse = overrides[courseId] ?? {}
  const deletedMeetingIds = new Set((currentCourse.deletedMeetingIds ?? []).map(String))
  const customMeetings = Array.isArray(currentCourse.customMeetings) ? currentCourse.customMeetings : []
  deletedMeetingIds.add(String(meetingId))

  const meetings = { ...(currentCourse.meetings ?? {}) }
  delete meetings[meetingId]

  return {
    ...overrides,
    [courseId]: {
      ...currentCourse,
      meetings,
      customMeetings: customMeetings.filter((meeting) => String(meeting.id) !== String(meetingId)),
      deletedMeetingIds: [...deletedMeetingIds],
    },
  }
}
