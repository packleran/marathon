import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import pg from 'pg'
import { courses } from '../src/data.js'

const { Pool } = pg
const scrypt = promisify(scryptCallback)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.set('trust proxy', 1)
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
const studentSessionCookie = 'marathon_student_session'
const studentDeviceCookie = 'marathon_student_device'
const studentPhoneAccessCookie = 'marathon_phone_access'
const studentDeviceCookieMaxAge = 400 * 24 * 60 * 60
const configuredStudentSessionDays = Number(process.env.STUDENT_SESSION_DAYS ?? 30)
const studentSessionDays = Number.isFinite(configuredStudentSessionDays)
  ? Math.max(1, configuredStudentSessionDays)
  : 30
const disabledAuthValues = new Set(['0', 'false', 'no', 'off'])
const studentSingleSession = !disabledAuthValues.has(String(process.env.STUDENT_SINGLE_SESSION ?? 'true').toLowerCase())
const studentDeviceLock = !disabledAuthValues.has(String(process.env.STUDENT_DEVICE_LOCK ?? 'true').toLowerCase())
const studentPhoneLoginCourseIds = normalizeCourseIds(
  process.env.STUDENT_PHONE_LOGIN_COURSE_IDS ?? process.env.STUDENT_PUBLIC_COURSE_IDS ?? 'computational',
)
const studentPhoneLoginCourseIdSet = new Set(studentPhoneLoginCourseIds)
const studentPhoneAccessSecret = String(
  process.env.STUDENT_PHONE_ACCESS_SECRET ??
  process.env.STUDENT_AUTH_SECRET ??
  adminPassword ??
  databaseUrl ??
  'marathon-phone-access-local-dev',
)
const modelGroupFallbackLeaders = ['יובל', 'שחר']
const whatsAppCredentialsEnabled = !disabledAuthValues.has(String(process.env.WHATSAPP_SEND_CREDENTIALS ?? 'true').toLowerCase())
const whatsAppGraphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v25.0'
const whatsAppPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
const whatsAppAccessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
const whatsAppTemplateName = process.env.WHATSAPP_TEMPLATE_NAME ?? 'student_login_details'
const whatsAppTemplateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'he'
const passwordScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }
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

function isStudentAuthRequired() {
  const configured = String(process.env.STUDENT_AUTH_REQUIRED ?? 'true').toLowerCase()
  return !isAdminService && Boolean(pool) && !disabledAuthValues.has(configured)
}

function isStudentSingleSessionRequired() {
  return isStudentAuthRequired() && studentSingleSession
}

function isStudentDeviceLockRequired() {
  return isStudentAuthRequired() && studentDeviceLock
}

function isStudentDeviceLockRequiredForCourseIds(courseIds) {
  return isStudentDeviceLockRequired() && !hasOnlyPhoneLoginCourses(courseIds)
}

function isStudentSingleSessionRequiredForCourseIds(courseIds) {
  return isStudentSingleSessionRequired() && !hasOnlyPhoneLoginCourses(courseIds)
}

function isWhatsAppConfigured() {
  return whatsAppCredentialsEnabled && Boolean(whatsAppPhoneNumberId && whatsAppAccessToken)
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('972') && digits.length >= 11) {
    return `0${digits.slice(3)}`
  }

  return digits
}

function isValidPhone(phone) {
  return phone.length >= 8 && phone.length <= 15
}

function normalizeCourseIds(value) {
  const values = Array.isArray(value) ? value : [value]
  return [...new Set(values
    .map((item) => String(item ?? '').trim())
    .filter(Boolean))]
}

function normalizePhoneList(value) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[\s,;]+/)

  return [...new Set(values
    .map((item) => normalizePhone(item))
    .filter((phone) => isValidPhone(phone)))]
}

function rootCourseId(course) {
  return String(course?.sourceCourseId ?? course?.id ?? '').trim()
}

function isPhoneLoginCourseId(courseId) {
  const normalizedCourseId = String(courseId ?? '').trim()
  if (studentPhoneLoginCourseIdSet.has(normalizedCourseId)) return true

  return studentPhoneLoginCourseIds.some((rootId) => normalizedCourseId.startsWith(`${rootId}-group-`))
}

function isPhoneLoginCourse(course) {
  return isPhoneLoginCourseId(rootCourseId(course))
}

function hasOnlyPhoneLoginCourses(courseIds) {
  const normalizedCourseIds = normalizeCourseIds(courseIds)
  return normalizedCourseIds.length > 0 && normalizedCourseIds.every((courseId) => isPhoneLoginCourseId(courseId))
}

function toWhatsAppPhoneNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return `972${digits.slice(1)}`

  return digits
}

function generatePassword(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(length)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url')
  const derivedKey = await scrypt(password, salt, 64, passwordScryptOptions)
  return [
    'scrypt',
    passwordScryptOptions.N,
    passwordScryptOptions.r,
    passwordScryptOptions.p,
    salt,
    derivedKey.toString('base64url'),
  ].join('$')
}

async function verifyPassword(password, storedHash) {
  const [algorithm, n, r, p, salt, hash] = String(storedHash ?? '').split('$')
  if (algorithm !== 'scrypt' || !salt || !hash) return false

  const parsedOptions = { N: Number(n), r: Number(r), p: Number(p), maxmem: 32 * 1024 * 1024 }
  if (!Number.isFinite(parsedOptions.N) || !Number.isFinite(parsedOptions.r) || !Number.isFinite(parsedOptions.p)) {
    return false
  }

  const expected = Buffer.from(hash, 'base64url')
  const actual = await scrypt(password, salt, expected.length, parsedOptions)

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function hashDeviceToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function signValue(value) {
  return createHmac('sha256', studentPhoneAccessSecret).update(value).digest('base64url')
}

function safeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''))
  const rightBuffer = Buffer.from(String(right ?? ''))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function createSignedPhoneAccessToken(phoneAccess) {
  const payload = Buffer.from(JSON.stringify(phoneAccess)).toString('base64url')
  return `${payload}.${signValue(payload)}`
}

