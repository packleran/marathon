import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024) },
})

const port = Number(process.env.PORT ?? 3000)
const appRole = String(process.env.APP_ROLE ?? process.env.VITE_APP_ROLE ?? 'student').toLowerCase()
const isAdminService = appRole === 'admin'
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'
const adminPassword = process.env.ADMIN_PASSWORD ?? ''
const databaseUrl = process.env.DATABASE_URL
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    })
  : null

let dbReadyPromise = null
const contentEventClients = new Set()

function createId() {
  return randomUUID()
}

function meetingKey(courseId, meetingId) {
  return `${courseId}:${meetingId}`
}

function deletedMaterialKey({ courseId, meetingId, category, materialId }) {
  return `${meetingKey(courseId, meetingId)}:${category}:${materialId}`
}

function publicUrl(req, pathname) {
  const proto = req.headers['x-forwarded-proto'] ?? req.protocol
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  return `${proto}://${host}${pathname}`
}

function encodePathPart(value) {
  return encodeURIComponent(value)
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

function requireDatabase(_req, res, next) {
  if (!pool) {
    res.status(503).json({ error: 'DATABASE_URL is not configured' })
    return
  }

  next()
}

function requireAdmin(_req, res, next) {
  if (!isAdminService) {
    res.status(403).json({ error: 'This deployment is read-only' })
    return
  }

  next()
}

function requireBasicAuth(req, res, next) {
  if (!isAdminService || !adminPassword) {
    next()
    return
  }

  const header = req.headers.authorization ?? ''
  const [scheme, encoded] = header.split(' ')

  if (scheme === 'Basic' && encoded) {
    const [username, password] = Buffer.from(encoded, 'base64').toString('utf8').split(':')
    if (username === adminUsername && password === adminPassword) {
      next()
      return
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Marathon Admin"')
  res.status(401).send('Authentication required')
}

async function ensureDb() {
  if (!pool) return
  if (dbReadyPromise) return dbReadyPromise

  dbReadyPromise = (async () => {
    const client = await pool.connect()

    try {
      await client.query('SELECT pg_advisory_lock($1)', [2026061801])
      await client.query(`
        CREATE TABLE IF NOT EXISTS marathon_content (
          id text PRIMARY KEY,
          overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS marathon_materials (
          id text PRIMARY KEY,
          meeting_key text NOT NULL,
          course_id text NOT NULL,
          meeting_id text NOT NULL,
          category text NOT NULL,
          title text NOT NULL,
          file_name text NOT NULL,
          type text NOT NULL,
          size integer NOT NULL,
          uploaded_at timestamptz NOT NULL DEFAULT now(),
          data bytea NOT NULL
        );

        CREATE INDEX IF NOT EXISTS marathon_materials_meeting_key_idx
          ON marathon_materials (meeting_key);

        CREATE TABLE IF NOT EXISTS marathon_deleted_materials (
          id text PRIMARY KEY,
          meeting_key text NOT NULL,
          course_id text NOT NULL,
          meeting_id text NOT NULL,
          category text NOT NULL,
          material_id text NOT NULL,
          deleted_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS marathon_deleted_materials_meeting_key_idx
          ON marathon_deleted_materials (meeting_key);

        CREATE TABLE IF NOT EXISTS marathon_requests (
          id text PRIMARY KEY,
          meeting_key text NOT NULL,
          course_id text NOT NULL,
          meeting_id text NOT NULL,
          text text NOT NULL DEFAULT '',
          review_in_class boolean NOT NULL DEFAULT true,
          file_name text NOT NULL DEFAULT '',
          file_type text NOT NULL DEFAULT '',
          file_size integer NOT NULL DEFAULT 0,
          data bytea,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS marathon_requests_meeting_key_idx
          ON marathon_requests (meeting_key);
      `)
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [2026061801]).catch(() => {})
      client.release()
    }
  })()

  return dbReadyPromise
}

function sendContentEvent(payload) {
  const message = `data: ${JSON.stringify(payload)}\n\n`
  for (const client of contentEventClients) {
    client.write(message)
  }
}

async function notifyContentChanged() {
  sendContentEvent({ type: 'content-changed', at: new Date().toISOString() })

  if (!pool) return
  await pool.query('SELECT pg_notify($1, $2)', [
    'marathon_content_changed',
    JSON.stringify({ at: new Date().toISOString() }),
  ])
}

async function listenForContentChanges() {
  if (!pool) return

  let client

  try {
    await ensureDb()
    client = await pool.connect()
    await client.query('LISTEN marathon_content_changed')
    client.on('notification', (message) => {
      if (message.channel === 'marathon_content_changed') {
        sendContentEvent({ type: 'content-changed', at: new Date().toISOString() })
      }
    })
    client.on('error', () => {
      client.release()
      setTimeout(listenForContentChanges, 5000)
    })
  } catch (error) {
    if (client) client.release()
    console.error('Postgres notification listener failed:', error.message)
    setTimeout(listenForContentChanges, 5000)
  }
}

function serializeMaterial(req, row) {
  return {
    id: row.id,
    meetingKey: row.meeting_key,
    courseId: row.course_id,
    meetingId: row.meeting_id,
    category: row.category,
    title: row.title,
    fileName: row.file_name,
    type: row.type,
    size: row.size,
    uploadedAt: row.uploaded_at.toISOString(),
    url: publicUrl(req, `/api/materials/${encodePathPart(row.id)}/file`),
    uploaded: true,
  }
}

function serializeRequest(req, row) {
  const hasFile = row.file_size > 0

  return {
    id: row.id,
    meetingKey: row.meeting_key,
    courseId: row.course_id,
    meetingId: row.meeting_id,
    text: row.text,
    reviewInClass: row.review_in_class,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    fileUrl: hasFile ? publicUrl(req, `/api/requests/${encodePathPart(row.id)}/file`) : '',
    createdAt: row.created_at.toISOString(),
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    role: isAdminService ? 'admin' : 'student',
    database: Boolean(pool),
  })
})

