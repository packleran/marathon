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
```

`APP_ROLE` protects the server API. `VITE_APP_ROLE` controls which UI is built.