function verifySignedPhoneAccessToken(token) {
  const [payload, signature] = String(token ?? '').split('.')
  if (!payload || !signature || !safeEqualString(signValue(payload), signature)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    if (Number(parsed.expiresAt) <= Date.now()) return null

    const courseIds = normalizeCourseIds(parsed.courseIds)
    if (courseIds.length === 0) return null

    const type = parsed.type === 'course-choice' ? 'course-choice' : 'phone'
    const phone = normalizePhone(parsed.phone)
    if (type === 'phone' && !isValidPhone(phone)) return null

    return {
      type,
      phone: type === 'phone' ? phone : '',
      name: String(parsed.name ?? '').trim(),
      courseIds,
      expiresAt: Number(parsed.expiresAt),
    }
  } catch {
    return null
  }
}

function parseCookies(req) {
  const header = req.headers.cookie ?? ''
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=')
        if (separator === -1) return [part, '']
        const name = part.slice(0, separator)
        const value = part.slice(separator + 1)
        try {
          return [name, decodeURIComponent(value)]
        } catch {
          return [name, value]
        }
      }),
  )
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(options.maxAge)}`)
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`)
  segments.push(`Path=${options.path ?? '/'}`)
  if (options.httpOnly !== false) segments.push('HttpOnly')
  if (options.secure) segments.push('Secure')
  segments.push(`SameSite=${options.sameSite ?? 'Lax'}`)

  return segments.join('; ')
}

function shouldUseSecureCookie(req) {
  const configured = process.env.STUDENT_COOKIE_SECURE
  if (configured === 'true') return true
  if (configured === 'false') return false

  return req.secure || req.headers['x-forwarded-proto'] === 'https'
}

function appendSetCookie(res, cookie) {
  const current = res.getHeader('Set-Cookie')
  if (!current) {
    res.setHeader('Set-Cookie', cookie)
    return
  }

  res.setHeader('Set-Cookie', Array.isArray(current) ? [...current, cookie] : [current, cookie])
}

function setStudentSessionCookie(req, res, token, expiresAt) {
  appendSetCookie(res, serializeCookie(studentSessionCookie, token, {
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    secure: shouldUseSecureCookie(req),
  }))
}

function clearStudentSessionCookie(req, res) {
  appendSetCookie(res, serializeCookie(studentSessionCookie, '', {
    expires: new Date(0),
    maxAge: 0,
    secure: shouldUseSecureCookie(req),
  }))
}

function setStudentPhoneAccessCookie(req, res, phoneAccess) {
  appendSetCookie(res, serializeCookie(studentPhoneAccessCookie, createSignedPhoneAccessToken(phoneAccess), {
    expires: new Date(phoneAccess.expiresAt),
    maxAge: Math.max(0, Math.floor((phoneAccess.expiresAt - Date.now()) / 1000)),
    secure: shouldUseSecureCookie(req),
  }))
}

function clearStudentPhoneAccessCookie(req, res) {
  appendSetCookie(res, serializeCookie(studentPhoneAccessCookie, '', {
    expires: new Date(0),
    maxAge: 0,
    secure: shouldUseSecureCookie(req),
  }))
}

function setStudentDeviceCookie(req, res, token) {
  appendSetCookie(res, serializeCookie(studentDeviceCookie, token, {
    expires: new Date(Date.now() + studentDeviceCookieMaxAge * 1000),
    maxAge: studentDeviceCookieMaxAge,
    secure: shouldUseSecureCookie(req),
  }))
}

function toIso(value) {
  return value ? value.toISOString() : null
}

function requestIp(req) {
  return String(req.headers['x-forwarded-for'] ?? req.ip ?? '')
    .split(',')[0]
    .trim()
    .slice(0, 80)
}

function requestUserAgent(req) {
  return String(req.headers['user-agent'] ?? '').slice(0, 500)
}

function serializeStudent(row) {
  const courseIds = normalizeCourseIds(row.course_ids ?? [])

  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    active: row.active,
    courseIds,
    phoneLoginOnly: hasOnlyPhoneLoginCourses(courseIds),
    publicAccessOnly: hasOnlyPhoneLoginCourses(courseIds),
    activeSessionCount: Number(row.active_session_count ?? 0),
    lockedDevice: Boolean(row.locked_device_id),
    lockedDeviceAt: toIso(row.locked_device_at),
    lockedDeviceIpAddress: row.locked_device_ip_address ?? '',
    lockedDeviceUserAgent: row.locked_device_user_agent ?? '',
    lastDeniedIpAddress: row.last_denied_ip_address ?? '',
    lastDeniedUserAgent: row.last_denied_user_agent ?? '',
    lastDeniedAt: toIso(row.last_denied_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastLoginAt: toIso(row.last_login_at),
  }
}

function createWhatsAppStatus(status, text, extra = {}) {
  return { status, text, ...extra }
}

