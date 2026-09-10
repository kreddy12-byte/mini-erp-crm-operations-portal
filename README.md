# Mini ERP + CRM Operations Portal

Production-oriented operations portal for customers, products, inventory, sales challans, and CRM follow-ups.

**Current status:** Phases 1–8 are complete (foundation through CRM follow-up operations). Phase 9 focuses on production hardening and deployment readiness.

## Business problem

Small and mid-size trading teams need one place to manage customers and follow-ups, keep product stock accurate, and issue sales challans without losing inventory integrity. This portal keeps CRM and stock/challan workflows on a shared authenticated backend with role-based access.

## Features

- JWT authentication (email/password + Google), email verification, password reset, RBAC
- Customer CRM with search, filters, pagination, and follow-up history
- CRM operations workspace (`/crm`) with queue filters and KPIs
- Products with unique SKU and inventory movements (no negative stock)
- Sales challans: draft → confirm (atomic stock deduction) or cancel draft
- Premium responsive operations UI and shared design system

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Axios |
| Backend | Node.js, TypeScript, Express, Helmet |
| Database | PostgreSQL + Prisma |
| Auth | JWT, bcrypt, RBAC, Google Identity, SMTP email |
| Deployment | Frontend static (Vercel/Netlify), API Node host, managed PostgreSQL |

## Architecture

- SPA talks to a versioned REST API under `/api`
- Express layers: routes → controllers → services → repositories (Prisma)
- Backend RBAC is authoritative; frontend navigation is UX only
- Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Project structure

```
frontend/          React SPA
backend/           Express API + Prisma
docs/              Architecture, development, API, deployment
docker-compose.yml Local PostgreSQL only
```

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

Root `/` redirects to `/dashboard`. Unauthenticated users are sent to `/login`. Public auth routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`.

### Development / test credentials

These accounts exist only in seed data. They are **not** production credentials.

Password for every seeded user: `DevLogin!2026`

| Email | Role |
| --- | --- |
| `admin.dev@example.com` | ADMIN |
| `sales.dev@example.com` | SALES |
| `warehouse.dev@example.com` | WAREHOUSE |
| `accounts.dev@example.com` | ACCOUNTS |

`prisma db seed` refuses to run when `NODE_ENV=production` unless `ALLOW_PROD_SEED=true`.

## Commands

### Backend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled API |
| `npm run start:deploy` | `prisma migrate deploy` then `npm start` |
| `npm run typecheck` | Typecheck without emit |
| `npm test` | Health, database, auth, customers, products/inventory, challans |
| `npm run prisma:migrate` | Create/apply development migrations |
| `npm run prisma:migrate:deploy` | Apply migrations (CI/production) |
| `npm run prisma:seed` | Load development seed data |

### Frontend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |
| `npm run typecheck` | Typecheck |

## Environment variables

See `backend/.env.example`, `frontend/.env.example`, and the root `.env.example` index.

**Backend (required in production):** `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET` (≥32 chars, not the example), `JWT_EXPIRES_IN`, `FRONTEND_URL` (non-localhost absolute origin).

**Backend (feature-gated):** `EMAIL_FROM`, `SMTP_*`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**Frontend (build-time):** `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`.

Never commit real secrets. Signup/verification/reset need SMTP; Google sign-in needs a Google OAuth client ID.

## Authentication / RBAC

Public self-registration always creates a **SALES** user. Google-created accounts use the same default. Seeded staff accounts remain the way to obtain privileged roles in local development.

Password hashes use bcrypt and are never returned. Verification and reset tokens are stored as SHA-256 hashes, expire, and are single-use. Password login requires a verified email. Password reset increments `tokenVersion` so older JWTs stop working.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create a SALES account and send a verification email |
| POST | `/api/auth/login` | Email/password login (verified accounts only) |
| POST | `/api/auth/google` | Google Identity Services ID token, verified server-side |
| POST | `/api/auth/verify-email` | Consume a verification token and issue a session |
| POST | `/api/auth/resend-verification` | Resend a verification email (generic response) |
| POST | `/api/auth/forgot-password` | Send a reset email (generic response) |
| POST | `/api/auth/reset-password` | Set a new password and bump `tokenVersion` |
| GET | `/api/auth/me` | Current user; requires `Authorization: Bearer <JWT>` |

Authenticated requests send:

```
Authorization: Bearer <token>
```

Roles: `ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`.

| Area | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
| --- | --- | --- | --- | --- |
| Customers / CRM | yes | yes | no | no |
| Products / inventory view | yes | yes | yes | yes |
| Products / stock mutate | yes | no | yes | no |
| Challans view | yes | yes | yes | yes |
| Challans mutate | yes | yes | no | no |

## Customer CRM

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/customers` | Paginated list with filters including `followUp` |
| GET | `/api/customers/:id` | Detail and recent follow-up history |
| POST | `/api/customers` | Create |
| PATCH | `/api/customers/:id` | Partial update |
| GET | `/api/customers/:id/follow-ups` | Timeline |
| POST | `/api/customers/:id/follow-ups` | Append follow-up |

Frontend: `/customers`, `/customers/:id`, `/crm`. No customer DELETE.

## Products and inventory

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/products` | Paginated list |
| GET | `/api/products/:id` | Detail + recent movements |
| POST | `/api/products` | Create (opening stock allowed) |
| PATCH | `/api/products/:id` | Metadata only; `currentStock` rejected |
| GET | `/api/inventory` | Inventory list + summary |
| GET | `/api/inventory/:productId/movements` | Movement history |
| POST | `/api/inventory/:productId/movements` | IN/OUT |

Frontend: `/products`, `/products/:id`, `/inventory`. No movement DELETE.

## Sales challans

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/challans` | Paginated list |
| GET | `/api/challans/:id` | Detail with snapshots |
| POST | `/api/challans` | Create draft |
| PATCH | `/api/challans/:id` | Edit draft |
| POST | `/api/challans/:id/confirm` | Confirm + atomic stock deduction |
| POST | `/api/challans/:id/cancel` | Cancel draft only |

Frontend: `/challans`, `/challans/new`, `/challans/:id`. No challan DELETE; confirmed challans cannot be cancelled.

## Health

`GET /api/health` returns `200` when the database is connected and `503` when it is not. Responses never include credentials.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)
- [API reference](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Postman collection](docs/postman/Mini-ERP-CRM.postman_collection.json)

## Docker

`docker compose up -d postgres` starts local PostgreSQL 16 for development. There is no application Dockerfile; deploy the API as a Node service and the frontend as static assets. See [Deployment](docs/DEPLOYMENT.md).

## Deployment (summary)

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Deploy backend with production env vars; run `prisma migrate deploy` then `npm start` (or `npm run start:deploy`).
3. Build frontend with `VITE_API_BASE_URL` pointing at the deployed API; enable SPA fallback (`vercel.json` / Netlify redirects).
4. Set backend `FRONTEND_URL` to the SPA origin.

## Known limitations / production assumptions

- Access tokens are stored in `localStorage` (XSS-sensitive). Harden CSP on the SPA host.
- Auth rate limits are in-memory per process (not shared across multiple API instances).
- No MFA and no refresh-token rotation.
- SMTP and Google credentials are environment-specific and are not in the repo.
- Seed demo passwords must never be used as production accounts.
- Dashboard shows operational entry points and CRM-related signals; it is not a full BI suite.
