const DB_NAME = 'marathon-uploaded-materials'
const DB_VERSION = 3
const STORE_NAME = 'materials'
const DELETED_STORE_NAME = 'deletedMaterials'
const REQUESTS_STORE_NAME = 'meetingRequests'

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

export async function getDeletedMaterialIds({ courseId, meetingId }) {
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
  const db = await openDatabase()

  try {
    const transaction = db.transaction(REQUESTS_STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(REQUESTS_STORE_NAME).delete(id))
  } finally {
    db.close()
  }
}