async function sendCredentialsWhatsApp({ student, password }) {
  if (!whatsAppCredentialsEnabled) {
    return createWhatsAppStatus('skipped', 'שליחת WhatsApp כבויה')
  }

  if (!isWhatsAppConfigured()) {
    return createWhatsAppStatus('skipped', 'WhatsApp לא מוגדר בשרת')
  }

  const to = toWhatsAppPhoneNumber(student.phone)
  if (!to) {
    return createWhatsAppStatus('skipped', 'אין מספר טלפון תקין לשליחת WhatsApp')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(
      `https://graph.facebook.com/${whatsAppGraphApiVersion}/${encodeURIComponent(whatsAppPhoneNumberId)}/messages`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${whatsAppAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: whatsAppTemplateName,
            language: { code: whatsAppTemplateLanguage },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: student.name || student.phone },
                  { type: 'text', text: student.phone },
                  { type: 'text', text: password },
                ],
              },
            ],
          },
        }),
      },
    )

    const data = await response.json().catch(() => ({}))
    const messageId = data.messages?.[0]?.id

    if (!response.ok) {
      return createWhatsAppStatus(
        'failed',
        data.error?.message ? `WhatsApp נכשל: ${data.error.message}` : `WhatsApp נכשל עם סטטוס ${response.status}`,
      )
    }

    return createWhatsAppStatus('sent', 'נשלחה הודעת WhatsApp', {
      messageId,
      to,
    })
  } catch (error) {
    return createWhatsAppStatus(
      'failed',
      error.name === 'AbortError' ? 'WhatsApp נכשל: זמן ההמתנה הסתיים' : `WhatsApp נכשל: ${error.message}`,
    )
  } finally {
    clearTimeout(timeout)
  }
}

function shouldEnforceStudentCourseAccess() {
  return isStudentAuthRequired() && !isAdminService
}

function getAccessibleCourseIdsForRequest(req) {
  const allowedCourseIds = new Set()
  normalizeCourseIds(req.student?.courseIds).forEach((courseId) => allowedCourseIds.add(courseId))
  normalizeCourseIds(req.phoneAccess?.courseIds).forEach((courseId) => allowedCourseIds.add(courseId))

  return [...allowedCourseIds]
}

function studentCanAccessCourse(req, courseId) {
  if (!shouldEnforceStudentCourseAccess()) return true

  const normalizedCourseId = String(courseId ?? '').trim()
  return getAccessibleCourseIdsForRequest(req).includes(normalizedCourseId)
}

function rejectStudentCourseAccess(res) {
  res.status(403).json({ error: 'This student is not assigned to this course' })
}

function requireStudentCourseFromQuery(req, res, next) {
  if (!studentCanAccessCourse(req, req.query.courseId)) {
    rejectStudentCourseAccess(res)
    return
  }

  next()
}

function sanitizeCourseForStudent(course) {
  if (!course || typeof course !== 'object') return course

  const safeCourse = { ...course }
  delete safeCourse.approvedPhones
  return safeCourse
}

function sanitizeCourseOverrideForStudent(courseOverride) {
  if (!courseOverride || typeof courseOverride !== 'object') return courseOverride

  return {
    ...courseOverride,
    course: sanitizeCourseForStudent(courseOverride.course ?? {}),
  }
}

function filterContentOverridesForCourses(overrides, courseIds) {
  const allowedCourseIds = new Set(normalizeCourseIds(courseIds))
  if (allowedCourseIds.size === 0) return {}

  const filtered = {}

  Object.entries(overrides ?? {}).forEach(([key, value]) => {
    if (key === 'customCourses') {
      const customCourses = Array.isArray(value)
        ? value
            .filter((course) => allowedCourseIds.has(String(course.id)))
            .map((course) => sanitizeCourseForStudent(course))
        : []
      if (customCourses.length > 0) filtered.customCourses = customCourses
      return
    }

    if (key === 'deletedCourseIds') {
      const deletedCourseIds = Array.isArray(value)
        ? value.filter((courseId) => allowedCourseIds.has(String(courseId)))
        : []
      if (deletedCourseIds.length > 0) filtered.deletedCourseIds = deletedCourseIds
      return
    }

    if (allowedCourseIds.has(String(key))) {
      filtered[key] = sanitizeCourseOverrideForStudent(value)
    }
  })

  return filtered
}

function applyServerCourseOverrides(courseList, overrides) {
  const customCourses = Array.isArray(overrides?.customCourses) ? overrides.customCourses : []
  const deletedCourseIds = new Set((overrides?.deletedCourseIds ?? []).map(String))

  return [...courseList, ...customCourses]
    .filter((course) => !deletedCourseIds.has(String(course.id)))
    .map((course) => ({
      ...course,
      ...(overrides?.[course.id]?.course ?? {}),
    }))
}

function inferModelGroupLeader(course, index) {
  const text = `${course?.name ?? ''} ${course?.subtitle ?? ''}`
  if (text.includes('יובל')) return 'יובל'
  if (text.includes('שחר')) return 'שחר'

  return modelGroupFallbackLeaders[index] ?? `קבוצה ${index + 1}`
}

function createPhoneLoginCourseOption(course, index) {
  const leader = inferModelGroupLeader(course, index)

  return {
    id: String(course.id),
    label: modelGroupFallbackLeaders.includes(leader)
      ? `מודלים ראש קבוצה ${leader}`
      : `מודלים ${leader}`,
    name: String(course.name ?? ''),
    sourceCourseId: String(course.sourceCourseId ?? course.id),
  }
}

function getPhoneLoginCourseOptions(overrides) {
  return applyServerCourseOverrides(courses, overrides)
    .filter((course) => isPhoneLoginCourse(course))
    .map((course, index) => createPhoneLoginCourseOption(course, index))
}

function getPhoneLoginCourseById(courseId, overrides) {
  const normalizedCourseId = String(courseId ?? '').trim()
  if (!normalizedCourseId) return null

  return applyServerCourseOverrides(courses, overrides)
    .find((course) => isPhoneLoginCourse(course) && String(course.id) === normalizedCourseId) ?? null
}

function getPhoneLoginCourseIdsForPhone(phone, overrides) {
  const normalizedPhone = normalizePhone(phone)
  if (!isValidPhone(normalizedPhone)) return []

  return applyServerCourseOverrides(courses, overrides)
    .filter((course) => isPhoneLoginCourse(course))
    .filter((course) => normalizePhoneList(course.approvedPhones).includes(normalizedPhone))
    .map((course) => String(course.id))
}

