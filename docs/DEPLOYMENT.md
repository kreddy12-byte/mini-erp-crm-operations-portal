# Deployment

This guide covers production-like deployment for the current architecture: static SPA + Express API + managed PostgreSQL.

## Production assumptions

- Frontend is a static Vite build hosted on Vercel, Netlify, or equivalent.
- Backend is a Node 20+ process (Render, Railway, Fly.io, a VM, etc.).
- PostgreSQL is managed (Neon, Supabase, Render Postgres, etc.).
- Secrets are supplied only through environment variables.
- `docker-compose.yml` is for **local PostgreSQL only**, not a production stack.
- Seed data (`DevLogin!2026`) is for local/demo only. Production seeding is blocked unless `ALLOW_PROD_SEED=true`.

## Backend

### Build and start

```bash
cd backend
npm install
npm run build
npx prisma migrate deploy
npm start
```

Optional combined start (migrate then serve):

```bash
npm run start:deploy
```

`postinstall` already runs `prisma generate`. Do not run `prisma migrate dev` or `prisma db seed` against production.

### Required environment variables

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | Must be `production` |
| `PORT` | Host-provided or explicit |
| `DATABASE_URL` | Required; app exits if missing or unreachable at startup |
| `JWT_SECRET` | Required; unique; at least 32 characters; not the example placeholder |
| `JWT_EXPIRES_IN` | e.g. `1d` |
| `FRONTEND_URL` | Required; absolute `http(s)` origin of the SPA; **must not** be localhost |

### Optional / feature-gated

| Variable | Notes |
| --- | --- |
| `EMAIL_FROM`, `SMTP_*` | Required for signup verification and password reset emails |
| `GOOGLE_CLIENT_ID` | Required for Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Reserved for the Google Cloud client; not used by ID-token verify path |
| `ALLOW_PROD_SEED` | Must stay unset/false in real deployments |

### CORS and email links

`FRONTEND_URL` is the single allowed CORS origin and the base for verification/reset links. Misconfiguration breaks the SPA and auth emails.

### Health

`GET /api/health`:

- `200` + `database: "connected"` when ready
- `503` + `database: "disconnected"` when the database ping fails

Use this for readiness probes. It does not expose credentials.

### Security notes already in the app

- Helmet security headers (CSP left to the SPA host)
- CORS locked to `FRONTEND_URL`
- JSON body limit `1mb`
- `trust proxy` enabled in production
- Structured errors without stack traces in responses
- Auth rate limits on sensitive routes
- Seed refuses production unless explicitly overridden

## Frontend

### Build

```bash
cd frontend
npm install
npm run build
```

Output directory: `frontend/dist`.

### Environment (build-time)

| Variable | Notes |
| --- | --- |
| `VITE_API_BASE_URL` | Absolute API base including `/api`, e.g. `https://api.example.com/api` |
| `VITE_GOOGLE_CLIENT_ID` | Same client ID as backend `GOOGLE_CLIENT_ID` when Google login is enabled |

Vite embeds `VITE_*` values at build time. Rebuild after changing them.

### SPA fallback

Deep links (`/customers/:id`, `/crm`, etc.) require the host to serve `index.html` for unknown paths:

- Vercel: `frontend/vercel.json`
- Netlify: `frontend/netlify.toml` and `frontend/public/_redirects`

### Platform tips

**Vercel / Netlify**

1. Root directory: `frontend`
2. Build command: `npm run build`
3. Publish: `dist`
4. Set `VITE_API_BASE_URL` (and Google client ID if used)

**API host (example: Render)**

1. Root: `backend`
2. Build: `npm install && npm run build`
3. Start: `npx prisma migrate deploy && npm start` (or `npm run start:deploy`)
4. Attach managed Postgres `DATABASE_URL`
5. Set all required env vars above

## Local production-like checks

```bash
# Backend
cd backend
npm run typecheck
npm test
npm run build

# Frontend
cd frontend
npm run typecheck
npm run lint
npm run build
```

## Docker

`docker compose up -d postgres` starts local PostgreSQL 16 only. There is no application Dockerfile by design: deploy the API as a Node service and the frontend as static assets.

## Known production limitations

- Access tokens live in `localStorage` (XSS-sensitive). Prefer a hardened CSP on the SPA host.
- Auth rate limits are in-memory (per process); multi-instance deployments do not share counters.
- No MFA / refresh-token rotation.
- Demo seed accounts must not be used in production.
