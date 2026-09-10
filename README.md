# Mini ERP + CRM Operations Portal

Production-oriented operations portal for customers, products, inventory, sales challans, and CRM follow-ups.

**Current status:** Phase 1 (application foundation) and Phase 2 (PostgreSQL + Prisma schema) are in place. Authentication and business APIs are **not** implemented yet.

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Axios |
| Backend | Node.js, TypeScript, Express |
| Database | PostgreSQL + Prisma |
| Auth (later) | JWT, bcrypt, RBAC |
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

Root `/` redirects to `/dashboard`. Sign-in is a structural placeholder and does not authenticate.

## Commands

### Backend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled API |
| `npm run typecheck` | Typecheck without emit |
| `npm test` | Health, 404, and database contract tests |
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
- `VITE_API_BASE_URL`

Documented for later phases, unused now:

- `JWT_SECRET`, `JWT_EXPIRES_IN`

Never commit real secrets.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)

## Current limitations

- No JWT authentication or RBAC
- No customer, product, inventory, challan, or CRM business APIs
- Seed users are not login-capable; `passwordHash` values are development placeholders