app.use(requireBasicAuth)
app.use(express.json({ limit: '5mb' }))

app.get('/api/config', (_req, res) => {
  res.json({
    role: isAdminService ? 'admin' : 'student',
    canEditContent: isAdminService,
    hasDatabase: Boolean(pool),
  })
})

app.get('/api/content', asyncHandler(async (_req, res) => {
  if (!pool) {
    res.json({ overrides: {}, updatedAt: null, shared: false })
    return
  }

  await ensureDb()
  const result = await pool.query('SELECT overrides, updated_at FROM marathon_content WHERE id = $1', ['default'])

  res.json({
    overrides: result.rows[0]?.overrides ?? {},
    updatedAt: result.rows[0]?.updated_at?.toISOString() ?? null,
  })
}))

app.put('/api/content', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const overrides = req.body?.overrides && typeof req.body.overrides === 'object' ? req.body.overrides : {}
  const result = await pool.query(
    `INSERT INTO marathon_content (id, overrides, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id)
     DO UPDATE SET overrides = EXCLUDED.overrides, updated_at = now()
     RETURNING overrides, updated_at`,
    ['default', JSON.stringify(overrides)],
  )

  await notifyContentChanged()

  res.json({
    overrides: result.rows[0].overrides,
    updatedAt: result.rows[0].updated_at.toISOString(),
  })
}))

