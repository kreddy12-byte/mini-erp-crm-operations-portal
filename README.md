# Mini ERP + CRM Operations Portal

Production-oriented operations portal for customers, products, inventory, sales challans, and CRM follow-ups.

**Current status:** Phases 1–6 backend are in place (foundation, PostgreSQL, authentication, Customer CRM, Products & Inventory, Sales Challan APIs). The sales challan UI and dashboard analytics are **not** implemented yet.

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Axios |
| Backend | Node.js, TypeScript, Express |
| Database | PostgreSQL + Prisma |
| Auth | JWT, bcrypt, RBAC, Google Identity, SMTP email |
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

## Commands

### Backend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled API |
| `npm run typecheck` | Typecheck without emit |
| `npm test` | Health, 404, database, authentication (including signup/Google/reset), customer CRM, product/inventory, and sales challan tests |
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
- `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`

Never commit real secrets. `JWT_SECRET` must be a unique value in every environment.

Signup, verification, and password-reset emails require SMTP. Google sign-in requires a Google OAuth client ID. If those are missing, the API returns a clear 503 instead of pretending the action succeeded.

## Authentication

Public self-registration always creates a **SALES** user. The signup request cannot choose `ADMIN`, `WAREHOUSE`, or `ACCOUNTS`. Google-created accounts use the same default. Seeded staff accounts remain the way to obtain privileged roles in local development.

Password hashes use bcrypt (cost 10) and are never returned. Verification and reset tokens are stored as SHA-256 hashes, expire, and are single-use. Password login requires a verified email.

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

Roles: `ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`. Reusable `authorizeRoles(...)` middleware returns 401 when unauthenticated and 403 when the role is not allowed. Frontend navigation can read the role; backend RBAC remains authoritative.

## Customer CRM

Customer records are available to **ADMIN** and **SALES**. Warehouse and Accounts receive 403 from the API. Navigation hiding is UX only.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/customers` | Paginated list with `search`, `status`, `customerType`, `followUp`, `sortBy`, `sortOrder`, `page`, `pageSize` |
| GET | `/api/customers/:id` | Customer detail and recent follow-up history |
| POST | `/api/customers` | Create customer |
| PATCH | `/api/customers/:id` | Partial update |
| GET | `/api/customers/:id/follow-ups` | Follow-up timeline |
| POST | `/api/customers/:id/follow-ups` | Append a follow-up (`createdBy` is the authenticated user) |

There is no customer DELETE. Historical records are preserved.

Frontend routes: `/customers`, `/customers/:id`.

## Products and inventory

All authenticated roles may view products and inventory. **ADMIN** and **WAREHOUSE** may create/edit products and record stock movements. **SALES** and **ACCOUNTS** are view-only. Navigation hiding is UX only.

Stock cannot be edited on the product form. OUT movements that would go below zero are rejected with `409 INSUFFICIENT_STOCK` and neither stock nor history is changed.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/products` | Paginated list with `search`, `category`, `stockStatus`, `sortBy`, `sortOrder`, `page`, `pageSize` |
| GET | `/api/products/:id` | Product detail, stock status, and recent movements |
| POST | `/api/products` | Create product (optional opening IN movement when initial stock > 0) |
| PATCH | `/api/products/:id` | Metadata update; `currentStock` is rejected |
| GET | `/api/inventory` | Inventory-oriented list plus healthy/low/critical summary |
| GET | `/api/inventory/:productId/movements` | Paginated movement history |
| POST | `/api/inventory/:productId/movements` | Record IN/OUT (`createdBy` is the authenticated user) |

Frontend routes: `/products`, `/products/:id`, `/inventory`. There is no movement DELETE.

## Sales challans

All authenticated roles may view challans. **ADMIN** and **SALES** may create and edit drafts, confirm, and cancel drafts. **WAREHOUSE** and **ACCOUNTS** are view-only. Navigation hiding is UX only.

Create is always `DRAFT` and does not change stock. Confirmation deducts stock atomically, writes `OUT` movements, and sets `CONFIRMED`. Confirmed challans cannot be cancelled (no silent stock restore). There is no challan DELETE.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/challans` | Paginated list with `search`, `status`, `customerId`, `sortBy`, `sortOrder`, `page`, `pageSize` |
| GET | `/api/challans/:id` | Challan detail with snapshot line items |
| POST | `/api/challans` | Create a draft (`createdBy` is the authenticated user) |
| PATCH | `/api/challans/:id` | Edit a draft customer/items; snapshots refresh from current products |
| POST | `/api/challans/:id/confirm` | Confirm: lock, validate stock, deduct, write OUT movements |
| POST | `/api/challans/:id/cancel` | Cancel a draft only |

The `/challans` frontend page remains a placeholder.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)

## Current limitations

- Sales challan UI is not implemented yet (`/challans` is a placeholder)
- Dashboard does not yet show operational analytics
- Access tokens are stored in `localStorage` (XSS-sensitive; see architecture notes). Logout deletes the browser copy; password reset increments `tokenVersion` so older JWTs stop working.
- SMTP and Google credentials are environment-specific and are not included in the repo
- There is no MFA and no refresh-token rotation
