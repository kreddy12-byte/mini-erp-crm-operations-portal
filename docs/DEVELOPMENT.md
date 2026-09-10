# Development

## Run locally

Prerequisites: Node.js 20+ and PostgreSQL 16.

### Database

Preferred path if Docker is installed:

```bash
docker compose up -d postgres
```

`docker-compose.yml` creates database `mini_erp_crm` with user `postgres` / password `postgres` on port 5432.

If you already have PostgreSQL 16 locally, create the database yourself and set `DATABASE_URL` in `backend/.env`. Do not commit that file.

### Backend

```bash
cd backend
copy .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Confirm:

```bash
curl http://localhost:4000/api/health
```

A healthy process with a reachable database looks like:

```json
{
  "success": true,
  "message": "API is healthy",
  "data": {
    "service": "mini-erp-crm-api",
    "environment": "development",
    "database": "connected"
  }
}
```

### Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

## Environment

| Variable | App | Status |
| --- | --- | --- |
| `PORT` | backend | Used |
| `NODE_ENV` | backend | Used |
| `FRONTEND_URL` | backend CORS | Used |
| `DATABASE_URL` | Prisma | Used |
| `VITE_API_BASE_URL` | frontend Axios | Used |
| `JWT_SECRET` | backend | Documented only |
| `JWT_EXPIRES_IN` | backend | Documented only |

`DATABASE_URL` is required in production. Never hardcode credentials.

Prisma reads `DATABASE_URL` from `backend/.env`. Hosted Postgres (Neon, Supabase, Render) uses the same variable with SSL query parameters supplied by the provider.

## Prisma commands

Run from `backend/`:

| Command | Purpose |
| --- | --- |
| `npx prisma validate` | Check `schema.prisma` |
| `npx prisma generate` | Generate the TypeScript client |
| `npx prisma migrate dev` | Create and apply development migrations |
| `npx prisma migrate deploy` | Apply existing migrations |
| `npx prisma db seed` | Insert development-only sample rows |
| `npx prisma studio` | Inspect tables |

`npm install` also runs `prisma generate` via `postinstall`.

## Seed data

Seed data is fake and deterministic. It exists to verify schema, relations, and indexes.

- Users for each role (`ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`)
- Customers covering `RETAIL` / `WHOLESALE` / `DISTRIBUTOR` and `LEAD` / `ACTIVE` / `INACTIVE`
- Products with healthy, low, and zero stock
- One follow-up, two stock movements, and one draft challan with snapshot line items

`passwordHash` values are the literal placeholder `phase2-dev-placeholder-hash-not-a-real-password-do-not-use-for-login`. They are not bcrypt hashes. Login must not be built on this seed.

## Checks before a pull request

```bash
cd backend && npm run prisma:validate && npm run typecheck && npm test && npm run build
cd frontend && npm run typecheck && npm run build && npm run lint
```

Database tests require a migrated PostgreSQL instance.

## Adding a backend endpoint later

1. Validator (request shape)
2. Service (rules)
3. Repository using the shared Prisma client
4. Controller (HTTP)
5. Route registration in `src/routes`

Keep controllers thin. Put stock mutations in a transaction in the service layer when that phase starts.

## Adding a frontend screen later

1. Add a path in `src/constants/navigation.ts` only if it belongs in the shell.
2. Add a page under `src/pages`.
3. Register the route in `src/routes/AppRoutes.tsx`.
4. Reuse `PageHeader`, `EmptyState`, `ErrorState`, and `PageSkeleton`.

## Future phases (not started)

1. Authentication (JWT, bcrypt, RBAC)
2. Customers
3. Products and inventory
4. Sales challans
5. CRM follow-ups