async function loadContentOverridesFromDatabase() {
  if (!pool) return {}

  await ensureDb()
  const result = await pool.query('SELECT overrides FROM marathon_content WHERE id = $1', ['default'])
  return result.rows[0]?.overrides ?? {}
}

function filterCoursesForIds(courseList, courseIds) {
  const allowedCourseIds = new Set(normalizeCourseIds(courseIds))
  if (allowedCourseIds.size === 0) return []

  return courseList.filter((course) => allowedCourseIds.has(String(course.id)))
}

function getCoursesForRequest(req, courseList = courses) {
  if (!shouldEnforceStudentCourseAccess()) return courseList

  return filterCoursesForIds(courseList, getAccessibleCourseIdsForRequest(req))
}

function isPublicStudentApiRequest(req) {
  if (!req.path.startsWith('/api/')) return false

  return (
    req.path === '/api/config' ||
    req.path === '/api/courses' ||
    req.path === '/api/student-auth/course-login' ||
    req.path === '/api/student-auth/phone-login' ||
    req.path === '/api/student-auth/logout'
  )
}

function isPublicStudentAppShellRequest(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (req.path.startsWith('/assets/')) return true
  if (req.path === '/favicon.svg' || req.path === '/icons.svg') return true

  return !path.extname(req.path) && req.accepts('html')
}

function canServeAnonymousStudentRequest(req) {
  return (
    shouldEnforceStudentCourseAccess() &&
    studentPhoneLoginCourseIds.length > 0 &&
    (isPublicStudentApiRequest(req) || isPublicStudentAppShellRequest(req))
  )
}

function htmlJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function sendStudentLoginPage(req, res, redirectPath = null) {
  const nextPath = redirectPath ?? (req.originalUrl.startsWith('/') && !req.originalUrl.startsWith('//')
    ? req.originalUrl
    : '/')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(`<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>כניסה לאתר הסטודנטים</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f8fa;
        --surface: #ffffff;
        --text: #1a1d29;
        --muted: #565c6e;
        --border: #e7e9f0;
        --primary: #4c57d4;
        --primary-hover: #3f49be;
        --danger: #d14343;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, Heebo, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(100% - 32px, 420px);
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--surface);
        box-shadow: 0 12px 32px rgb(20 23 38 / 0.08), 0 2px 4px rgb(20 23 38 / 0.04);
        padding: 28px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 24px;
        line-height: 1.25;
      }
      p {
        margin: 0 0 22px;
        color: var(--muted);
        line-height: 1.6;
      }
      label {
        display: block;
        margin-top: 14px;
        font-size: 13px;
        font-weight: 700;
        color: var(--muted);
      }
      input {
        width: 100%;
        margin-top: 7px;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 13px;
        font: inherit;
        color: var(--text);
        outline: none;
      }
      input:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px #eef0fb;
      }
      button {
        width: 100%;
        margin-top: 22px;
        border: 0;
        border-radius: 12px;
        background: var(--primary);
        color: #fff;
        padding: 12px 16px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      button:hover { background: var(--primary-hover); }
      button:disabled { cursor: progress; opacity: 0.7; }
      .error {
        display: none;
        margin-top: 14px;
        color: var(--danger);
        font-size: 13px;
        line-height: 1.5;
      }
      .error[data-visible="true"] { display: block; }
    </style>
  </head>
  <body>
    <main>
      <h1>כניסה לאתר הסטודנטים</h1>
      <p>שם המשתמש הוא מספר הטלפון שאיתו נרשמת. הסיסמה ניתנת לאחר פתיחת הגישה.</p>
      <form>
        <label>
          טלפון
          <input name="phone" autocomplete="username" inputmode="tel" required autofocus />
        </label>
        <label>
          סיסמה
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit">כניסה</button>
        <div class="error" role="alert"></div>
      </form>
    </main>
    <script>
      const nextPath = ${htmlJson(nextPath)};
      const form = document.querySelector('form');
      const button = document.querySelector('button');
      const errorBox = document.querySelector('.error');

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorBox.dataset.visible = 'false';
        button.disabled = true;

        try {
          const formData = new FormData(form);
          const response = await fetch('/api/student-auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: formData.get('phone'),
              password: formData.get('password')
            })
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'לא הצלחנו להתחבר. בדוק את הפרטים ונסה שוב.');
          }

          window.location.assign(nextPath);
        } catch (error) {
          errorBox.textContent = error.message;
          errorBox.dataset.visible = 'true';
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`)
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

async function getAuthenticatedStudent(req) {
  if (!pool) return null

  const token = parseCookies(req)[studentSessionCookie]
  if (!token) return null

  await ensureDb()
  const result = await pool.query(
    `SELECT students.id, students.phone, students.name, students.active,
            students.course_ids,
            students.locked_device_id, students.locked_device_at,
            students.locked_device_ip_address, students.locked_device_user_agent,
            students.last_denied_ip_address, students.last_denied_user_agent, students.last_denied_at,
            students.created_at, students.updated_at, students.last_login_at
     FROM marathon_student_sessions sessions
     JOIN marathon_students students ON students.id = sessions.student_id
     WHERE sessions.id = $1
       AND sessions.expires_at > now()
       AND students.active = true`,
    [hashSessionToken(token)],
  )

  if (result.rowCount === 0) return null

  const studentRow = result.rows[0]
  const lockedDeviceId = String(studentRow.locked_device_id ?? '')
  const deviceToken = parseCookies(req)[studentDeviceCookie]
  const currentDeviceId = deviceToken ? hashDeviceToken(deviceToken) : ''
  if (
    isStudentDeviceLockRequiredForCourseIds(studentRow.course_ids) &&
    lockedDeviceId &&
    currentDeviceId !== lockedDeviceId
  ) {
    await pool.query(
      `UPDATE marathon_students
       SET last_denied_ip_address = $2,
           last_denied_user_agent = $3,
           last_denied_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [studentRow.id, requestIp(req), requestUserAgent(req)],
    ).catch(() => {})
    await pool.query('DELETE FROM marathon_student_sessions WHERE id = $1', [hashSessionToken(token)]).catch(() => {})
    return null
  }

  await pool.query(
    'UPDATE marathon_student_sessions SET last_seen_at = now() WHERE id = $1',
    [hashSessionToken(token)],
  ).catch(() => {})

  return serializeStudent(studentRow)
}

function getAuthenticatedPhoneAccess(req) {
  if (!shouldEnforceStudentCourseAccess()) return null

  return verifySignedPhoneAccessToken(parseCookies(req)[studentPhoneAccessCookie])
}

async function requireStudentAuth(req, res, next) {
  if (!isStudentAuthRequired()) {
    next()
    return
  }

  const student = await getAuthenticatedStudent(req)
  if (student) {
    req.student = student
    next()
    return
  }

  const phoneAccess = getAuthenticatedPhoneAccess(req)
  if (phoneAccess) {
    req.phoneAccess = phoneAccess
    if (req.path.startsWith('/api/') || isPublicStudentAppShellRequest(req)) {
      next()
      return
    }

    res.status(401).send('Authentication required')
    return
  }

  if (canServeAnonymousStudentRequest(req)) {
    next()
    return
  }

  if (req.path.startsWith('/api/')) {
    res.status(401).json({ error: 'Student login required' })
    return
  }

  const isDocumentRequest = !path.extname(req.path) && req.accepts('html')
  if ((req.method === 'GET' || req.method === 'HEAD') && isDocumentRequest) {
    sendStudentLoginPage(req, res)
    return
  }

  res.status(401).send('Authentication required')
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

        CREATE TABLE IF NOT EXISTS marathon_students (
          id text PRIMARY KEY,
          phone text NOT NULL UNIQUE,
          name text NOT NULL DEFAULT '',
          password_hash text NOT NULL,
          active boolean NOT NULL DEFAULT true,
          course_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
          locked_device_id text NOT NULL DEFAULT '',
          locked_device_at timestamptz,
          locked_device_ip_address text NOT NULL DEFAULT '',
          locked_device_user_agent text NOT NULL DEFAULT '',
          last_denied_ip_address text NOT NULL DEFAULT '',
          last_denied_user_agent text NOT NULL DEFAULT '',
          last_denied_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          last_login_at timestamptz
        );

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS locked_device_id text NOT NULL DEFAULT '';

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS locked_device_at timestamptz;

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS locked_device_ip_address text NOT NULL DEFAULT '';

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS locked_device_user_agent text NOT NULL DEFAULT '';

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS last_denied_ip_address text NOT NULL DEFAULT '';

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS last_denied_user_agent text NOT NULL DEFAULT '';

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS last_denied_at timestamptz;

        CREATE INDEX IF NOT EXISTS marathon_students_active_idx
          ON marathon_students (active);

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS course_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

        CREATE TABLE IF NOT EXISTS marathon_student_sessions (
          id text PRIMARY KEY,
          student_id text NOT NULL REFERENCES marathon_students(id) ON DELETE CASCADE,
          expires_at timestamptz NOT NULL,
          ip_address text NOT NULL DEFAULT '',
          user_agent text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now(),
          last_seen_at timestamptz NOT NULL DEFAULT now()
        );

        ALTER TABLE marathon_student_sessions
          ADD COLUMN IF NOT EXISTS ip_address text NOT NULL DEFAULT '';

        ALTER TABLE marathon_student_sessions
          ADD COLUMN IF NOT EXISTS user_agent text NOT NULL DEFAULT '';

        CREATE INDEX IF NOT EXISTS marathon_student_sessions_student_idx
          ON marathon_student_sessions (student_id);

        CREATE INDEX IF NOT EXISTS marathon_student_sessions_expires_idx
          ON marathon_student_sessions (expires_at);
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

app.get('/student-login', (req, res) => {
  if (!isStudentAuthRequired()) {
    res.redirect('/')
    return
  }

  sendStudentLoginPage(req, res, '/')
})

app.get('/api/config', asyncHandler(async (req, res) => {
  const student = await getAuthenticatedStudent(req)
  const phoneAccess = student ? null : getAuthenticatedPhoneAccess(req)
  const contentOverrides = studentPhoneLoginCourseIds.length > 0
    ? await loadContentOverridesFromDatabase()
    : {}

  res.json({
    role: isAdminService ? 'admin' : 'student',
    canEditContent: isAdminService,
    hasDatabase: Boolean(pool),
    studentAuthRequired: isStudentAuthRequired(),
    phoneLoginCourseIds: studentPhoneLoginCourseIds,
    modelGroupOptions: getPhoneLoginCourseOptions(contentOverrides),
    publicCourseIds: [],
    phoneAccess,
    student,
  })
}))

app.get('/api/courses', asyncHandler(async (req, res) => {
  const student = await getAuthenticatedStudent(req)
  if (student) req.student = student
  if (!student) {
    const phoneAccess = getAuthenticatedPhoneAccess(req)
    if (phoneAccess) req.phoneAccess = phoneAccess
  }

  const courseList = shouldEnforceStudentCourseAccess()
    ? applyServerCourseOverrides(courses, await loadContentOverridesFromDatabase())
    : courses

  res.json({
    courses: getCoursesForRequest(req, courseList).map((course) => (
      shouldEnforceStudentCourseAccess() ? sanitizeCourseForStudent(course) : course
    )),
    phoneLoginCourseIds: studentPhoneLoginCourseIds,
    publicCourseIds: [],
  })
}))

app.post('/api/student-auth/login', requireDatabase, asyncHandler(async (req, res) => {
  if (!isStudentAuthRequired()) {
    res.status(400).json({ error: 'Student login is not enabled' })
    return
  }

  await ensureDb()
  const phone = normalizePhone(req.body?.phone)
  const password = String(req.body?.password ?? '')

  if (!isValidPhone(phone) || !password) {
    res.status(400).json({ error: 'יש להזין טלפון וסיסמה תקינים' })
    return
  }

  const result = await pool.query(
    `SELECT id, phone, name, active, password_hash,
            course_ids,
            locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
            last_denied_ip_address, last_denied_user_agent, last_denied_at,
            created_at, updated_at, last_login_at
     FROM marathon_students
     WHERE phone = $1`,
    [phone],
  )

  if (result.rowCount === 0 || !result.rows[0].active) {
    res.status(401).json({ error: 'טלפון או סיסמה שגויים' })
    return
  }

  let studentRow = result.rows[0]
  const isPasswordValid = await verifyPassword(password, studentRow.password_hash)
  if (!isPasswordValid) {
    res.status(401).json({ error: 'טלפון או סיסמה שגויים' })
    return
  }

  const currentIpAddress = requestIp(req)
  const currentUserAgent = requestUserAgent(req)
  let deviceToken = parseCookies(req)[studentDeviceCookie]
  if (!deviceToken) {
    deviceToken = randomBytes(32).toString('base64url')
  }
  const currentDeviceId = hashDeviceToken(deviceToken)
  const shouldUseDeviceLock = isStudentDeviceLockRequiredForCourseIds(studentRow.course_ids)
  const shouldUseSingleSession = isStudentSingleSessionRequiredForCourseIds(studentRow.course_ids)

  if (shouldUseDeviceLock) {
    if (studentRow.locked_device_id && studentRow.locked_device_id !== currentDeviceId) {
      await pool.query(
        `UPDATE marathon_students
         SET last_denied_ip_address = $2,
             last_denied_user_agent = $3,
             last_denied_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [studentRow.id, currentIpAddress, currentUserAgent],
      )
      clearStudentSessionCookie(req, res)
      res.status(403).json({
        error: 'המשתמש נעול למחשב אחר. אם החלפת מחשב או דפדפן, צריך לבקש מהאדמין לאפס את נעילת המכשיר.',
      })
      return
    }

    const deviceLockResult = await pool.query(
      `UPDATE marathon_students
       SET locked_device_id = CASE WHEN locked_device_id = '' THEN $2 ELSE locked_device_id END,
           locked_device_at = CASE WHEN locked_device_id = '' THEN now() ELSE locked_device_at END,
           locked_device_ip_address = CASE WHEN locked_device_id = '' THEN $3 ELSE locked_device_ip_address END,
           locked_device_user_agent = CASE WHEN locked_device_id = '' THEN $4 ELSE locked_device_user_agent END,
           updated_at = now()
       WHERE id = $1
         AND (locked_device_id = '' OR locked_device_id = $2)
       RETURNING id, phone, name, active, password_hash,
                 course_ids,
                 locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
                 last_denied_ip_address, last_denied_user_agent, last_denied_at,
                 created_at, updated_at, last_login_at`,
      [studentRow.id, currentDeviceId, currentIpAddress, currentUserAgent],
    )

    if (deviceLockResult.rowCount === 0) {
      await pool.query(
        `UPDATE marathon_students
         SET last_denied_ip_address = $2,
             last_denied_user_agent = $3,
             last_denied_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [studentRow.id, currentIpAddress, currentUserAgent],
      )
      clearStudentSessionCookie(req, res)
      res.status(403).json({
        error: 'המשתמש נעול למחשב אחר. אם החלפת מחשב או דפדפן, צריך לבקש מהאדמין לאפס את נעילת המכשיר.',
      })
      return
    }

    studentRow = deviceLockResult.rows[0]
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + studentSessionDays * 24 * 60 * 60 * 1000)
  const currentSessionToken = parseCookies(req)[studentSessionCookie]
  const currentSessionId = currentSessionToken ? hashSessionToken(currentSessionToken) : ''

  await pool.query('DELETE FROM marathon_student_sessions WHERE expires_at <= now()')
  if (shouldUseSingleSession) {
    if (!shouldUseDeviceLock) {
      const activeSessions = await pool.query(
        `SELECT id
         FROM marathon_student_sessions
         WHERE student_id = $1
           AND expires_at > now()
           AND id <> $2
         LIMIT 1`,
        [studentRow.id, currentSessionId],
      )

      if (activeSessions.rowCount > 0) {
        res.status(409).json({
          error: 'המשתמש כבר מחובר ממכשיר אחר. צריך לצאת מהמכשיר הקודם או לבקש מהאדמין לנתק סשנים.',
        })
        return
      }
    }

    await pool.query('DELETE FROM marathon_student_sessions WHERE student_id = $1', [studentRow.id])
  }

  await pool.query(
    `INSERT INTO marathon_student_sessions (id, student_id, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [hashSessionToken(token), studentRow.id, expiresAt, currentIpAddress, currentUserAgent],
  )
  const updatedStudent = await pool.query(
    `UPDATE marathon_students
     SET last_login_at = now(), updated_at = now()
     WHERE id = $1
     RETURNING id, phone, name, active,
               course_ids,
               locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
               last_denied_ip_address, last_denied_user_agent, last_denied_at,
               created_at, updated_at, last_login_at`,
    [studentRow.id],
  )

  if (shouldUseDeviceLock) {
    setStudentDeviceCookie(req, res, deviceToken)
  }
  clearStudentPhoneAccessCookie(req, res)
  setStudentSessionCookie(req, res, token, expiresAt)
  res.json({ student: serializeStudent(updatedStudent.rows[0]) })
}))

app.post('/api/student-auth/phone-login', requireDatabase, asyncHandler(async (req, res) => {
  if (!isStudentAuthRequired() || studentPhoneLoginCourseIds.length === 0) {
    res.status(400).json({ error: 'Phone login is not enabled' })
    return
  }

  const phone = normalizePhone(req.body?.phone)
  if (!isValidPhone(phone)) {
    res.status(400).json({ error: 'יש להזין מספר טלפון תקין' })
    return
  }

  const overrides = await loadContentOverridesFromDatabase()
  const courseIds = getPhoneLoginCourseIdsForPhone(phone, overrides)
  if (courseIds.length === 0) {
    clearStudentPhoneAccessCookie(req, res)
    res.status(401).json({ error: 'הטלפון לא נמצא ברשימת המורשים לקורס מודלים חישוביים' })
    return
  }

  if (courseIds.length > 1) {
    clearStudentPhoneAccessCookie(req, res)
    res.status(409).json({
      error: 'הטלפון מופיע ביותר מקבוצת מודלים אחת. צריך להסיר כפילות באדמין לפני כניסה.',
    })
    return
  }

  const expiresAt = Date.now() + studentSessionDays * 24 * 60 * 60 * 1000
  const phoneAccess = {
    type: 'phone',
    phone,
    name: '',
    courseIds,
    expiresAt,
  }

  clearStudentSessionCookie(req, res)
  setStudentPhoneAccessCookie(req, res, phoneAccess)
  res.json({ phoneAccess })
}))

app.post('/api/student-auth/course-login', requireDatabase, asyncHandler(async (req, res) => {
  if (!isStudentAuthRequired() || studentPhoneLoginCourseIds.length === 0) {
    res.status(400).json({ error: 'Course choice login is not enabled' })
    return
  }

  const courseId = String(req.body?.courseId ?? '').trim()
  const overrides = await loadContentOverridesFromDatabase()
  const course = getPhoneLoginCourseById(courseId, overrides)
  if (!course) {
    clearStudentPhoneAccessCookie(req, res)
    res.status(404).json({ error: 'קבוצת המודלים שנבחרה לא נמצאה' })
    return
  }

  const option = createPhoneLoginCourseOption(
    course,
    getPhoneLoginCourseOptions(overrides).findIndex((item) => item.id === String(course.id)),
  )
  const expiresAt = Date.now() + studentSessionDays * 24 * 60 * 60 * 1000
  const phoneAccess = {
    type: 'course-choice',
    phone: '',
    name: option.label,
    courseIds: [String(course.id)],
    expiresAt,
  }

  clearStudentSessionCookie(req, res)
  setStudentPhoneAccessCookie(req, res, phoneAccess)
  res.json({ phoneAccess })
}))

app.post('/api/student-auth/logout', asyncHandler(async (req, res) => {
  const token = parseCookies(req)[studentSessionCookie]
  if (pool && token) {
    await ensureDb()
    await pool.query('DELETE FROM marathon_student_sessions WHERE id = $1', [hashSessionToken(token)])
  }

  clearStudentSessionCookie(req, res)
  clearStudentPhoneAccessCookie(req, res)
  res.status(204).end()
}))

app.get('/api/student-auth/me', asyncHandler(async (req, res) => {
  const student = await getAuthenticatedStudent(req)
  const phoneAccess = student ? null : getAuthenticatedPhoneAccess(req)

  res.json({
    authenticated: Boolean(student || phoneAccess),
    student,
    phoneAccess,
  })
}))

app.get('/api/students', requireDatabase, requireAdmin, asyncHandler(async (_req, res) => {
  await ensureDb()
  const result = await pool.query(
    `SELECT students.id, students.phone, students.name, students.active,
            students.course_ids,
            students.locked_device_id, students.locked_device_at,
            students.locked_device_ip_address, students.locked_device_user_agent,
            students.last_denied_ip_address, students.last_denied_user_agent, students.last_denied_at,
            students.created_at, students.updated_at, students.last_login_at,
            count(sessions.id) FILTER (WHERE sessions.expires_at > now()) AS active_session_count
     FROM marathon_students students
     LEFT JOIN marathon_student_sessions sessions ON sessions.student_id = students.id
     GROUP BY students.id
     ORDER BY students.created_at DESC`,
  )

  res.json({ students: result.rows.map((row) => serializeStudent(row)) })
}))

app.post('/api/students', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const phone = normalizePhone(req.body?.phone)
  const name = String(req.body?.name ?? '').trim()
  const courseIds = normalizeCourseIds(req.body?.courseIds)
  const requestedPassword = String(req.body?.password ?? '').trim()
  const password = requestedPassword || generatePassword()

  if (!isValidPhone(phone)) {
    res.status(400).json({ error: 'Invalid phone number' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  if (courseIds.length === 0) {
    res.status(400).json({ error: 'Student must be assigned to a course' })
    return
  }

  const passwordHash = await hashPassword(password)

  try {
    const result = await pool.query(
      `INSERT INTO marathon_students (id, phone, name, password_hash, active, course_ids)
       VALUES ($1, $2, $3, $4, true, $5::jsonb)
       RETURNING id, phone, name, active,
                 course_ids,
                 locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
                 last_denied_ip_address, last_denied_user_agent, last_denied_at,
                 created_at, updated_at, last_login_at`,
      [createId(), phone, name, passwordHash, JSON.stringify(courseIds)],
    )

    const student = result.rows[0]
    const whatsApp = await sendCredentialsWhatsApp({ student, password })

    res.status(201).json({ student: serializeStudent(student), password, whatsApp })
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Student already exists' })
      return
    }

    throw error
  }
}))

app.patch('/api/students/:id', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const hasName = Object.hasOwn(req.body ?? {}, 'name')
  const hasActive = Object.hasOwn(req.body ?? {}, 'active')
  const hasCourseIds = Object.hasOwn(req.body ?? {}, 'courseIds')
  const nextName = hasName ? String(req.body.name ?? '').trim() : null
  const nextActive = hasActive ? Boolean(req.body.active) : null
  const nextCourseIds = hasCourseIds ? normalizeCourseIds(req.body.courseIds) : null

  if (hasCourseIds && nextCourseIds.length === 0) {
    res.status(400).json({ error: 'Student must be assigned to a course' })
    return
  }

  const result = await pool.query(
    `UPDATE marathon_students
     SET name = CASE WHEN $2::boolean THEN $3 ELSE name END,
         active = COALESCE($4, active),
         course_ids = CASE WHEN $5::boolean THEN $6::jsonb ELSE course_ids END,
         updated_at = now()
     WHERE id = $1
     RETURNING id, phone, name, active,
               course_ids,
               locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
               last_denied_ip_address, last_denied_user_agent, last_denied_at,
               created_at, updated_at, last_login_at`,
    [req.params.id, hasName, nextName, nextActive, hasCourseIds, JSON.stringify(nextCourseIds ?? [])],
  )

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Student not found' })
    return
  }

  if (hasActive && nextActive === false) {
    await pool.query('DELETE FROM marathon_student_sessions WHERE student_id = $1', [req.params.id])
  }

  res.json({ student: serializeStudent(result.rows[0]) })
}))

