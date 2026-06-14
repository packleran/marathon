const STORAGE_KEY = 'marathon-content-overrides'

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
  return courses.map((course) => {
    const courseOverride = overrides[course.id] ?? {}
    const meetingOverrides = courseOverride.meetings ?? {}

    return {
      ...course,
      ...(courseOverride.course ?? {}),
      meetings: course.meetings.map((meeting) => ({
        ...meeting,
        ...(meetingOverrides[meeting.id] ?? {}),
      })),
    }
  })
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
