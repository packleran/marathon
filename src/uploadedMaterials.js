const DB_NAME = 'marathon-uploaded-materials'
const DB_VERSION = 3
const STORE_NAME = 'materials'
const DELETED_STORE_NAME = 'deletedMaterials'
const REQUESTS_STORE_NAME = 'meetingRequests'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const CONTENT_BACKEND = import.meta.env.VITE_CONTENT_BACKEND ?? 'api'

function shouldUseServerApi() {
  return CONTENT_BACKEND !== 'local'
}

function canUseBrowserFallback() {
  return !import.meta.env.PROD
}

function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function readJsonResponse(response) {
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }

  return response.json()
}

async function fetchApiJson(path, options = {}) {
  return readJsonResponse(await fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
  }))
}

async function fetchApiEmpty(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }
}

function shouldFallback(error) {
  if (!canUseBrowserFallback()) throw error
  return true
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function meetingKey(courseId, meetingId) {
  return `${courseId}:${meetingId}`
}

function deletedMaterialKey({ courseId, meetingId, category, materialId }) {
  return `${meetingKey(courseId, meetingId)}:${category}:${materialId}`
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('meetingKey', 'meetingKey', { unique: false })
      }

      if (!db.objectStoreNames.contains(DELETED_STORE_NAME)) {
        const store = db.createObjectStore(DELETED_STORE_NAME, { keyPath: 'id' })
        store.createIndex('meetingKey', 'meetingKey', { unique: false })
      }

      if (!db.objectStoreNames.contains(REQUESTS_STORE_NAME)) {
        const store = db.createObjectStore(REQUESTS_STORE_NAME, { keyPath: 'id' })
        store.createIndex('meetingKey', 'meetingKey', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getUploadedMaterials({ courseId, meetingId }) {
  if (shouldUseServerApi()) {
    try {
      const params = new URLSearchParams({ courseId, meetingId: String(meetingId) })
      const data = await fetchApiJson(`/api/materials?${params}`)
      return data.materials ?? []
    } catch (error) {
      shouldFallback(error)
    }
  }

  const db = await openDatabase()

  try {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('meetingKey')
    const records = await requestToPromise(index.getAll(meetingKey(courseId, meetingId)))

    return records.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
  } finally {
    db.close()
  }
}

export async function saveUploadedMaterial({ courseId, meetingId, category, file }) {
  if (shouldUseServerApi()) {
    try {
      const form = new FormData()
      form.append('courseId', courseId)
      form.append('meetingId', String(meetingId))
      form.append('category', category)
      form.append('file', file)

      const data = await fetchApiJson('/api/materials', {
        method: 'POST',
        body: form,
      })
      return data.material
    } catch (error) {
      shouldFallback(error)
    }
  }

  const record = {
    id: `${meetingKey(courseId, meetingId)}:${category}:${createId()}`,
    meetingKey: meetingKey(courseId, meetingId),
    courseId,
    meetingId: String(meetingId),
    category,
    title: file.name,
    fileName: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    blob: file,
  }

  const db = await openDatabase()

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(STORE_NAME).put(record))
    return record
  } finally {
    db.close()
  }
}

export async function deleteUploadedMaterial(id) {
  if (shouldUseServerApi()) {
    try {
      await fetchApiEmpty(`/api/materials/${encodeURIComponent(id)}`, { method: 'DELETE' })
      return
    } catch (error) {
      shouldFallback(error)
    }
  }

  const db = await openDatabase()

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(STORE_NAME).delete(id))
  } finally {
    db.close()
  }
}

export async function getDeletedMaterialIds({ courseId, meetingId }) {
  if (shouldUseServerApi()) {
    try {
      const params = new URLSearchParams({ courseId, meetingId: String(meetingId) })
      const data = await fetchApiJson(`/api/deleted-materials?${params}`)
      return data.materialIds ?? []
    } catch (error) {
      shouldFallback(error)
    }
  }

  const db = await openDatabase()

  try {
    const transaction = db.transaction(DELETED_STORE_NAME, 'readonly')
    const store = transaction.objectStore(DELETED_STORE_NAME)
    const index = store.index('meetingKey')
    const records = await requestToPromise(index.getAll(meetingKey(courseId, meetingId)))

    return records.map((record) => record.materialId)
  } finally {
    db.close()
  }
}

export async function saveDeletedMaterial({ courseId, meetingId, category, materialId }) {
  if (shouldUseServerApi()) {
    try {
      const data = await fetchApiJson('/api/deleted-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, meetingId, category, materialId }),
      })
      return data.deletedMaterial
    } catch (error) {
      shouldFallback(error)
    }
  }

  const record = {
    id: deletedMaterialKey({ courseId, meetingId, category, materialId }),
    meetingKey: meetingKey(courseId, meetingId),
    courseId,
    meetingId: String(meetingId),
    category,
    materialId,
    deletedAt: new Date().toISOString(),
  }

  const db = await openDatabase()

  try {
    const transaction = db.transaction(DELETED_STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(DELETED_STORE_NAME).put(record))
    return record
  } finally {
    db.close()
  }
}

export async function getMeetingRequests({ courseId, meetingId }) {
  if (shouldUseServerApi()) {
    try {
      const params = new URLSearchParams({ courseId, meetingId: String(meetingId) })
      const data = await fetchApiJson(`/api/requests?${params}`)
      return data.requests ?? []
    } catch (error) {
      shouldFallback(error)
    }
  }

  const db = await openDatabase()

  try {
    const transaction = db.transaction(REQUESTS_STORE_NAME, 'readonly')
    const store = transaction.objectStore(REQUESTS_STORE_NAME)
    const index = store.index('meetingKey')
    const records = await requestToPromise(index.getAll(meetingKey(courseId, meetingId)))

    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } finally {
    db.close()
  }
}

export async function saveMeetingRequest({ courseId, meetingId, text, reviewInClass, file }) {
  if (shouldUseServerApi()) {
    try {
      const form = new FormData()
      form.append('courseId', courseId)
      form.append('meetingId', String(meetingId))
      form.append('text', text)
      form.append('reviewInClass', reviewInClass ? 'true' : 'false')
      if (file) {
        form.append('file', file)
      }

      const data = await fetchApiJson('/api/requests', {
        method: 'POST',
        body: form,
      })
      return data.request
    } catch (error) {
      shouldFallback(error)
    }
  }

  const record = {
    id: `${meetingKey(courseId, meetingId)}:request:${createId()}`,
    meetingKey: meetingKey(courseId, meetingId),
    courseId,
    meetingId: String(meetingId),
    text,
    reviewInClass,
    fileName: file?.name ?? '',
    fileType: file?.type ?? '',
    fileSize: file?.size ?? 0,
    blob: file ?? null,
    createdAt: new Date().toISOString(),
  }

  const db = await openDatabase()

  try {
    const transaction = db.transaction(REQUESTS_STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(REQUESTS_STORE_NAME).put(record))
    return record
  } finally {
    db.close()
  }
}

export async function deleteMeetingRequest(id) {
  if (shouldUseServerApi()) {
    try {
      await fetchApiEmpty(`/api/requests/${encodeURIComponent(id)}`, { method: 'DELETE' })
      return
    } catch (error) {
      shouldFallback(error)
    }
  }

  const db = await openDatabase()

  try {
    const transaction = db.transaction(REQUESTS_STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(REQUESTS_STORE_NAME).delete(id))
  } finally {
    db.close()
  }
}