app.post('/api/students/:id/sessions/revoke', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const deletedSessions = await pool.query(
    'DELETE FROM marathon_student_sessions WHERE student_id = $1',
    [req.params.id],
  )
  const result = await pool.query(
    `SELECT id, phone, name, active,
            course_ids,
            locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
            last_denied_ip_address, last_denied_user_agent, last_denied_at,
            created_at, updated_at, last_login_at,
            0 AS active_session_count
     FROM marathon_students
     WHERE id = $1`,
    [req.params.id],
  )

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Student not found' })
    return
  }

  res.json({
    revokedSessions: deletedSessions.rowCount,
    student: serializeStudent(result.rows[0]),
  })
}))

app.post('/api/students/:id/device-lock/reset', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const deletedSessions = await pool.query(
    'DELETE FROM marathon_student_sessions WHERE student_id = $1',
    [req.params.id],
  )
  const result = await pool.query(
    `UPDATE marathon_students
     SET locked_device_id = '',
         locked_device_at = NULL,
         locked_device_ip_address = '',
         locked_device_user_agent = '',
         last_denied_ip_address = '',
         last_denied_user_agent = '',
         last_denied_at = NULL,
         updated_at = now()
     WHERE id = $1
     RETURNING id, phone, name, active,
               course_ids,
               locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
               last_denied_ip_address, last_denied_user_agent, last_denied_at,
               created_at, updated_at, last_login_at,
               0 AS active_session_count`,
    [req.params.id],
  )

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Student not found' })
    return
  }

  res.json({
    revokedSessions: deletedSessions.rowCount,
    student: serializeStudent(result.rows[0]),
  })
}))

