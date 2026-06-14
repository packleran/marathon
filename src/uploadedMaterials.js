const DB_NAME = 'marathon-uploaded-materials'
const DB_VERSION = 1
const STORE_NAME = 'materials'

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function meetingKey(courseId, meetingId) {
  return `${courseId}:${meetingId}`
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
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getUploadedMaterials({ courseId, meetingId }) {
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
  const db = await openDatabase()

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(STORE_NAME).delete(id))
  } finally {
    db.close()
  }
}
