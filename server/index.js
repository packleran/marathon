import express from 'express'
import multer from 'multer'
import dns from 'node:dns/promises'
import path from 'node:path'
import { createHash, createHmac, createSign, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import nodemailer from 'nodemailer'
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
const studentPhoneAccessCookie = 'marathon_phone_access'
const configuredStudentSessionDays = Number(process.env.STUDENT_SESSION_DAYS ?? 30)
const studentSessionDays = Number.isFinite(configuredStudentSessionDays)
  ? Math.max(1, configuredStudentSessionDays)
  : 30
const disabledAuthValues = new Set(['0', 'false', 'no', 'off'])
const passwordOnlyCourseChoiceCourseIds = ['computational']
const passwordOnlyCourseChoiceCourseIdSet = new Set(passwordOnlyCourseChoiceCourseIds)
const defaultCourseChoiceCourseIds = ['probability']
const configuredCourseChoiceCourseIds = normalizeCourseIds(
  process.env.STUDENT_PHONE_LOGIN_COURSE_IDS ?? process.env.STUDENT_PUBLIC_COURSE_IDS ?? defaultCourseChoiceCourseIds,
)
const studentPhoneLoginCourseIds = [...new Set([...defaultCourseChoiceCourseIds, ...configuredCourseChoiceCourseIds])]
  .filter((courseId) => !isPasswordOnlyCourseChoiceCourseId(courseId))
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
const smtpHost = process.env.SMTP_HOST ?? ''
const smtpPort = Number(process.env.SMTP_PORT ?? 587)
const smtpSecure = String(process.env.SMTP_SECURE ?? '').toLowerCase() === 'true'
const smtpFamily = Number(process.env.SMTP_FAMILY ?? 4)
const smtpUser = process.env.SMTP_USER ?? ''
const smtpPass = process.env.SMTP_PASS ?? ''
const mailFrom = process.env.MAIL_FROM ?? process.env.SMTP_FROM ?? smtpUser
const accessRequestAdminEmail = process.env.ACCESS_REQUEST_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? ''
const accessRequestAdminBaseUrl = normalizeHttpOrigin(
  process.env.ACCESS_REQUEST_ADMIN_BASE_URL ?? process.env.ADMIN_PUBLIC_URL ?? '',
)
const studentPublicBaseUrl = normalizeHttpOrigin(
  process.env.STUDENT_PUBLIC_BASE_URL ?? process.env.STUDENT_PUBLIC_URL ?? '',
)
const muxTokenId = process.env.MUX_TOKEN_ID ?? ''
const muxTokenSecret = process.env.MUX_TOKEN_SECRET ?? ''
const muxSigningKeyId = process.env.MUX_SIGNING_KEY_ID ?? ''
const muxSigningPrivateKey = process.env.MUX_SIGNING_PRIVATE_KEY ?? ''
const muxEnvKey = process.env.MUX_ENV_KEY ?? process.env.VITE_MUX_ENV_KEY ?? ''
const muxPlaybackRestrictionId = process.env.MUX_PLAYBACK_RESTRICTION_ID ?? ''
const muxDirectUploadCorsOrigin = process.env.MUX_DIRECT_UPLOAD_CORS_ORIGIN ?? ''
const muxPlaybackTokenSeconds = Number(process.env.MUX_PLAYBACK_TOKEN_SECONDS ?? 4 * 60 * 60)
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

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeLoginIdentifier(value) {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) return { raw: '', phone: '', username: '' }

  const phone = normalizePhone(rawValue)
  const isPhoneLike = /^\+?[\d\s().-]+$/.test(rawValue) && isValidPhone(phone)

  return {
    raw: rawValue,
    phone: isPhoneLike ? phone : '',
    username: isPhoneLike ? phone : rawValue.toLowerCase(),
  }
}

function isValidUsername(username) {
  return /^[a-z0-9][a-z0-9._-]{2,39}$/i.test(String(username ?? ''))
}

function usernameSeedFromEmail(email) {
  const [localPart = 'student'] = normalizeEmail(email).split('@')
  const seed = localPart
    .split('+')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 24)

  return isValidUsername(seed) ? seed : 'student'
}

function normalizeCourseIds(value) {
  const values = Array.isArray(value) ? value : [value]
  return [...new Set(values
    .map((item) => String(item ?? '').trim())
    .filter(Boolean))]
}

function isPasswordOnlyCourseChoiceCourseId(courseId) {
  const normalizedCourseId = String(courseId ?? '').trim()
  if (!normalizedCourseId) return false
  if (passwordOnlyCourseChoiceCourseIdSet.has(normalizedCourseId)) return true

  return passwordOnlyCourseChoiceCourseIds.some((rootId) => (
    normalizedCourseId.startsWith(`${rootId}-group-`)
  ))
}

function rootCourseId(course) {
  return String(course?.sourceCourseId ?? course?.id ?? '').trim()
}

function courseText(course) {
  return `${course?.name ?? ''} ${course?.subtitle ?? ''}`.trim()
}

function isPhoneLoginCourseId(courseId) {
  const normalizedCourseId = String(courseId ?? '').trim()
  if (studentPhoneLoginCourseIdSet.has(normalizedCourseId)) return true

  return studentPhoneLoginCourseIds.some((rootId) => normalizedCourseId.startsWith(`${rootId}-group-`))
}

function isAlgorithmBoostCourse(course) {
  const courseId = String(course?.id ?? '').trim()
  return rootCourseId(course) === 'algorithms' && courseId !== 'algorithms' && courseText(course).includes('תגבור')
}

