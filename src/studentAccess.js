const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function readJsonResponse(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(data.error || `Request failed with ${response.status}`)
    error.status = response.status
    error.code = data.code || ''
    throw error
  }

  return response.json()
}

async function fetchJson(path, options = {}) {
  return readJsonResponse(await fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
  }))
}

export async function loadAppConfig() {
  return fetchJson('/api/config')
}

export async function loadCourses() {
  try {
    const data = await fetchJson('/api/courses')
    return data.courses ?? []
  } catch (error) {
    if (!import.meta.env.DEV) throw error

    const localData = await import('./data')
    return localData.courses ?? []
  }
}

export async function loginWithCourseChoice(courseId) {
  return fetchJson('/api/student-auth/course-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId }),
  })
}

export async function logoutStudent() {
  const response = await fetch(apiUrl('/api/student-auth/logout'), {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok && response.status !== 204) {
    throw new Error(`Request failed with ${response.status}`)
  }
}

export async function listStudents() {
  const data = await fetchJson('/api/students')
  return data.students ?? []
}

export async function createStudent({ phone, name, courseIds, password }) {
  return fetchJson('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name, courseIds, password }),
  })
}

export async function updateStudent(studentId, updates) {
  return fetchJson(`/api/students/${encodeURIComponent(studentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
}

export async function resetStudentPassword(studentId, password = '') {
  return fetchJson(`/api/students/${encodeURIComponent(studentId)}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

export async function revokeStudentSessions(studentId) {
  return fetchJson(`/api/students/${encodeURIComponent(studentId)}/sessions/revoke`, {
    method: 'POST',
  })
}

export async function resetStudentDeviceLock(studentId) {
  return fetchJson(`/api/students/${encodeURIComponent(studentId)}/device-lock/reset`, {
    method: 'POST',
  })
}

export async function listRecordings(courseId) {
  const params = new URLSearchParams({ courseId: String(courseId) })
  const data = await fetchJson(`/api/recordings?${params.toString()}`)
  return data.recordings ?? []
}

export async function createRecordingDirectUpload({ courseId, title, dateLabel }) {
  return fetchJson('/api/recordings/direct-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, title, dateLabel }),
  })
}

export async function createRecording(recording) {
  return fetchJson('/api/recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recording),
  })
}

export async function updateRecording(recordingId, updates) {
  return fetchJson(`/api/recordings/${encodeURIComponent(recordingId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
}

export async function syncRecording(recordingId) {
  return fetchJson(`/api/recordings/${encodeURIComponent(recordingId)}/sync`, {
    method: 'POST',
  })
}

export async function deleteRecording(recordingId) {
  const response = await fetch(apiUrl(`/api/recordings/${encodeURIComponent(recordingId)}`), {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok && response.status !== 204) {
    throw new Error(`Request failed with ${response.status}`)
  }
}

export async function getRecordingPlayback(recordingId) {
  return fetchJson(`/api/recordings/${encodeURIComponent(recordingId)}/playback`)
}
