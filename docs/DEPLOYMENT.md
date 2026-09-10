# Deployment

This guide covers production-like deployment for the current architecture: static SPA + Express API + managed PostgreSQL, plus the local Docker Compose stack.

## Production assumptions

- Frontend is a static Vite build (Vercel, Netlify, or the Compose nginx image).
- Backend is a Node 20+ process (Render, Railway, Fly.io, a VM, or the Compose API image).
- PostgreSQL is managed (Neon, Supabase, Render Postgres) or the Compose `postgres` service.
- Secrets are supplied only through environment variables.
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
| `FRONTEND_URL` | Required; absolute `http(s)` origin of the SPA |

### Optional / feature-gated

| Variable | Notes |
| --- | --- |
| `EMAIL_FROM`, `SMTP_*` | Required for signup verification and password reset emails |
| `GOOGLE_CLIENT_ID` | Required for Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Reserved for the Google Cloud client; not used by ID-token verify path |
| `ALLOW_PROD_SEED` | Must stay unset/false in real deployments |
| `ALLOW_LOCALHOST_FRONTEND_URL` | Local Docker Compose only; allows `FRONTEND_URL` on localhost under `NODE_ENV=production`. Never set on a public deployment. |

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
- Docker nginx: `frontend/nginx.conf` (`try_files` → `/index.html`)

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
4. Set `DATABASE_URL` in the Render **backend** service environment (Environment → Environment Variables). Use your Neon PostgreSQL connection string as provided by Neon (including `sslmode=require`). Do not commit this value.
5. Set all other required env vars above (`NODE_ENV`, `JWT_SECRET`, `FRONTEND_URL`, etc.)

This project uses a single Prisma `DATABASE_URL` (no `DIRECT_URL`). Prefer Neon’s non-pooled / direct connection string for the API service so `prisma migrate deploy` on startup works reliably. Keep local `backend/.env` pointed at your development Postgres unless you intentionally override it for a one-off check.
## Docker Compose (full local stack)

`docker-compose.yml` runs **postgres**, **backend**, and **frontend** together for a production-like local environment.

### Prerequisites

- Docker Desktop (or equivalent) with Compose v2
- Copy environment file (do not commit the real `.env`):

```bash
copy .env.docker.example .env
```

Edit `.env` so `JWT_SECRET` is unique and at least 32 characters (the example file already uses a local-only placeholder that satisfies length checks).

If a host PostgreSQL instance already listens on **5432**, change `POSTGRES_PORT` in `.env` to a free host port such as **5433**. That mapping only affects host access (`localhost:<POSTGRES_PORT>`). Inside Compose, the backend still connects to `postgres:5432`.

### Networking (important)

| Path | Hostname to use |
| --- | --- |
| Backend container → PostgreSQL | `postgres:5432` (Docker DNS) |
| Host tools → Compose PostgreSQL | `localhost:<POSTGRES_PORT>` (default `5432`; use `5433` if host Postgres already owns 5432) |
| Browser → frontend | `http://localhost:8080` (published port) |
| Browser → backend API | `http://localhost:4000/api` (published port) |
| Production SPA / API | Your real public URLs — not Docker service names |

The browser runs on the host. Never set `VITE_API_BASE_URL` to `http://backend:4000` — that hostname only resolves inside the Compose network.

`FRONTEND_URL` must match the origin the browser uses (`http://localhost:8080` for Compose). Local Compose sets `ALLOW_LOCALHOST_FRONTEND_URL=true` so Phase 9 production checks still allow that localhost origin.

### Start

```bash
docker compose build
docker compose up -d
```

Backend startup runs `npm run start:deploy` (`prisma migrate deploy` then the compiled server). It does **not** run seed, `migrate reset`, or `db push`.

### Verify

```bash
docker compose ps
curl http://localhost:4000/api/health
# Open http://localhost:8080
```

SPA deep links such as `/login`, `/dashboard`, `/customers`, `/crm` are served by nginx fallback.

### Logs and stop

```bash
docker compose logs -f backend
docker compose logs --tail=200 frontend
docker compose logs --tail=200 postgres

docker compose down
```

`docker compose down` keeps the named volume `postgres_data`. Data persists across normal restarts.

### Optional local seed (intentional only)

Compose does **not** seed automatically, and production/public databases must **not** be seeded as part of normal deploy.

For a **fresh local Compose database** only, seed from the host against the **published** Postgres port (`POSTGRES_PORT` in `.env`):

```bash
cd backend
# PowerShell — use 5432 by default, or 5433 if you remapped the host port
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/mini_erp_crm?schema=public"
$env:NODE_ENV="development"
npx prisma db seed
```

Replace `5433` with your `POSTGRES_PORT` value. This uses the Phase 9 seed guard (development is allowed; production requires an explicit `ALLOW_PROD_SEED=true` override and must not be used casually). Demo accounts are documented in the README.

### Destructive reset (not part of normal flow)

```bash
# DESTRUCTIVE: deletes the Postgres volume and all local Docker DB data
docker compose down -v
```

### Postgres-only mode

You can still run just the database for host-side `npm run dev`:

```bash
docker compose up -d postgres
```

## Local production-like checks (without Docker images)

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

## Known production limitations

- Access tokens live in `localStorage` (XSS-sensitive). Prefer a hardened CSP on the SPA host.
- Auth rate limits are in-memory (per process); multi-instance deployments do not share counters.
- No MFA / refresh-token rotation.
- Demo seed accounts must not be used in production.
- Compose `ALLOW_LOCALHOST_FRONTEND_URL` is for local stacks only.