function isPhoneLoginCourse(course) {
  return isPhoneLoginCourseId(rootCourseId(course)) || isAlgorithmBoostCourse(course)
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

async function generateUniqueUsername(client, email) {
  const seed = usernameSeedFromEmail(email)

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = randomBytes(3).toString('hex')
    const username = `${seed.slice(0, 24)}.${suffix}`.replace(/^[._-]+|[._-]+$/g, '')
    if (!isValidUsername(username)) continue

    const result = await client.query(
      'SELECT 1 FROM marathon_students WHERE lower(username) = lower($1) LIMIT 1',
      [username],
    )
    if (result.rowCount === 0) return username
  }

  return `student.${randomUUID().slice(0, 8).toLowerCase()}`
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

function hashAccessRequestToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function signValue(value, secret = studentPhoneAccessSecret) {
  return createHmac('sha256', secret).update(value).digest('base64url')
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

    if (parsed.type !== 'course-choice') return null

    return {
      type: 'course-choice',
      phone: '',
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

function isMuxApiConfigured() {
  return Boolean(muxTokenId && muxTokenSecret)
}

function isMuxSigningConfigured() {
  return Boolean(muxSigningKeyId && muxSigningPrivateKey)
}

function muxAuthorizationHeader() {
  return `Basic ${Buffer.from(`${muxTokenId}:${muxTokenSecret}`).toString('base64')}`
}

async function muxApi(pathname, options = {}) {
  if (!isMuxApiConfigured()) {
    throw new Error('Mux API credentials are not configured')
  }

  const headers = {
    Authorization: muxAuthorizationHeader(),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers ?? {}),
  }

  const response = await fetch(`https://api.mux.com${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data.error?.messages?.join(', ') || data.error?.message || `Mux request failed with ${response.status}`
    throw new Error(message)
  }

  return data.data
}

function normalizeHttpOrigin(value) {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) return ''

  try {
    return new URL(rawValue).origin
  } catch {
    return rawValue.replace(/\/+$/, '')
  }
}

function getRequestOrigin(req) {
  const configuredOrigin = normalizeHttpOrigin(muxDirectUploadCorsOrigin)
  if (configuredOrigin) return configuredOrigin

  const requestOrigin = normalizeHttpOrigin(req.headers.origin)
  if (requestOrigin) return requestOrigin

  const proto = req.headers['x-forwarded-proto'] ?? req.protocol
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  return normalizeHttpOrigin(`${proto}://${host}`)
}

async function createMuxDirectUpload(req) {
  const corsOrigin = getRequestOrigin(req)
  return muxApi('/video/v1/uploads', {
    method: 'POST',
    body: {
      cors_origin: corsOrigin,
      new_asset_settings: {
        playback_policies: ['signed'],
        video_quality: 'basic',
      },
    },
  }).then((uploadSession) => ({
    ...uploadSession,
    cors_origin: uploadSession?.cors_origin ?? corsOrigin,
  }))
}

async function createMuxAssetFromUrl(sourceUrl) {
  return muxApi('/video/v1/assets', {
    method: 'POST',
    body: {
      input: sourceUrl,
      playback_policies: ['signed'],
      video_quality: 'basic',
    },
  })
}

async function getMuxAsset(assetId) {
  if (!assetId) return null
  return muxApi(`/video/v1/assets/${encodeURIComponent(assetId)}`)
}

async function getMuxUpload(uploadId) {
  if (!uploadId) return null
  return muxApi(`/video/v1/uploads/${encodeURIComponent(uploadId)}`)
}

function firstMuxPlaybackId(asset) {
  return asset?.playback_ids?.[0]?.id ?? ''
}

function muxAssetDurationSeconds(asset) {
  const duration = Number(asset?.duration ?? 0)
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0
}

function normalizeMuxPrivateKey(value) {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) return ''

  const withLineBreaks = rawValue.replace(/\\n/g, '\n')
  if (withLineBreaks.includes('BEGIN')) return withLineBreaks

  try {
    const decoded = Buffer.from(rawValue, 'base64').toString('utf8').replace(/\\n/g, '\n')
    if (decoded.includes('BEGIN')) return decoded
  } catch {
    // Keep the original value below so the crypto layer returns a useful error.
  }

  return withLineBreaks
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signMuxJwt(payload) {
  if (!isMuxSigningConfigured()) {
    throw new Error('Mux signing key is not configured')
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: muxSigningKeyId,
  }
  const unsignedToken = `${base64urlJson(header)}.${base64urlJson(payload)}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsignedToken)
  signer.end()

  const signature = signer.sign(normalizeMuxPrivateKey(muxSigningPrivateKey)).toString('base64url')
  return `${unsignedToken}.${signature}`
}

function muxPlaybackTokenTtlSeconds(recording) {
  const configuredSeconds = Number.isFinite(muxPlaybackTokenSeconds) && muxPlaybackTokenSeconds > 0
    ? muxPlaybackTokenSeconds
    : 4 * 60 * 60
  const durationSeconds = Number(recording?.duration_seconds ?? recording?.durationSeconds ?? 0)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return configuredSeconds

  return Math.max(configuredSeconds, Math.ceil(durationSeconds) + 10 * 60)
}

function createMuxPlaybackToken(playbackId, audience, recording) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: playbackId,
    aud: audience,
    exp: now + muxPlaybackTokenTtlSeconds(recording),
    nbf: now - 5,
    kid: muxSigningKeyId,
  }

  if (muxPlaybackRestrictionId) {
    payload.playback_restriction_id = muxPlaybackRestrictionId
  }

  return signMuxJwt(payload)
}

function maskPhoneForLog(phone) {
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) return ''

  return `***${normalizedPhone.slice(-4)}`
}

function serializeStudent(row) {
  const courseIds = normalizeCourseIds(row.course_ids ?? [])

  return {
    id: row.id,
    phone: row.phone ?? '',
    username: row.username || row.phone || '',
    email: row.email ?? '',
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

function serializeAccessRequest(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    studentId: row.student_id ?? '',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    notifiedAt: toIso(row.notified_at),
    approvedAt: toIso(row.approved_at),
    rejectedAt: toIso(row.rejected_at),
    credentialsSentAt: toIso(row.credentials_sent_at),
  }
}

function createWhatsAppStatus(status, text, extra = {}) {
  return { status, text, ...extra }
}

function createMailStatus(status, text, extra = {}) {
  return { status, text, ...extra }
}

function isMailConfigured() {
  return Boolean(smtpHost && mailFrom)
}

async function createMailTransport(options = {}) {
  if (!isMailConfigured()) return null

  const host = options.host ?? smtpHost
  const port = Number(options.port ?? smtpPort)
  const secure = options.secure ?? smtpSecure
  const family = smtpFamily === 6 ? 6 : 4
  const resolvedHost = family === 4 && !/^\d+\.\d+\.\d+\.\d+$/.test(host)
    ? (await dns.resolve4(host))[0] ?? host
    : host

  return nodemailer.createTransport({
    host: resolvedHost,
    port: Number.isFinite(port) ? port : 587,
    secure,
    requireTLS: options.requireTLS ?? (!secure && port === 587),
    family,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 15000),
    servername: host,
    tls: { servername: host },
    auth: smtpUser || smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  })
}

function getMailTransportAttempts() {
  const attempts = [{ host: smtpHost, port: smtpPort, secure: smtpSecure }]
  if (smtpHost === 'smtp.gmail.com' && smtpPort !== 587) {
    attempts.push({ host: smtpHost, port: 587, secure: false, requireTLS: true })
  }

  return attempts
}

function withTimeout(promise, timeoutMs, message) {
  let timeout
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    return createMailStatus('skipped', 'SMTP לא מוגדר בשרת')
  }

  if (!to) {
    return createMailStatus('skipped', 'לא הוגדרה כתובת מייל לשליחה')
  }

  let transport = null
  let lastError = null
  try {
    const sendTimeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS ?? 12000)
    let info = null

    for (const attempt of getMailTransportAttempts()) {
      try {
        info = await withTimeout((async () => {
          transport = await createMailTransport(attempt)
          return transport.sendMail({
            from: mailFrom,
            to,
            subject,
            text,
            html,
          })
        })(), sendTimeoutMs, `SMTP timed out after ${sendTimeoutMs}ms`)
        break
      } catch (error) {
        lastError = error
      } finally {
        if (transport) {
          transport.close()
          transport = null
        }
      }
    }

    if (!info) throw lastError ?? new Error('SMTP send failed')

    return createMailStatus('sent', 'המייל נשלח', { messageId: info.messageId })
  } catch (error) {
    return createMailStatus('failed', `שליחת המייל נכשלה: ${error.message}`)
  } finally {
    if (transport) {
      transport.close()
    }
  }
}

function createCredentialLoginUrl(req) {
  const baseUrl = studentPublicBaseUrl || getRequestBaseUrl(req)
  return `${baseUrl}/student-login`
}

async function sendAdminAccessRequestEmail({ accessRequest, approvalUrl }) {
  const subject = `בקשת גישה חדשה: ${accessRequest.full_name}`
  const text = [
    'התקבלה בקשת גישה חדשה לאתר המרתון.',
    '',
    `שם מלא: ${accessRequest.full_name}`,
    `מייל: ${accessRequest.email}`,
    '',
    `לאישור הבקשה: ${approvalUrl}`,
  ].join('\n')

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1d29;">
      <h2 style="margin: 0 0 12px;">בקשת גישה חדשה</h2>
      <p style="margin: 0 0 16px;">סטודנט ביקש לפתוח שם משתמש וסיסמה לאתר המרתון.</p>
      <p style="margin: 0 0 6px;"><strong>שם מלא:</strong> ${escapeHtml(accessRequest.full_name)}</p>
      <p style="margin: 0 0 18px;"><strong>מייל:</strong> ${escapeHtml(accessRequest.email)}</p>
      <p style="margin: 0;">
        <a href="${escapeHtml(approvalUrl)}" style="display: inline-block; border-radius: 10px; background: #4c57d4; color: #fff; padding: 10px 16px; text-decoration: none; font-weight: 700;">
          פתיחת מסך אישור
        </a>
      </p>
      <p style="margin: 18px 0 0; color: #565c6e; font-size: 13px;">
        אם הכפתור לא נפתח, אפשר להעתיק את הקישור: ${escapeHtml(approvalUrl)}
      </p>
    </div>
  `

  return sendMail({
    to: accessRequestAdminEmail,
    subject,
    text,
    html,
  })
}

async function sendStudentCredentialsEmail({ req, student, password }) {
  const username = student.username || student.phone || student.email
  const loginUrl = createCredentialLoginUrl(req)
  const subject = 'פרטי הכניסה שלך לאתר המרתון'
  const text = [
    `שלום${student.name ? ` ${student.name}` : ''},`,
    '',
    'הגישה שלך לאתר המרתון נפתחה.',
    `שם משתמש: ${username}`,
    `סיסמה: ${password}`,
    '',
    `כניסה לאתר: ${loginUrl}`,
  ].join('\n')

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1d29;">
      <h2 style="margin: 0 0 12px;">פרטי הכניסה שלך לאתר המרתון</h2>
      <p style="margin: 0 0 16px;">שלום${student.name ? ` ${escapeHtml(student.name)}` : ''}, הגישה שלך נפתחה.</p>
      <div dir="ltr" style="display: inline-block; text-align: left; border: 1px solid #e7e9f0; border-radius: 12px; padding: 12px 14px; background: #f7f8fa;">
        <div><strong>Username:</strong> ${escapeHtml(username)}</div>
        <div><strong>Password:</strong> ${escapeHtml(password)}</div>
      </div>
      <p style="margin: 18px 0 0;">
        <a href="${escapeHtml(loginUrl)}" style="display: inline-block; border-radius: 10px; background: #4c57d4; color: #fff; padding: 10px 16px; text-decoration: none; font-weight: 700;">
          כניסה לאתר
        </a>
      </p>
    </div>
  `

  return sendMail({
    to: student.email,
    subject,
    text,
    html,
  })
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

function createGenericCourseChoiceOption(course) {
  const rootLabels = {
    probability: 'הסתברות',
  }
  const rootId = rootCourseId(course)
  const courseId = String(course.id)
  const name = String(course.name ?? '').trim()

  return {
    id: courseId,
    label: courseId === rootId && rootLabels[rootId] ? rootLabels[rootId] : name || rootLabels[rootId] || courseId,
    name,
    sourceCourseId: String(course.sourceCourseId ?? course.id),
  }
}

function createPhoneLoginCourseOption(course, index) {
  const rootId = rootCourseId(course)

  if (rootId === 'algorithms') {
    const text = courseText(course)
    const fallbackName = String(course.name ?? '').replace('תכנון אלגוריתמים', '').replace(/^[-–\s]+/, '').trim()

    return {
      id: String(course.id),
      label: text.includes('תגבור') ? 'תגבור' : fallbackName || String(course.name ?? 'תכנון אלגוריתמים'),
      name: String(course.name ?? ''),
      sourceCourseId: String(course.sourceCourseId ?? course.id),
    }
  }

  if (rootId !== 'computational') {
    return createGenericCourseChoiceOption(course)
  }

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
  const rootIndexes = new Map()

  return applyServerCourseOverrides(courses, overrides)
    .filter((course) => isPhoneLoginCourse(course))
    .map((course) => {
      const rootId = rootCourseId(course)
      const index = rootIndexes.get(rootId) ?? 0
      rootIndexes.set(rootId, index + 1)
      return createPhoneLoginCourseOption(course, index)
    })
}

function getPhoneLoginCourseById(courseId, overrides) {
  const normalizedCourseId = String(courseId ?? '').trim()
  if (!normalizedCourseId) return null

  return applyServerCourseOverrides(courses, overrides)
    .find((course) => isPhoneLoginCourse(course) && String(course.id) === normalizedCourseId) ?? null
}

function getStudentAccessCourseOptions(overrides) {
  return applyServerCourseOverrides(courses, overrides).map((course) => ({
    id: String(course.id),
    label: courseText(course) || String(course.name ?? course.id),
  }))
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
    req.path === '/api/student-auth/logout' ||
    req.path === '/api/student-access-requests'
  )
}

function isPublicStudentAppShellRequest(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (req.path.startsWith('/assets/')) return true
  if (req.path === '/favicon.svg' || req.path === '/icons.svg') return true

  return !path.extname(req.path) && req.accepts('html')
}

function canServeAnonymousStudentRequest(req) {
  if (shouldEnforceStudentCourseAccess() && req.path === '/api/student-access-requests') {
    return true
  }

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
      .divider {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 26px 0 18px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }
      .divider::before,
      .divider::after {
        content: "";
        height: 1px;
        flex: 1;
        background: var(--border);
      }
      .secondary-title {
        margin: 0 0 6px;
        font-size: 17px;
        line-height: 1.35;
      }
      .error,
      .success {
        display: none;
        margin-top: 14px;
        font-size: 13px;
        line-height: 1.5;
      }
      .error { color: var(--danger); }
      .success { color: #168a4a; }
      .error[data-visible="true"] { display: block; }
      .success[data-visible="true"] { display: block; }
    </style>
  </head>
  <body>
    <main>
      <h1>כניסה לאתר הסטודנטים</h1>
      <p>הכניסה היא עם שם המשתמש והסיסמה שנשלחו אליך לאחר אישור הגישה.</p>
      <form data-login-form>
        <label>
          שם משתמש
          <input name="username" autocomplete="username" required autofocus />
        </label>
        <label>
          סיסמה
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit">כניסה</button>
        <div class="error" data-login-error role="alert"></div>
      </form>

      <div class="divider">בקשת גישה</div>
      <h2 class="secondary-title">אין לך שם משתמש?</h2>
      <p>אפשר לשלוח בקשת פתיחת גישה. לאחר אישור, פרטי הכניסה יישלחו אליך במייל.</p>
      <form data-request-form>
        <label>
          שם מלא
          <input name="fullName" autocomplete="name" required />
        </label>
        <label>
          מייל
          <input name="email" type="email" autocomplete="email" required />
        </label>
        <button type="submit">שליחת בקשה לאישור</button>
        <div class="success" data-request-success role="status"></div>
        <div class="error" data-request-error role="alert"></div>
      </form>
    </main>
    <script>
      const nextPath = ${htmlJson(nextPath)};
      const loginForm = document.querySelector('[data-login-form]');
      const requestForm = document.querySelector('[data-request-form]');
      const loginButton = loginForm.querySelector('button');
      const requestButton = requestForm.querySelector('button');
      const loginError = document.querySelector('[data-login-error]');
      const requestError = document.querySelector('[data-request-error]');
      const requestSuccess = document.querySelector('[data-request-success]');

      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        loginError.dataset.visible = 'false';
        loginButton.disabled = true;

        try {
          const formData = new FormData(loginForm);
          const response = await fetch('/api/student-auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: String(formData.get('username') || '').trim(),
              password: String(formData.get('password') || '').trim()
            })
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'לא הצלחנו להתחבר. בדוק את הפרטים ונסה שוב.');
          }

          window.location.assign(nextPath);
        } catch (error) {
          loginError.textContent = error.message;
          loginError.dataset.visible = 'true';
          loginButton.disabled = false;
        }
      });

      requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        requestError.dataset.visible = 'false';
        requestSuccess.dataset.visible = 'false';
        requestButton.disabled = true;

        try {
          const formData = new FormData(requestForm);
          const response = await fetch('/api/student-access-requests', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: String(formData.get('fullName') || '').trim(),
              email: String(formData.get('email') || '').trim()
            })
          });

          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || 'לא הצלחנו לשלוח את הבקשה. נסה שוב.');
          }

          requestForm.reset();
          requestSuccess.textContent = 'הבקשה נשלחה לאישור. לאחר אישור, פרטי הכניסה יישלחו אליך במייל.';
          requestSuccess.dataset.visible = 'true';
        } catch (error) {
          requestError.textContent = error.message;
          requestError.dataset.visible = 'true';
        } finally {
          requestButton.disabled = false;
        }
      });
    </script>
  </body>
</html>`)
}

function sendAccessRequestApprovalPage(res, { accessRequest, courseOptions, token, result = null }) {
  const isPending = accessRequest?.status === 'pending'
  const optionsHtml = courseOptions.map((course) => (
    `<option value="${escapeHtml(course.id)}">${escapeHtml(course.label)}</option>`
  )).join('')
  const statusText = {
    approved: 'הבקשה כבר אושרה.',
    rejected: 'הבקשה נדחתה.',
    pending: '',
  }[accessRequest?.status] ?? 'סטטוס הבקשה אינו מאפשר פעולה.'

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(`<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>אישור בקשת גישה</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f8fa;
        --surface: #ffffff;
        --text: #1a1d29;
        --muted: #565c6e;
        --border: #e7e9f0;
        --primary: #4c57d4;
        --danger: #d14343;
        --success: #168a4a;
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
        width: min(100% - 32px, 520px);
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--surface);
        box-shadow: 0 12px 32px rgb(20 23 38 / 0.08), 0 2px 4px rgb(20 23 38 / 0.04);
        padding: 28px;
      }
      h1 { margin: 0 0 8px; font-size: 24px; line-height: 1.25; }
      p { margin: 0 0 18px; color: var(--muted); line-height: 1.6; }
      dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px 12px;
        margin: 0 0 20px;
      }
      dt { color: var(--muted); font-weight: 700; }
      dd { margin: 0; direction: ltr; text-align: left; }
      label {
        display: block;
        margin-top: 14px;
        font-size: 13px;
        font-weight: 700;
        color: var(--muted);
      }
      select {
        width: 100%;
        margin-top: 7px;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 13px;
        font: inherit;
        color: var(--text);
        background: #fff;
        outline: none;
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 22px;
      }
      button {
        width: 100%;
        border: 0;
        border-radius: 12px;
        color: #fff;
        padding: 12px 16px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .approve { background: var(--primary); }
      .reject { background: var(--danger); }
      .notice {
        border-radius: 12px;
        margin: 0 0 18px;
        padding: 12px 14px;
        font-size: 14px;
        line-height: 1.6;
      }
      .notice.success { color: var(--success); background: #eaf7ef; }
      .notice.error { color: var(--danger); background: #fdecec; }
      .credentials {
        direction: ltr;
        text-align: left;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>אישור בקשת גישה</h1>
      ${result ? `<div class="notice ${result.type}">${escapeHtml(result.text)}</div>` : ''}
      <dl>
        <dt>שם</dt>
        <dd dir="rtl" style="text-align: right;">${escapeHtml(accessRequest.full_name)}</dd>
        <dt>מייל</dt>
        <dd>${escapeHtml(accessRequest.email)}</dd>
        <dt>סטטוס</dt>
        <dd dir="rtl" style="text-align: right;">${escapeHtml(accessRequest.status)}</dd>
      </dl>
      ${isPending ? `
        <form method="post" action="/student-access-requests/${encodeURIComponent(accessRequest.id)}/approve">
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          <label>
            קורס לפתיחת גישה
            <select name="courseId" required>
              ${optionsHtml}
            </select>
          </label>
          <div class="actions">
            <button class="approve" type="submit">אישור ויצירת משתמש</button>
            <button class="reject" type="submit" formaction="/student-access-requests/${encodeURIComponent(accessRequest.id)}/reject">דחייה</button>
          </div>
        </form>
      ` : `<p>${escapeHtml(statusText)}</p>`}
      ${result?.credentials ? `
        <p class="credentials">
          Username: ${escapeHtml(result.credentials.username)}<br />
          Password: ${escapeHtml(result.credentials.password)}
        </p>
      ` : ''}
    </main>
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
  return `${getRequestBaseUrl(req)}${pathname}`
}

function getRequestBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] ?? req.protocol
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  return `${proto}://${host}`
}

function createAccessRequestApprovalUrl(req, accessRequestId, token) {
  const baseUrl = accessRequestAdminBaseUrl || getRequestBaseUrl(req)
  return `${baseUrl}/student-access-requests/${encodeURIComponent(accessRequestId)}/approve?token=${encodeURIComponent(token)}`
}

function getAccessRequestToken(req) {
  return String(req.query?.token ?? req.body?.token ?? '').trim()
}

function hasValidAccessRequestToken(row, token) {
  return Boolean(token && row?.admin_token_hash && safeEqualString(row.admin_token_hash, hashAccessRequestToken(token)))
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
    `SELECT sessions.id AS session_id, sessions.ip_address AS session_ip_address,
            sessions.user_agent AS session_user_agent,
            students.id, students.phone, students.username, students.email, students.name, students.active,
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

  req.studentSession = {
    id: result.rows[0].session_id,
    ipAddress: result.rows[0].session_ip_address ?? '',
    userAgent: result.rows[0].session_user_agent ?? '',
  }

  await pool.query(
    'UPDATE marathon_student_sessions SET last_seen_at = now() WHERE id = $1',
    [hashSessionToken(token)],
  ).catch(() => {})

  return serializeStudent(result.rows[0])
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

async function loadAccessRequest(accessRequestId, executor = pool, options = {}) {
  const result = await executor.query(
    `SELECT id, full_name, email, status, admin_token_hash, student_id,
            request_ip_address, request_user_agent,
            created_at, updated_at, notified_at, approved_at, rejected_at, credentials_sent_at
     FROM marathon_student_access_requests
     WHERE id = $1
     ${options.forUpdate ? 'FOR UPDATE' : ''}`,
    [accessRequestId],
  )

  return result.rows[0] ?? null
}

async function approveAccessRequest(req, { accessRequestId, token, courseIds }) {
  const normalizedCourseIds = normalizeCourseIds(courseIds)
  if (normalizedCourseIds.length === 0) {
    return { statusCode: 400, error: 'יש לבחור קורס לפתיחת הגישה' }
  }

  const courseOptions = getStudentAccessCourseOptions(await loadContentOverridesFromDatabase())
  const allowedCourseIds = new Set(courseOptions.map((course) => course.id))
  if (!normalizedCourseIds.every((courseId) => allowedCourseIds.has(courseId))) {
    return { statusCode: 400, error: 'הקורס שנבחר לא נמצא' }
  }

  const password = generatePassword()
  const passwordHash = await hashPassword(password)
  const client = await pool.connect()
  let student
  let accessRequest

  try {
    await client.query('BEGIN')
    accessRequest = await loadAccessRequest(accessRequestId, client, { forUpdate: true })

    if (!accessRequest) {
      await client.query('ROLLBACK')
      return { statusCode: 404, error: 'בקשת הגישה לא נמצאה' }
    }

    if (!isAdminService && !hasValidAccessRequestToken(accessRequest, token)) {
      await client.query('ROLLBACK')
      return { statusCode: 403, error: 'קישור האישור אינו תקין' }
    }

    if (accessRequest.status !== 'pending') {
      await client.query('ROLLBACK')
      return { statusCode: 409, error: 'הבקשה כבר טופלה', accessRequest: serializeAccessRequest(accessRequest) }
    }

    const existingStudent = await client.query(
      `SELECT id, username
       FROM marathon_students
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [accessRequest.email],
    )

    if (existingStudent.rowCount > 0) {
      const username = existingStudent.rows[0].username || await generateUniqueUsername(client, accessRequest.email)
      const result = await client.query(
        `UPDATE marathon_students
         SET username = $2,
             email = $3,
             name = $4,
             password_hash = $5,
             active = true,
             course_ids = $6::jsonb,
             locked_device_id = '',
             locked_device_at = NULL,
             locked_device_ip_address = '',
             locked_device_user_agent = '',
             last_denied_ip_address = '',
             last_denied_user_agent = '',
             last_denied_at = NULL,
             updated_at = now()
         WHERE id = $1
         RETURNING id, phone, username, email, name, active,
                   course_ids,
                   locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
                   last_denied_ip_address, last_denied_user_agent, last_denied_at,
                   created_at, updated_at, last_login_at,
                   0 AS active_session_count`,
        [
          existingStudent.rows[0].id,
          username,
          accessRequest.email,
          accessRequest.full_name,
          passwordHash,
          JSON.stringify(normalizedCourseIds),
        ],
      )
      student = result.rows[0]
      await client.query('DELETE FROM marathon_student_sessions WHERE student_id = $1', [student.id])
    } else {
      const username = await generateUniqueUsername(client, accessRequest.email)
      const result = await client.query(
        `INSERT INTO marathon_students (id, phone, username, email, name, password_hash, active, course_ids)
         VALUES ($1, NULL, $2, $3, $4, $5, true, $6::jsonb)
         RETURNING id, phone, username, email, name, active,
                   course_ids,
                   locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
                   last_denied_ip_address, last_denied_user_agent, last_denied_at,
                   created_at, updated_at, last_login_at,
                   0 AS active_session_count`,
        [
          createId(),
          username,
          accessRequest.email,
          accessRequest.full_name,
          passwordHash,
          JSON.stringify(normalizedCourseIds),
        ],
      )
      student = result.rows[0]
    }

    const updatedRequest = await client.query(
      `UPDATE marathon_student_access_requests
       SET status = 'approved',
           student_id = $2,
           approved_at = now(),
           updated_at = now()
       WHERE id = $1
       RETURNING id, full_name, email, status, admin_token_hash, student_id,
                 request_ip_address, request_user_agent,
                 created_at, updated_at, notified_at, approved_at, rejected_at, credentials_sent_at`,
      [accessRequest.id, student.id],
    )
    accessRequest = updatedRequest.rows[0]

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  const mail = await sendStudentCredentialsEmail({ req, student, password })
  if (mail.status === 'sent') {
    const updatedRequest = await pool.query(
      `UPDATE marathon_student_access_requests
       SET credentials_sent_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, full_name, email, status, admin_token_hash, student_id,
                 request_ip_address, request_user_agent,
                 created_at, updated_at, notified_at, approved_at, rejected_at, credentials_sent_at`,
      [accessRequest.id],
    )
    accessRequest = updatedRequest.rows[0] ?? accessRequest
  }

  return {
    statusCode: 200,
    accessRequest: serializeAccessRequest(accessRequest),
    student: serializeStudent(student),
    username: student.username || student.email,
    password,
    mail,
  }
}

async function rejectAccessRequest({ accessRequestId, token }) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const accessRequest = await loadAccessRequest(accessRequestId, client, { forUpdate: true })

    if (!accessRequest) {
      await client.query('ROLLBACK')
      return { statusCode: 404, error: 'בקשת הגישה לא נמצאה' }
    }

    if (!isAdminService && !hasValidAccessRequestToken(accessRequest, token)) {
      await client.query('ROLLBACK')
      return { statusCode: 403, error: 'קישור הדחייה אינו תקין' }
    }

    if (accessRequest.status !== 'pending') {
      await client.query('ROLLBACK')
      return { statusCode: 409, error: 'הבקשה כבר טופלה', accessRequest: serializeAccessRequest(accessRequest) }
    }

    const result = await client.query(
      `UPDATE marathon_student_access_requests
       SET status = 'rejected',
           rejected_at = now(),
           updated_at = now()
       WHERE id = $1
       RETURNING id, full_name, email, status, admin_token_hash, student_id,
                 request_ip_address, request_user_agent,
                 created_at, updated_at, notified_at, approved_at, rejected_at, credentials_sent_at`,
      [accessRequestId],
    )

    await client.query('COMMIT')
    return { statusCode: 200, accessRequest: serializeAccessRequest(result.rows[0]) }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
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

        CREATE TABLE IF NOT EXISTS marathon_recordings (
          id text PRIMARY KEY,
          course_id text NOT NULL,
          title text NOT NULL,
          provider text NOT NULL DEFAULT 'mux',
          provider_asset_id text NOT NULL DEFAULT '',
          provider_playback_id text NOT NULL DEFAULT '',
          provider_upload_id text NOT NULL DEFAULT '',
          external_url text NOT NULL DEFAULT '',
          access_note text NOT NULL DEFAULT '',
          playback_policy text NOT NULL DEFAULT 'signed',
          date_label text NOT NULL DEFAULT '',
          duration_seconds integer NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'ready',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'mux';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS provider_asset_id text NOT NULL DEFAULT '';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS provider_playback_id text NOT NULL DEFAULT '';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS provider_upload_id text NOT NULL DEFAULT '';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS external_url text NOT NULL DEFAULT '';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS access_note text NOT NULL DEFAULT '';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS playback_policy text NOT NULL DEFAULT 'signed';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS date_label text NOT NULL DEFAULT '';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS duration_seconds integer NOT NULL DEFAULT 0;

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

        ALTER TABLE marathon_recordings
          ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

        CREATE INDEX IF NOT EXISTS marathon_recordings_course_id_idx
          ON marathon_recordings (course_id);

        CREATE TABLE IF NOT EXISTS marathon_students (
          id text PRIMARY KEY,
          phone text UNIQUE,
          username text NOT NULL DEFAULT '',
          email text NOT NULL DEFAULT '',
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
          ALTER COLUMN phone DROP NOT NULL;

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS username text NOT NULL DEFAULT '';

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

        UPDATE marathon_students
          SET username = phone
          WHERE (username IS NULL OR username = '') AND phone IS NOT NULL AND phone <> '';

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

        CREATE UNIQUE INDEX IF NOT EXISTS marathon_students_username_unique_idx
          ON marathon_students (lower(username))
          WHERE username <> '';

        CREATE UNIQUE INDEX IF NOT EXISTS marathon_students_email_unique_idx
          ON marathon_students (lower(email))
          WHERE email <> '';

        ALTER TABLE marathon_students
          ADD COLUMN IF NOT EXISTS course_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

        CREATE TABLE IF NOT EXISTS marathon_student_access_requests (
          id text PRIMARY KEY,
          full_name text NOT NULL,
          email text NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          admin_token_hash text NOT NULL,
          student_id text REFERENCES marathon_students(id) ON DELETE SET NULL,
          request_ip_address text NOT NULL DEFAULT '',
          request_user_agent text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          notified_at timestamptz,
          approved_at timestamptz,
          rejected_at timestamptz,
          credentials_sent_at timestamptz
        );

        CREATE INDEX IF NOT EXISTS marathon_student_access_requests_status_idx
          ON marathon_student_access_requests (status, created_at DESC);

        CREATE UNIQUE INDEX IF NOT EXISTS marathon_student_access_requests_pending_email_idx
          ON marathon_student_access_requests (lower(email))
          WHERE status = 'pending';

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

function serializeRecording(row, { includeProviderDetails = false } = {}) {
  const recording = {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    provider: row.provider,
    date: row.date_label,
    dateLabel: row.date_label,
    duration: formatDuration(row.duration_seconds),
    durationSeconds: row.duration_seconds,
    status: row.status,
    createdAt: row.created_at?.toISOString?.() ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
  }

  if (includeProviderDetails) {
    recording.providerAssetId = row.provider_asset_id
    recording.providerPlaybackId = row.provider_playback_id
    recording.providerUploadId = row.provider_upload_id
    recording.externalUrl = row.external_url
    recording.accessNote = row.access_note
    recording.playbackPolicy = row.playback_policy
  }

  return recording
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds ?? 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''

  const roundedSeconds = Math.round(seconds)
  const hours = Math.floor(roundedSeconds / 3600)
  const minutes = Math.floor((roundedSeconds % 3600) / 60)
  const remainingSeconds = roundedSeconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function normalizeRecordingStatus(status) {
  const normalizedStatus = String(status ?? '').trim().toLowerCase()
  if (normalizedStatus === 'ready') return 'ready'
  if (normalizedStatus === 'errored' || normalizedStatus === 'error') return 'errored'
  if (normalizedStatus === 'waiting_upload') return 'waiting_upload'
  if (normalizedStatus === 'created') return 'processing'

  return normalizedStatus || 'processing'
}

function parseHttpUrl(value, label = 'URL') {
  const url = String(value ?? '').trim()
  if (!url) return null

  try {
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`${label} must be http or https`)
    }

    return parsedUrl.toString()
  } catch (error) {
    throw new Error(error.message === `${label} must be http or https`
      ? error.message
      : `${label} is invalid`, { cause: error })
  }
}

async function updateRecordingFromMux(row) {
  if (!row || row.provider !== 'mux' || !isMuxApiConfigured()) return row

  let providerAssetId = row.provider_asset_id
  let providerPlaybackId = row.provider_playback_id
  let durationSeconds = Number(row.duration_seconds ?? 0)
  let status = row.status

  if (!providerAssetId && row.provider_upload_id) {
    const upload = await getMuxUpload(row.provider_upload_id)
    providerAssetId = upload?.asset_id ?? ''
    status = providerAssetId ? 'processing' : 'waiting_upload'
  }

  if (providerAssetId) {
    const asset = await getMuxAsset(providerAssetId)
    providerPlaybackId = firstMuxPlaybackId(asset) || providerPlaybackId
    durationSeconds = muxAssetDurationSeconds(asset) || durationSeconds
    status = normalizeRecordingStatus(asset?.status)
  }

  if (
    providerAssetId === row.provider_asset_id &&
    providerPlaybackId === row.provider_playback_id &&
    durationSeconds === Number(row.duration_seconds ?? 0) &&
    status === row.status
  ) {
    return row
  }

  const result = await pool.query(
    `UPDATE marathon_recordings
     SET provider_asset_id = $2,
         provider_playback_id = $3,
         duration_seconds = $4,
         status = $5,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [row.id, providerAssetId, providerPlaybackId, durationSeconds, status],
  )

  return result.rows[0] ?? row
}

async function getRecordingById(recordingId, { syncMux = false } = {}) {
  await ensureDb()
  const result = await pool.query('SELECT * FROM marathon_recordings WHERE id = $1', [recordingId])
  if (result.rowCount === 0) return null

  const row = result.rows[0]
  if (!syncMux) return row

  return updateRecordingFromMux(row).catch(() => row)
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
app.use(express.urlencoded({ extended: false }))

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
  const contentOverrides = await loadContentOverridesFromDatabase()
  const courseChoiceOptions = getPhoneLoginCourseOptions(contentOverrides)

  res.json({
    role: isAdminService ? 'admin' : 'student',
    canEditContent: isAdminService,
    hasDatabase: Boolean(pool),
    studentAuthRequired: isStudentAuthRequired(),
    phoneLoginCourseIds: studentPhoneLoginCourseIds,
    courseChoiceOptions,
    modelGroupOptions: courseChoiceOptions,
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
  const login = normalizeLoginIdentifier(req.body?.username ?? req.body?.phone)
  const password = String(req.body?.password ?? '').trim()
  const maskedLogin = login.phone ? maskPhoneForLog(login.phone) : login.username.replace(/^(.{2}).+(@?.{2})$/, '$1***$2')

  if (!login.username || !password) {
    console.warn('[student-auth/login] rejected', {
      login: maskedLogin,
      reason: 'invalid_input',
      hasPassword: Boolean(password),
    })
    res.status(400).json({ error: 'יש להזין שם משתמש וסיסמה תקינים' })
    return
  }

  const result = await pool.query(
    `SELECT id, phone, username, email, name, active, password_hash,
            course_ids,
            locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
            last_denied_ip_address, last_denied_user_agent, last_denied_at,
            created_at, updated_at, last_login_at
     FROM marathon_students
     WHERE lower(username) = lower($1)
        OR ($2 <> '' AND phone = $2)
        OR ($3 <> '' AND lower(email) = lower($3))
     LIMIT 1`,
    [login.username, login.phone, normalizeEmail(login.raw)],
  )

  if (result.rowCount === 0 || !result.rows[0].active) {
    console.warn('[student-auth/login] rejected', {
      login: maskedLogin,
      reason: result.rowCount === 0 ? 'student_not_found' : 'student_inactive',
    })
    res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' })
    return
  }

  const studentRow = result.rows[0]
  const isPasswordValid = await verifyPassword(password, studentRow.password_hash)
  if (!isPasswordValid) {
    console.warn('[student-auth/login] rejected', {
      login: maskedLogin,
      reason: 'password_mismatch',
      courseIds: normalizeCourseIds(studentRow.course_ids),
    })
    res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' })
    return
  }

  const currentIpAddress = requestIp(req)
  const currentUserAgent = requestUserAgent(req)

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + studentSessionDays * 24 * 60 * 60 * 1000)

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM marathon_student_sessions WHERE expires_at <= now()')

    await client.query(
      `INSERT INTO marathon_student_sessions (id, student_id, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [hashSessionToken(token), studentRow.id, expiresAt, currentIpAddress, currentUserAgent],
    )
    const updatedStudent = await client.query(
      `UPDATE marathon_students
       SET last_login_at = now(),
           locked_device_id = '',
           locked_device_at = NULL,
           locked_device_ip_address = '',
           locked_device_user_agent = '',
           last_denied_ip_address = '',
           last_denied_user_agent = '',
           last_denied_at = NULL,
           updated_at = now()
       WHERE id = $1
       RETURNING id, phone, username, email, name, active,
                 course_ids,
                 locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
                 last_denied_ip_address, last_denied_user_agent, last_denied_at,
                 created_at, updated_at, last_login_at`,
      [studentRow.id],
    )

    await client.query('COMMIT')

    clearStudentPhoneAccessCookie(req, res)
    setStudentSessionCookie(req, res, token, expiresAt)
    console.info('[student-auth/login] accepted', {
      login: maskedLogin,
      courseIds: normalizeCourseIds(updatedStudent.rows[0].course_ids),
    })
    res.json({ student: serializeStudent(updatedStudent.rows[0]) })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
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
    res.status(404).json({ error: 'הקבוצה שנבחרה לא נמצאה' })
    return
  }

  const option = getPhoneLoginCourseOptions(overrides)
    .find((item) => item.id === String(course.id)) ?? createPhoneLoginCourseOption(course, 0)
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

app.post('/api/student-access-requests', requireDatabase, asyncHandler(async (req, res) => {
  await ensureDb()

  const fullName = String(req.body?.fullName ?? req.body?.full_name ?? '').trim()
  const email = normalizeEmail(req.body?.email)

  if (fullName.length < 2) {
    res.status(400).json({ error: 'יש להזין שם מלא' })
    return
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'יש להזין כתובת מייל תקינה' })
    return
  }

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashAccessRequestToken(token)
  const client = await pool.connect()
  let accessRequest

  try {
    await client.query('BEGIN')
    const existingRequest = await client.query(
      `SELECT id
       FROM marathon_student_access_requests
       WHERE lower(email) = lower($1) AND status = 'pending'
       LIMIT 1
       FOR UPDATE`,
      [email],
    )

    if (existingRequest.rowCount > 0) {
      const result = await client.query(
        `UPDATE marathon_student_access_requests
         SET full_name = $2,
             admin_token_hash = $3,
             request_ip_address = $4,
             request_user_agent = $5,
             updated_at = now()
         WHERE id = $1
         RETURNING id, full_name, email, status, admin_token_hash, student_id,
                   request_ip_address, request_user_agent,
                   created_at, updated_at, notified_at, approved_at, rejected_at, credentials_sent_at`,
        [
          existingRequest.rows[0].id,
          fullName,
          tokenHash,
          requestIp(req),
          requestUserAgent(req),
        ],
      )
      accessRequest = result.rows[0]
    } else {
      const result = await client.query(
        `INSERT INTO marathon_student_access_requests
           (id, full_name, email, status, admin_token_hash, request_ip_address, request_user_agent)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6)
         RETURNING id, full_name, email, status, admin_token_hash, student_id,
                   request_ip_address, request_user_agent,
                   created_at, updated_at, notified_at, approved_at, rejected_at, credentials_sent_at`,
        [
          createId(),
          fullName,
          email,
          tokenHash,
          requestIp(req),
          requestUserAgent(req),
        ],
      )
      accessRequest = result.rows[0]
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      res.status(409).json({ error: 'כבר קיימת בקשה ממתינה עבור כתובת המייל הזו' })
      return
    }
    throw error
  } finally {
    client.release()
  }

  const approvalUrl = createAccessRequestApprovalUrl(req, accessRequest.id, token)
  const notification = await sendAdminAccessRequestEmail({ accessRequest, approvalUrl })

  if (notification.status === 'sent') {
    const updatedRequest = await pool.query(
      `UPDATE marathon_student_access_requests
       SET notified_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, full_name, email, status, admin_token_hash, student_id,
                 request_ip_address, request_user_agent,
                 created_at, updated_at, notified_at, approved_at, rejected_at, credentials_sent_at`,
      [accessRequest.id],
    )
    accessRequest = updatedRequest.rows[0] ?? accessRequest
  }

  res.status(201).json({
    request: serializeAccessRequest(accessRequest),
    notification,
  })
}))

app.get('/api/student-access-requests', requireDatabase, requireAdmin, asyncHandler(async (_req, res) => {
  await ensureDb()
  const result = await pool.query(
    `SELECT id, full_name, email, status, admin_token_hash, student_id,
            request_ip_address, request_user_agent,
            created_at, updated_at, notified_at, approved_at, rejected_at, credentials_sent_at
     FROM marathon_student_access_requests
     ORDER BY
       CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT 100`,
  )

  res.json({ requests: result.rows.map((row) => serializeAccessRequest(row)) })
}))

app.get('/student-access-requests/:id/approve', requireDatabase, asyncHandler(async (req, res) => {
  await ensureDb()
  const accessRequest = await loadAccessRequest(req.params.id)
  const token = getAccessRequestToken(req)

  if (!accessRequest) {
    res.status(404).send('בקשת הגישה לא נמצאה')
    return
  }

  if (!isAdminService && !hasValidAccessRequestToken(accessRequest, token)) {
    res.status(403).send('קישור האישור אינו תקין')
    return
  }

  const courseOptions = getStudentAccessCourseOptions(await loadContentOverridesFromDatabase())
  sendAccessRequestApprovalPage(res, { accessRequest, courseOptions, token })
}))

async function handleApproveAccessRequestRoute(req, res) {
  await ensureDb()
  const token = getAccessRequestToken(req)
  const courseIds = normalizeCourseIds(req.body?.courseIds ?? req.body?.courseId)
  const result = await approveAccessRequest(req, {
    accessRequestId: req.params.id,
    token,
    courseIds,
  })

  if (req.is('application/x-www-form-urlencoded')) {
    const accessRequest = await loadAccessRequest(req.params.id)
    if (!accessRequest) {
      res.status(result.statusCode ?? 404).send(result.error ?? 'בקשת הגישה לא נמצאה')
      return
    }

    const courseOptions = getStudentAccessCourseOptions(await loadContentOverridesFromDatabase())
    sendAccessRequestApprovalPage(res, {
      accessRequest,
      courseOptions,
      token,
      result: result.error
        ? { type: 'error', text: result.error }
        : {
            type: result.mail.status === 'sent' ? 'success' : 'error',
            text: result.mail.status === 'sent'
              ? 'המשתמש נוצר ופרטי הכניסה נשלחו לסטודנט במייל.'
              : `המשתמש נוצר, אבל ${result.mail.text}`,
            credentials: result.mail.status === 'sent' ? null : {
              username: result.username,
              password: result.password,
            },
          },
    })
    return
  }

  if (result.error) {
    res.status(result.statusCode).json({ error: result.error, request: result.accessRequest })
    return
  }

  res.json(result)
}

app.post('/student-access-requests/:id/approve', requireDatabase, asyncHandler(handleApproveAccessRequestRoute))
app.post('/api/student-access-requests/:id/approve', requireDatabase, asyncHandler(handleApproveAccessRequestRoute))

async function handleRejectAccessRequestRoute(req, res) {
  await ensureDb()
  const token = getAccessRequestToken(req)
  const result = await rejectAccessRequest({
    accessRequestId: req.params.id,
    token,
  })

  if (req.is('application/x-www-form-urlencoded')) {
    const accessRequest = await loadAccessRequest(req.params.id)
    if (!accessRequest) {
      res.status(result.statusCode ?? 404).send(result.error ?? 'בקשת הגישה לא נמצאה')
      return
    }

    const courseOptions = getStudentAccessCourseOptions(await loadContentOverridesFromDatabase())
    sendAccessRequestApprovalPage(res, {
      accessRequest,
      courseOptions,
      token,
      result: result.error
        ? { type: 'error', text: result.error }
        : { type: 'success', text: 'הבקשה נדחתה.' },
    })
    return
  }

  if (result.error) {
    res.status(result.statusCode).json({ error: result.error, request: result.accessRequest })
    return
  }

  res.json(result)
}

app.post('/student-access-requests/:id/reject', requireDatabase, asyncHandler(handleRejectAccessRequestRoute))
app.post('/api/student-access-requests/:id/reject', requireDatabase, asyncHandler(handleRejectAccessRequestRoute))

app.get('/api/students', requireDatabase, requireAdmin, asyncHandler(async (_req, res) => {
  await ensureDb()
  const result = await pool.query(
    `SELECT students.id, students.phone, students.username, students.email, students.name, students.active,
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
  const email = normalizeEmail(req.body?.email)
  const courseIds = normalizeCourseIds(req.body?.courseIds)
  const requestedPassword = String(req.body?.password ?? '').trim()
  const password = requestedPassword || generatePassword()
  const maskedPhone = maskPhoneForLog(phone)

  if (!isValidPhone(phone)) {
    console.warn('[students/create] rejected', { phone: maskedPhone, reason: 'invalid_phone' })
    res.status(400).json({ error: 'Invalid phone number' })
    return
  }

  if (password.length < 8) {
    console.warn('[students/create] rejected', { phone: maskedPhone, reason: 'short_password' })
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  if (email && !isValidEmail(email)) {
    console.warn('[students/create] rejected', { phone: maskedPhone, reason: 'invalid_email' })
    res.status(400).json({ error: 'Invalid email address' })
    return
  }

  if (courseIds.length === 0) {
    console.warn('[students/create] rejected', { phone: maskedPhone, reason: 'missing_course' })
    res.status(400).json({ error: 'Student must be assigned to a course' })
    return
  }

  const passwordHash = await hashPassword(password)

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query(
      `INSERT INTO marathon_students (id, phone, username, email, name, password_hash, active, course_ids)
       VALUES ($1, $2, $2, $3, $4, $5, true, $6::jsonb)
       ON CONFLICT (phone)
       DO UPDATE SET
         username = CASE WHEN marathon_students.username = '' THEN EXCLUDED.username ELSE marathon_students.username END,
         email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE marathon_students.email END,
         name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE marathon_students.name END,
         password_hash = EXCLUDED.password_hash,
         active = true,
         course_ids = EXCLUDED.course_ids,
         locked_device_id = '',
         locked_device_at = NULL,
         locked_device_ip_address = '',
         locked_device_user_agent = '',
         last_denied_ip_address = '',
         last_denied_user_agent = '',
         last_denied_at = NULL,
         updated_at = now()
       RETURNING id, phone, username, email, name, active,
                 course_ids,
                 locked_device_id, locked_device_at, locked_device_ip_address, locked_device_user_agent,
                 last_denied_ip_address, last_denied_user_agent, last_denied_at,
                 created_at, updated_at, last_login_at`,
      [createId(), phone, email, name, passwordHash, JSON.stringify(courseIds)],
    )

    await client.query('DELETE FROM marathon_student_sessions WHERE student_id = $1', [result.rows[0].id])
    await client.query('COMMIT')

    const student = result.rows[0]
    const whatsApp = await sendCredentialsWhatsApp({ student, password })

    console.info('[students/create] saved', {
      phone: maskedPhone,
      courseIds: normalizeCourseIds(student.course_ids),
      active: Boolean(student.active),
    })

    res.status(201).json({ student: serializeStudent(student), password, whatsApp })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
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
     RETURNING id, phone, username, email, name, active,
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
    `SELECT id, phone, username, email, name, active,
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
     RETURNING id, phone, username, email, name, active,
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
     RETURNING id, phone, username, email, name, active,
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

app.get('/api/recordings', requireDatabase, requireStudentCourseFromQuery, asyncHandler(async (req, res) => {
  await ensureDb()
  const courseId = String(req.query.courseId ?? '').trim()
  if (!courseId) {
    res.status(400).json({ error: 'Missing courseId' })
    return
  }

  const result = await pool.query(
    'SELECT * FROM marathon_recordings WHERE course_id = $1 ORDER BY created_at ASC',
    [courseId],
  )
  const rows = await Promise.all(result.rows.map((row) => {
    const shouldSyncMux = row.provider === 'mux' && (row.status !== 'ready' || !row.provider_playback_id)
    return shouldSyncMux ? updateRecordingFromMux(row).catch(() => row) : row
  }))

  res.json({
    recordings: rows.map((row) => serializeRecording(row, { includeProviderDetails: isAdminService })),
  })
}))

app.post('/api/recordings/direct-upload', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  const courseId = String(req.body?.courseId ?? '').trim()
  const title = String(req.body?.title ?? '').trim()
  const dateLabel = String(req.body?.dateLabel ?? '').trim()

  if (!courseId || !title) {
    res.status(400).json({ error: 'Missing courseId or title' })
    return
  }

  if (!isMuxApiConfigured()) {
    res.status(503).json({
      error: 'Mux לא מוגדר בשירות האדמין. צריך להגדיר MUX_TOKEN_ID ו-MUX_TOKEN_SECRET ב-Railway.',
    })
    return
  }

  await ensureDb()

  let uploadSession
  try {
    uploadSession = await createMuxDirectUpload(req)
  } catch (error) {
    console.error('[recordings/direct-upload] Mux direct upload failed', {
      courseId,
      corsOrigin: getRequestOrigin(req),
      message: error.message,
    })
    res.status(502).json({ error: `Mux לא הצליח ליצור העלאה: ${error.message}` })
    return
  }

  const result = await pool.query(
    `INSERT INTO marathon_recordings
       (id, course_id, title, provider, provider_upload_id, playback_policy, date_label, status)
     VALUES ($1, $2, $3, 'mux', $4, 'signed', $5, 'waiting_upload')
     RETURNING *`,
    [`recording:${courseId}:${createId()}`, courseId, title, uploadSession.id ?? '', dateLabel],
  )

  await notifyContentChanged()

  res.status(201).json({
    recording: serializeRecording(result.rows[0], { includeProviderDetails: true }),
    uploadUrl: uploadSession.url,
    uploadOrigin: uploadSession.cors_origin,
  })
}))

app.post('/api/recordings', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const courseId = String(req.body?.courseId ?? '').trim()
  const title = String(req.body?.title ?? '').trim()
  const dateLabel = String(req.body?.dateLabel ?? '').trim()
  const provider = String(req.body?.provider ?? 'mux').trim().toLowerCase()
  const sourceUrl = String(req.body?.sourceUrl ?? req.body?.externalUrl ?? '').trim()
  const accessNote = String(req.body?.accessNote ?? '').trim()
  let providerAssetId = String(req.body?.providerAssetId ?? req.body?.muxAssetId ?? '').trim()
  let providerPlaybackId = String(req.body?.providerPlaybackId ?? req.body?.muxPlaybackId ?? '').trim()
  let durationSeconds = Number(req.body?.durationSeconds ?? 0)
  let status = 'ready'

  if (!courseId || !title) {
    res.status(400).json({ error: 'Missing courseId or title' })
    return
  }

  if (provider === 'onedrive' || provider === 'googledrive') {
    const providerLabel = provider === 'googledrive' ? 'Google Drive' : 'OneDrive'
    let externalUrl
    try {
      externalUrl = parseHttpUrl(sourceUrl, `${providerLabel} URL`)
    } catch (error) {
      res.status(400).json({ error: error.message })
      return
    }

    if (!externalUrl) {
      res.status(400).json({ error: `${providerLabel} URL is required` })
      return
    }

    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) durationSeconds = 0

    const result = await pool.query(
      `INSERT INTO marathon_recordings
         (id, course_id, title, provider, external_url, access_note, playback_policy,
          date_label, duration_seconds, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'external', $7, $8, 'ready')
       RETURNING *`,
      [
        `recording:${courseId}:${createId()}`,
        courseId,
        title,
        provider,
        externalUrl,
        accessNote,
        dateLabel,
        Math.round(durationSeconds),
      ],
    )

    await notifyContentChanged()

    res.status(201).json({ recording: serializeRecording(result.rows[0], { includeProviderDetails: true }) })
    return
  }

  if (provider !== 'mux') {
    res.status(400).json({ error: 'Unsupported recording provider' })
    return
  }

  if (sourceUrl) {
    let muxImportUrl
    try {
      muxImportUrl = parseHttpUrl(sourceUrl, 'Recording source URL')
    } catch (error) {
      res.status(400).json({ error: error.message })
      return
    }

    const asset = await createMuxAssetFromUrl(muxImportUrl)
    providerAssetId = asset.id ?? ''
    providerPlaybackId = firstMuxPlaybackId(asset)
    durationSeconds = muxAssetDurationSeconds(asset)
    status = normalizeRecordingStatus(asset.status)
  } else if (providerAssetId && (!providerPlaybackId || durationSeconds <= 0)) {
    const asset = await getMuxAsset(providerAssetId)
    providerPlaybackId = providerPlaybackId || firstMuxPlaybackId(asset)
    durationSeconds = durationSeconds > 0 ? durationSeconds : muxAssetDurationSeconds(asset)
    status = normalizeRecordingStatus(asset?.status)
  }

  if (!providerAssetId && !providerPlaybackId) {
    res.status(400).json({ error: 'Provide a sourceUrl, mux asset id, or mux playback id' })
    return
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) durationSeconds = 0

  const result = await pool.query(
    `INSERT INTO marathon_recordings
       (id, course_id, title, provider, provider_asset_id, provider_playback_id, playback_policy,
        date_label, duration_seconds, status)
     VALUES ($1, $2, $3, 'mux', $4, $5, 'signed', $6, $7, $8)
     RETURNING *`,
    [
      `recording:${courseId}:${createId()}`,
      courseId,
      title,
      providerAssetId,
      providerPlaybackId,
      dateLabel,
      Math.round(durationSeconds),
      status,
    ],
  )

  await notifyContentChanged()

  res.status(201).json({ recording: serializeRecording(result.rows[0], { includeProviderDetails: true }) })
}))

app.post('/api/recordings/:id/sync', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  const recording = await getRecordingById(req.params.id, { syncMux: true })
  if (!recording) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }

  res.json({ recording: serializeRecording(recording, { includeProviderDetails: true }) })
}))

