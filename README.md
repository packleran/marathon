# Marathon

React/Vite site with a small Node/Express server for shared content.

## Local development

```bash
npm install
npm run dev
```

Local Vite development can fall back to browser storage when the API is not running.

## Production

Railway should run:

```bash
npm run build
npm start
```

The server serves `dist/` and exposes `/api/*` for shared content, uploads, and meeting requests.

Student access is controlled from the admin UI. After a student pays, open the admin service, choose the student's course, add the student's phone number, and generate or set an initial password. The student site uses the phone number as the username and stores only a password hash in Postgres. Students in password-protected courses can sign in from multiple browsers or devices at the same time. Students only see courses assigned to their account.

Computational Models and Probability use open course-choice access on the student site and do not require a password, username, phone number, or approved-phone allowlist. The student entry screen offers the available open groups, such as `מודלים ראש קבוצה יובל`, `מודלים ראש קבוצה שחר`, and `הסתברות`, and also exposes an Algorithms `תגבור` group when a custom Algorithms course includes `תגבור` in its name. The selected group is the only course shown afterward.

## Railway layout

Deploy the same GitHub repo twice in the same Railway project:

- `marathon-admin`: admin UI, full editing enabled.
- `marathon-students`: student UI, read-only.

Add one Railway PostgreSQL service and point both app services at the same `DATABASE_URL`.

### Admin service variables

```env
APP_ROLE=admin
VITE_APP_ROLE=admin
VITE_CONTENT_BACKEND=api
DATABASE_URL=${{Postgres.DATABASE_URL}}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<choose-a-strong-password>
WHATSAPP_SEND_CREDENTIALS=true
WHATSAPP_GRAPH_API_VERSION=v25.0
WHATSAPP_PHONE_NUMBER_ID=<meta-phone-number-id>
WHATSAPP_ACCESS_TOKEN=<meta-whatsapp-access-token>
WHATSAPP_TEMPLATE_NAME=student_login_details
WHATSAPP_TEMPLATE_LANGUAGE=he
```

WhatsApp credential messages use the Meta WhatsApp Cloud API and must be sent with an approved template. The default template name is `student_login_details`, with three body variables:

1. Student name, or the phone number when no name is set.
2. Username, which is the normalized student phone number.
3. Initial or reset password.

If WhatsApp is not configured or Meta rejects the message, the student user is still created and the admin UI shows the failure so credentials can be copied manually.

If you do not want to use WhatsApp Business Platform, set `WHATSAPP_SEND_CREDENTIALS=false`. The admin UI still shows a `WhatsApp Web` button after creating a user or resetting a password; it opens WhatsApp Web with a prefilled message, and the admin sends it manually.

Recordings are managed from the admin recordings tab. Private-course recordings can use Mux: direct uploads go from the browser to Mux, not through Railway. The admin tab can also import a public direct video URL into Mux, which lets Mux pull the file without uploading it through the browser. Playback on the student site is authorized through `/api/recordings/:id/playback`, which checks the existing student session and course access before returning short-lived signed Mux playback tokens.

For recordings that do not need Mux protection, such as university-hosted Microsoft Teams / OneDrive videos, the admin recordings tab also supports saving an external OneDrive link plus an optional password or note. The site still checks course access before showing the link, but the video itself is governed by Microsoft/OneDrive sharing settings.

Add these variables to the admin service:

```env
MUX_TOKEN_ID=<mux-access-token-id>
MUX_TOKEN_SECRET=<mux-access-token-secret>
MUX_SIGNING_KEY_ID=<mux-signing-key-id>
MUX_SIGNING_PRIVATE_KEY=<mux-signing-private-key>
MUX_ENV_KEY=<mux-environment-key>
```

`MUX_DIRECT_UPLOAD_CORS_ORIGIN` is optional. When set, it is used as the Mux direct-upload CORS origin; otherwise the server uses the browser request origin. Use the exact admin origin, or `*` temporarily while diagnosing CORS upload failures.

### Student service variables

```env
APP_ROLE=student
VITE_APP_ROLE=student
VITE_CONTENT_BACKEND=api
DATABASE_URL=${{Postgres.DATABASE_URL}}
STUDENT_AUTH_REQUIRED=true
STUDENT_SESSION_DAYS=30
STUDENT_PHONE_ACCESS_SECRET=<choose-a-long-random-secret>
MUX_SIGNING_KEY_ID=<mux-signing-key-id>
MUX_SIGNING_PRIVATE_KEY=<mux-signing-private-key>
MUX_ENV_KEY=<mux-environment-key>
VITE_MUX_ENV_KEY=<mux-environment-key>
```

`APP_ROLE` protects the server API. `VITE_APP_ROLE` controls which UI is built.

`STUDENT_AUTH_REQUIRED=false` can temporarily disable the student login gate, but production should leave it enabled.

Computational Models and Probability are always enabled for open course-choice login. `STUDENT_PHONE_LOGIN_COURSE_IDS` is still accepted as a legacy comma-separated list for adding more open root course ids, but it is no longer needed for `computational` or `probability`.

`STUDENT_PHONE_ACCESS_SECRET` signs the open course-choice access cookie. If omitted, the server falls back to another server-side secret, but setting it explicitly is recommended.

`MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` are needed only where recordings are created or synced with Mux. The student service only needs the signing key so it can generate playback tokens after authorization.
