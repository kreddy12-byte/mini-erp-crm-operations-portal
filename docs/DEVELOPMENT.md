# Development — Phase 1

## Run locally

Use two terminals from the repository root.

Backend:

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Confirm:

```bash
curl http://localhost:4000/api/health
```

Frontend:

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. The Vite proxy also forwards `/api` to port 4000, so `VITE_API_BASE_URL=http://localhost:4000/api` and a relative `/api` base both work in development.

## Environment

| Variable | App | Phase 1 |
| --- | --- | --- |
| `PORT` | backend | Used |
| `NODE_ENV` | backend | Used |
| `FRONTEND_URL` | backend CORS | Used |
| `VITE_API_BASE_URL` | frontend Axios | Used |
| `DATABASE_URL` | backend | Documented only |
| `JWT_SECRET` | backend | Documented only |
| `JWT_EXPIRES_IN` | backend | Documented only |

Do not hardcode production URLs, database strings, or JWT secrets.

## Checks before a pull request

```bash
cd backend && npm run typecheck && npm test && npm run build
cd frontend && npm run build
```

## Docker

`docker-compose.yml` defines a PostgreSQL 16 service for a later database phase. Do not start it for Phase 1. The API does not connect to it yet.

## Adding a backend endpoint later

1. Validator (request shape)
2. Service (rules)
3. Repository (Prisma)
4. Controller (HTTP)
5. Route registration in `src/routes`

Keep controllers thin.

## Adding a frontend screen later

1. Add a path in `src/constants/navigation.ts` only if it belongs in the shell.
2. Add a page under `src/pages`.
3. Register the route in `src/routes/AppRoutes.tsx`.
4. Reuse `PageHeader`, `EmptyState`, `ErrorState`, and `PageSkeleton` instead of one-off layout.

## Future phases (not started)

1. Database schema (Prisma + PostgreSQL)
2. Authentication (JWT, bcrypt, RBAC)
3. Customers
4. Products and inventory
5. Sales challans
6. CRM follow-ups