app.post('/api/students/:id/password', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const requestedPassword = String(req.body?.password ?? '').trim()
  const password = requestedPassword || generatePassword()

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  const passwordHash = await hashPassword(password)
  const result = await pool.query(
    `UPDATE marathon_students
     SET password_hash = $2, active = true, updated_at = now()
     WHERE id = $1
     RETURNING id, phone, name, active,
               course_ids,
               locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
               last_denied_ip_address, last_denied_user_agent, last_denied_at,
               created_at, updated_at, last_login_at`,
    [req.params.id, passwordHash],
  )

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Student not found' })
    return
  }

  await pool.query('DELETE FROM marathon_student_sessions WHERE student_id = $1', [req.params.id])

  const student = result.rows[0]
  const whatsApp = await sendCredentialsWhatsApp({ student, password })

  res.json({ student: serializeStudent(student), password, whatsApp })
}))

app.use(asyncHandler(requireStudentAuth))

app.get('/api/content', asyncHandler(async (req, res) => {
  if (!pool) {
    res.json({ overrides: {}, updatedAt: null, shared: false })
    return
  }

  await ensureDb()
  const result = await pool.query('SELECT overrides, updated_at FROM marathon_content WHERE id = $1', ['default'])
  const overrides = shouldEnforceStudentCourseAccess()
    ? filterContentOverridesForCourses(result.rows[0]?.overrides ?? {}, getAccessibleCourseIdsForRequest(req))
    : result.rows[0]?.overrides ?? {}

  res.json({
    overrides,
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

app.get('/api/materials', requireDatabase, requireStudentCourseFromQuery, asyncHandler(async (req, res) => {
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
    'SELECT course_id, file_name, type, data FROM marathon_materials WHERE id = $1',
    [req.params.id],
  )

  if (result.rowCount === 0) {
    res.status(404).send('Not found')
    return
  }

  const row = result.rows[0]
  if (!studentCanAccessCourse(req, row.course_id)) {
    rejectStudentCourseAccess(res)
    return
  }

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

app.get('/api/deleted-materials', requireDatabase, requireStudentCourseFromQuery, asyncHandler(async (req, res) => {
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

app.get('/api/requests', requireDatabase, requireStudentCourseFromQuery, asyncHandler(async (req, res) => {
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
  if (!studentCanAccessCourse(req, courseId)) {
    rejectStudentCourseAccess(res)
    return
  }

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
    'SELECT course_id, file_name, file_type, data FROM marathon_requests WHERE id = $1 AND data IS NOT NULL',
    [req.params.id],
  )

  if (result.rowCount === 0) {
    res.status(404).send('Not found')
    return
  }

  const row = result.rows[0]
  if (!studentCanAccessCourse(req, row.course_id)) {
    rejectStudentCourseAccess(res)
    return
  }

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
