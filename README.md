# Mini ERP + CRM Operations Portal

Production-oriented operations portal for customers, products, inventory, sales challans, and CRM follow-ups.

**Current status:** Phases 1–3 are in place (application foundation, PostgreSQL + Prisma, JWT authentication). Business APIs for customers, products, inventory, challans, and CRM are **not** implemented yet.

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Axios |
| Backend | Node.js, TypeScript, Express |
| Database | PostgreSQL + Prisma |
| Auth | JWT, bcrypt, RBAC |
| Deployment (later) | Frontend on Vercel, API on Render, PostgreSQL on Neon / Supabase / Render |

## Local setup

Prerequisites: Node.js 20+, npm, and PostgreSQL 16.

```bash
# Start PostgreSQL (Docker, if installed)
docker compose up -d postgres

# Backend
cd backend
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (second terminal)
cd frontend
copy .env.example .env
npm install
npm run dev
```

If Docker is not available, point `DATABASE_URL` at a local PostgreSQL 16 instance, create database `mini_erp_crm`, then run the Prisma commands above.

- API: http://localhost:4000
- Health: http://localhost:4000/api/health
- Web: http://localhost:5173

Root `/` redirects to `/dashboard`. Unauthenticated users are sent to `/login`.

### Development / test credentials

These accounts exist only in seed data. They are **not** production credentials.

Password for every seeded user: `DevLogin!2026`

| Email | Role |
| --- | --- |
| `admin.dev@example.com` | ADMIN |
| `sales.dev@example.com` | SALES |
| `warehouse.dev@example.com` | WAREHOUSE |
| `accounts.dev@example.com` | ACCOUNTS |

## Commands

### Backend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled API |
| `npm run typecheck` | Typecheck without emit |
| `npm test` | Health, 404, database, and authentication tests |
| `npm run prisma:validate` | Validate `schema.prisma` |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create/apply development migrations |
| `npm run prisma:migrate:deploy` | Apply migrations (CI/production) |
| `npm run prisma:seed` | Load development seed data |

### Frontend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |

## Environment variables

See `backend/.env.example` and `frontend/.env.example`.

Used now:

- `PORT`, `NODE_ENV`, `FRONTEND_URL`, `DATABASE_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `VITE_API_BASE_URL`

Never commit real secrets. `JWT_SECRET` must be a unique value in every environment.

## Authentication

`POST /api/auth/login` validates email and password, compares the stored bcrypt hash, and returns a JWT plus safe user fields (`id`, `name`, `email`, `role`). Password hashes are never returned.

Authenticated requests send:

```
Authorization: Bearer <token>
```

`GET /api/auth/me` returns the current user and requires a valid JWT.

Roles: `ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`. Reusable `authorizeRoles(...)` middleware returns 401 when unauthenticated and 403 when the role is not allowed. Frontend navigation can read the role; backend RBAC remains authoritative.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)

## Current limitations

- No customer, product, inventory, challan, or CRM business APIs
- Access tokens are stored in the browser for this case study (no refresh-token rotation)
- JWT is stateless; logout is client-side only
