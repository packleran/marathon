const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function readJsonResponse(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Request failed with ${response.status}`)
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

export async function createStudent({ phone, name, password }) {
  return fetchJson('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name, password }),
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
