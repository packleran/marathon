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
  const deletedCourseIds = new Set((overrides.deletedCourseIds ?? []).map(String))

  return [...courses, ...customCourses].filter((course) => !deletedCourseIds.has(String(course.id))).map((course) => {
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
