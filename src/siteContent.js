const STORAGE_KEY = 'marathon-content-overrides'

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function cloneContent(value) {
  return JSON.parse(JSON.stringify(value))
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

export function applyContentOverrides(courses, overrides) {
  const customCourses = Array.isArray(overrides.customCourses) ? overrides.customCourses : []

  return [...courses, ...customCourses].map((course) => {
    const courseOverride = overrides[course.id] ?? {}
    const meetingOverrides = courseOverride.meetings ?? {}
    const deletedMeetingIds = new Set((courseOverride.deletedMeetingIds ?? []).map(String))

    return {
      ...course,
      ...(courseOverride.course ?? {}),
      meetings: course.meetings
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
  }
}

export function addCustomCourseOverride(overrides, course) {
  const customCourses = Array.isArray(overrides.customCourses) ? overrides.customCourses : []

  return {
    ...overrides,
    customCourses: [...customCourses, course],
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
  deletedMeetingIds.add(String(meetingId))

  const meetings = { ...(currentCourse.meetings ?? {}) }
  delete meetings[meetingId]

  return {
    ...overrides,
    [courseId]: {
      ...currentCourse,
      meetings,
      deletedMeetingIds: [...deletedMeetingIds],
    },
  }
}
