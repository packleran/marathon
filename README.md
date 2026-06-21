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

Student access is controlled from the admin UI. After a student pays, open the admin service, add the student's phone number, and generate or set an initial password. The student site uses the phone number as the username and stores only a password hash in Postgres. By default, each student can have only one active session, and the first successful login locks the account to that browser/computer using a secure device cookie. Another computer is blocked until an admin resets the device lock.

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
```

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
```

`APP_ROLE` protects the server API. `VITE_APP_ROLE` controls which UI is built.

`STUDENT_AUTH_REQUIRED=false` can temporarily disable the student login gate, but production should leave it enabled.

`STUDENT_SINGLE_SESSION=false` allows multiple simultaneous sessions for the same locked device. Keep it enabled to reduce password sharing.

`STUDENT_DEVICE_LOCK=false` disables the first-device lock. Keep it enabled for strict paid-student access.