app.get('/api/content/events', asyncHandler(async (req, res) => {
  if (pool) {
    await ensureDb()
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write(`data: ${JSON.stringify({ type: 'connected', at: new Date().toISOString() })}\n\n`)

  contentEventClients.add(res)
  req.on('close', () => {
    contentEventClients.delete(res)
  })
}))

app.get('/api/materials', requireDatabase, asyncHandler(async (req, res) => {
  await ensureDb()
  const { courseId, meetingId } = req.query
  const result = await pool.query(
    `SELECT id, meeting_key, course_id, meeting_id, category, title, file_name, type, size, uploaded_at
     FROM marathon_materials
     WHERE meeting_key = $1
     ORDER BY uploaded_at ASC`,
    [meetingKey(courseId, meetingId)],
  )

  res.json({ materials: result.rows.map((row) => serializeMaterial(req, row)) })
}))

app.post('/api/materials', requireDatabase, requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  await ensureDb()
  if (!req.file) {
    res.status(400).json({ error: 'Missing file' })
    return
  }

  const { courseId, meetingId, category } = req.body
  const record = {
    id: `${meetingKey(courseId, meetingId)}:${category}:${createId()}`,
    meetingKey: meetingKey(courseId, meetingId),
    courseId,
    meetingId: String(meetingId),
    category,
    title: req.file.originalname,
    fileName: req.file.originalname,
    type: req.file.mimetype || 'application/octet-stream',
    size: req.file.size,
    data: req.file.buffer,
  }

  const result = await pool.query(
    `INSERT INTO marathon_materials
       (id, meeting_key, course_id, meeting_id, category, title, file_name, type, size, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, meeting_key, course_id, meeting_id, category, title, file_name, type, size, uploaded_at`,
    [
      record.id,
      record.meetingKey,
      record.courseId,
      record.meetingId,
      record.category,
      record.title,
      record.fileName,
      record.type,
      record.size,
      record.data,
    ],
  )

  await notifyContentChanged()

  res.status(201).json({ material: serializeMaterial(req, result.rows[0]) })
}))

app.get('/api/materials/:id/file', requireDatabase, asyncHandler(async (req, res) => {
  await ensureDb()
  const result = await pool.query(
    'SELECT file_name, type, data FROM marathon_materials WHERE id = $1',
    [req.params.id],
  )

  if (result.rowCount === 0) {
    res.status(404).send('Not found')
    return
  }

  const row = result.rows[0]
  res.setHeader('Content-Type', row.type)
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name)}"`)
  res.send(row.data)
}))

app.delete('/api/materials/:id', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  await pool.query('DELETE FROM marathon_materials WHERE id = $1', [req.params.id])
  await notifyContentChanged()
  res.status(204).end()
}))

