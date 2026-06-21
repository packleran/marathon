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

Student access is controlled from the admin UI. After a student pays, open the admin service, choose the student's course, add the student's phone number, and generate or set an initial password. The student site uses the phone number as the username and stores only a password hash in Postgres. By default, each student can have only one active session, and the first successful login locks the account to that browser/computer using a secure device cookie. Another computer is blocked until an admin resets the device lock. Students only see courses assigned to their account.

Courses listed in `STUDENT_PUBLIC_COURSE_IDS` are open on the student site and do not require a username, password, single-session enforcement, or device locking. The default public course is `computational` (`מודלים חישוביים`).

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

### Student service variables

```env
APP_ROLE=student
VITE_APP_ROLE=student
VITE_CONTENT_BACKEND=api
DATABASE_URL=${{Postgres.DATABASE_URL}}
STUDENT_AUTH_REQUIRED=true
STUDENT_SESSION_DAYS=30
STUDENT_SINGLE_SESSION=true
STUDENT_DEVICE_LOCK=true
STUDENT_PUBLIC_COURSE_IDS=computational
```

`APP_ROLE` protects the server API. `VITE_APP_ROLE` controls which UI is built.

`STUDENT_AUTH_REQUIRED=false` can temporarily disable the student login gate, but production should leave it enabled.

`STUDENT_SINGLE_SESSION=false` allows multiple simultaneous sessions for the same locked device. Keep it enabled to reduce password sharing.

`STUDENT_DEVICE_LOCK=false` disables the first-device lock. Keep it enabled for strict paid-student access.

`STUDENT_PUBLIC_COURSE_IDS` is a comma-separated list of course ids that are visible without login. Leave it empty to make every course require login again.