app.patch('/api/recordings/:id', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  const hasTitle = Object.hasOwn(req.body ?? {}, 'title')
  const hasDateLabel = Object.hasOwn(req.body ?? {}, 'dateLabel')
  const hasAccessNote = Object.hasOwn(req.body ?? {}, 'accessNote')
  const hasDurationSeconds = Object.hasOwn(req.body ?? {}, 'durationSeconds')
  const title = hasTitle ? String(req.body.title ?? '').trim() : ''
  const dateLabel = hasDateLabel ? String(req.body.dateLabel ?? '').trim() : ''
  const accessNote = hasAccessNote ? String(req.body.accessNote ?? '').trim() : ''
  const durationSeconds = Number(req.body?.durationSeconds ?? 0)

  if (hasTitle && !title) {
    res.status(400).json({ error: 'Title cannot be empty' })
    return
  }

  if (hasDurationSeconds && (!Number.isFinite(durationSeconds) || durationSeconds < 0)) {
    res.status(400).json({ error: 'Duration must be a positive number' })
    return
  }

  const result = await pool.query(
    `UPDATE marathon_recordings
     SET title = CASE WHEN $2::boolean THEN $3 ELSE title END,
         date_label = CASE WHEN $4::boolean THEN $5 ELSE date_label END,
         access_note = CASE WHEN $6::boolean THEN $7 ELSE access_note END,
         duration_seconds = CASE WHEN $8::boolean THEN $9 ELSE duration_seconds END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      req.params.id,
      hasTitle,
      title,
      hasDateLabel,
      dateLabel,
      hasAccessNote,
      accessNote,
      hasDurationSeconds,
      Math.round(durationSeconds),
    ],
  )

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }

  await notifyContentChanged()

  res.json({ recording: serializeRecording(result.rows[0], { includeProviderDetails: true }) })
}))

app.delete('/api/recordings/:id', requireDatabase, requireAdmin, asyncHandler(async (req, res) => {
  await ensureDb()
  await pool.query('DELETE FROM marathon_recordings WHERE id = $1', [req.params.id])
  await notifyContentChanged()
  res.status(204).end()
}))

app.get('/api/recordings/:id/playback', requireDatabase, asyncHandler(async (req, res) => {
  const recording = await getRecordingById(req.params.id, { syncMux: true })
  if (!recording) {
    res.status(404).json({ error: 'Recording not found' })
    return
  }

  if (!studentCanAccessCourse(req, recording.course_id)) {
    rejectStudentCourseAccess(res)
    return
  }

  if (recording.provider === 'onedrive' || recording.provider === 'googledrive') {
    if (!recording.external_url) {
      res.status(409).json({ error: 'Recording link is missing' })
      return
    }

    res.setHeader('Cache-Control', 'no-store')
    res.json({
      player: 'external',
      provider: recording.provider,
      url: recording.external_url,
      accessNote: recording.access_note,
      viewer: {
        name: req.student?.name ?? req.phoneAccess?.name ?? '',
        phone: req.student?.phone ?? req.phoneAccess?.phone ?? '',
      },
    })
    return
  }

  if (recording.provider !== 'mux') {
    res.status(400).json({ error: 'Unsupported recording provider' })
    return
  }

  if (recording.status !== 'ready' || !recording.provider_playback_id) {
    res.status(409).json({ error: 'Recording is not ready yet' })
    return
  }

  const playbackId = recording.provider_playback_id
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    player: 'mux',
    playbackId,
    tokens: {
      playback: createMuxPlaybackToken(playbackId, 'v', recording),
      thumbnail: createMuxPlaybackToken(playbackId, 't', recording),
      storyboard: createMuxPlaybackToken(playbackId, 's', recording),
    },
    envKey: muxEnvKey,
    expiresInSeconds: muxPlaybackTokenTtlSeconds(recording),
    viewer: {
      name: req.student?.name ?? req.phoneAccess?.name ?? '',
      phone: req.student?.phone ?? req.phoneAccess?.phone ?? '',
    },
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