app.post('/api/courses/:sourceCourseId/materials/duplicate', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()

  const { sourceCourseId } = req.params
  const { targetCourseId, meetings } = req.body

  if (!targetCourseId || !Array.isArray(meetings)) {
    res.status(400).json({ error: 'Missing targetCourseId or meetings' })
    return
  }

  const client = await pool.connect()
  let copiedMaterials = 0
  let copiedDeletedMaterials = 0

  try {
    await client.query('BEGIN')

    for (const meeting of meetings) {
      const sourceMeetingId = String(meeting.sourceMeetingId ?? '')
      const targetMeetingId = String(meeting.targetMeetingId ?? '')
      if (!sourceMeetingId || !targetMeetingId) continue

      const sourceKey = meetingKey(sourceCourseId, sourceMeetingId)
      const targetKey = meetingKey(targetCourseId, targetMeetingId)

      const sourceMaterials = await client.query(
        `SELECT category, title, file_name, type, size, data
         FROM marathon_materials
         WHERE meeting_key = $1
         ORDER BY uploaded_at ASC`,
        [sourceKey],
      )

      for (const row of sourceMaterials.rows) {
        await client.query(
          `INSERT INTO marathon_materials
             (id, meeting_key, course_id, meeting_id, category, title, file_name, type, size, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            `${targetKey}:${row.category}:${createId()}`,
            targetKey,
            targetCourseId,
            targetMeetingId,
            row.category,
            row.title,
            row.file_name,
            row.type,
            row.size,
            row.data,
          ],
        )
        copiedMaterials += 1
      }

      const sourceDeletedMaterials = await client.query(
        `SELECT category, material_id
         FROM marathon_deleted_materials
         WHERE meeting_key = $1
         ORDER BY deleted_at ASC`,
        [sourceKey],
      )

      for (const row of sourceDeletedMaterials.rows) {
        const id = deletedMaterialKey({
          courseId: targetCourseId,
          meetingId: targetMeetingId,
          category: row.category,
          materialId: row.material_id,
        })

        await client.query(
          `INSERT INTO marathon_deleted_materials
             (id, meeting_key, course_id, meeting_id, category, material_id, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (id)
           DO UPDATE SET deleted_at = now()`,
          [id, targetKey, targetCourseId, targetMeetingId, row.category, row.material_id],
        )
        copiedDeletedMaterials += 1
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  await notifyContentChanged()

  res.status(201).json({
    copiedMaterials,
    copiedDeletedMaterials,
  })
}))

app.get('/api/deleted-materials', requireDatabase, asyncHandler(async (req, res) => {
  await ensureDb()
  const { courseId, meetingId } = req.query
  const result = await pool.query(
    'SELECT material_id FROM marathon_deleted_materials WHERE meeting_key = $1 ORDER BY deleted_at ASC',
    [meetingKey(courseId, meetingId)],
  )

  res.json({ materialIds: result.rows.map((row) => row.material_id) })
}))

app.post('/api/deleted-materials', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const { courseId, meetingId, category, materialId } = req.body
  const id = deletedMaterialKey({ courseId, meetingId, category, materialId })
  const result = await pool.query(
    `INSERT INTO marathon_deleted_materials
       (id, meeting_key, course_id, meeting_id, category, material_id, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id)
     DO UPDATE SET deleted_at = now()
     RETURNING id, meeting_key, course_id, meeting_id, category, material_id, deleted_at`,
    [id, meetingKey(courseId, meetingId), courseId, String(meetingId), category, materialId],
  )

  await notifyContentChanged()

  res.status(201).json({ deletedMaterial: result.rows[0] })
}))

app.get('/api/requests', requireDatabase, asyncHandler(async (req, res) => {
  await ensureDb()
  const { courseId, meetingId } = req.query
  const result = await pool.query(
    `SELECT id, meeting_key, course_id, meeting_id, text, review_in_class, file_name, file_type, file_size, created_at
     FROM marathon_requests
     WHERE meeting_key = $1
     ORDER BY created_at DESC`,
    [meetingKey(courseId, meetingId)],
  )

  res.json({ requests: result.rows.map((row) => serializeRequest(req, row)) })
}))

app.post('/api/requests', requireDatabase, upload.single('file'), asyncHandler(async (req, res) => {
  await ensureDb()
  const { courseId, meetingId } = req.body
  const file = req.file
  const record = {
    id: `${meetingKey(courseId, meetingId)}:request:${createId()}`,
    meetingKey: meetingKey(courseId, meetingId),
    courseId,
    meetingId: String(meetingId),
    text: req.body.text ?? '',
    reviewInClass: req.body.reviewInClass !== 'false',
    fileName: file?.originalname ?? '',
    fileType: file?.mimetype ?? '',
    fileSize: file?.size ?? 0,
    data: file?.buffer ?? null,
  }

  const result = await pool.query(
    `INSERT INTO marathon_requests
       (id, meeting_key, course_id, meeting_id, text, review_in_class, file_name, file_type, file_size, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, meeting_key, course_id, meeting_id, text, review_in_class, file_name, file_type, file_size, created_at`,
    [
      record.id,
      record.meetingKey,
      record.courseId,
      record.meetingId,
      record.text,
      record.reviewInClass,
      record.fileName,
      record.fileType,
      record.fileSize,
      record.data,
    ],
  )

  await notifyContentChanged()

  res.status(201).json({ request: serializeRequest(req, result.rows[0]) })
}))

app.get('/api/requests/:id/file', requireDatabase, asyncHandler(async (req, res) => {
  await ensureDb()
  const result = await pool.query(
    'SELECT file_name, file_type, data FROM marathon_requests WHERE id = $1 AND data IS NOT NULL',
    [req.params.id],
  )

  if (result.rowCount === 0) {
    res.status(404).send('Not found')
    return
  }

  const row = result.rows[0]
  res.setHeader('Content-Type', row.file_type || 'application/octet-stream')
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name)}"`)
  res.send(row.data)
}))

app.delete('/api/requests/:id', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  await pool.query('DELETE FROM marathon_requests WHERE id = $1', [req.params.id])
  await notifyContentChanged()
  res.status(204).end()
}))

const distPath = process.env.DIST_DIR
  ? path.resolve(process.env.DIST_DIR)
  : path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

app.use((req, res) => {
  if (req.method === 'GET' && req.accepts('html')) {
    res.sendFile(path.join(distPath, 'index.html'))
    return
  }

  res.status(404).send('Not found')
})

app.use((error, _req, res, _next) => {
  void _next
  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`Marathon server listening on port ${port} as ${isAdminService ? 'admin' : 'student'}`)
})

void listenForContentChanges()
