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
| `FRONTEND_URL` | backend CORS and email action links | Used |
| `DATABASE_URL` | Prisma | Used |
| `VITE_API_BASE_URL` | frontend Axios | Used |
| `JWT_SECRET` | backend | Used (signing/verifying access tokens) |
| `JWT_EXPIRES_IN` | backend | Used (for example `1d`) |
| `EMAIL_FROM` | backend | Required for verification/reset email |
| `SMTP_HOST` | backend | Required for verification/reset email |
| `SMTP_PORT` | backend | Used (default `587`) |
| `SMTP_USER` / `SMTP_PASSWORD` | backend | Optional SMTP auth |
| `SMTP_SECURE` | backend | `true` for TLS on connect (typically port 465) |
| `GOOGLE_CLIENT_ID` | backend | Required for Google ID token verification |
| `GOOGLE_CLIENT_SECRET` | backend | Optional; reserved for the Google Cloud OAuth client |
| `VITE_GOOGLE_CLIENT_ID` | frontend | Same OAuth client ID as `GOOGLE_CLIENT_ID` |

`DATABASE_URL` and `JWT_SECRET` are required. In production `JWT_SECRET` must be a unique value of at least 32 characters. Never hardcode credentials.

### Local email (Mailpit)

Signup and password reset attempt real SMTP delivery. They do **not** pretend to succeed when SMTP is missing.

A local inbox that works without cloud credentials:

```bash
docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
```

In `backend/.env`:

```
FRONTEND_URL=http://localhost:5173
EMAIL_FROM="Operations Portal <noreply@localhost>"
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

Open http://localhost:8025 to read verification and reset messages. Action links use `FRONTEND_URL`.

### Google sign-in

1. Create a Web application OAuth client in Google Cloud.
2. Authorized JavaScript origins: `http://localhost:5173` (and the deployed frontend origin).
3. Set the same client ID in `backend/.env` (`GOOGLE_CLIENT_ID`) and `frontend/.env` (`VITE_GOOGLE_CLIENT_ID`).
4. `GOOGLE_CLIENT_SECRET` is not required for ID-token verification; keep it in backend env if the Cloud client issued one, and never commit it.

If either client ID is missing, Continue with Google fails with a configuration error instead of a fake success.

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

Seeded users share the **development/test** password `DevLogin!2026`. Hashes are bcrypt. Do not use this password outside local development and automated tests.

| Email | Role |
| --- | --- |
| `admin.dev@example.com` | ADMIN |
| `sales.dev@example.com` | SALES |
| `warehouse.dev@example.com` | WAREHOUSE |
| `accounts.dev@example.com` | ACCOUNTS |

## Authentication

Public self-registration always assigns **SALES**. Role is not accepted from the client. Google-created accounts use the same default. Seeded users remain verified so local password login keeps working.

- `POST /api/auth/signup` — public. Creates an unverified SALES user and emails a verification link. Does not return a JWT. Duplicate email → `409 DUPLICATE_EMAIL`. Missing SMTP → `503 EMAIL_NOT_CONFIGURED`.
- `POST /api/auth/login` — public. Returns `{ token, user }` for verified accounts. Failed login always uses a generic invalid-credentials message. Unverified users receive `403 EMAIL_NOT_VERIFIED`.
- `POST /api/auth/google` — public. Body `{ idToken }`. Backend verifies the token with Google. New users are SALES.
- `POST /api/auth/verify-email` — public. Body `{ token }`. Marks the email verified and returns a session JWT.
- `POST /api/auth/resend-verification` — public. Generic success message.
- `POST /api/auth/forgot-password` — public. Generic success message.
- `POST /api/auth/reset-password` — public. Body `{ token, password, confirmPassword }`. Invalidates unused reset tokens and increments `tokenVersion`.
- `GET /api/auth/me` — requires `Authorization: Bearer <JWT>`.
- Reusable `authenticate` middleware verifies the Bearer token, checks `tokenVersion`, and attaches `req.auth`.
- Reusable `authorizeRoles(UserRole.ADMIN, ...)` returns 401 if unauthenticated and 403 if the role is not allowed.

The frontend stores the access token in `localStorage` (key `mini-erp-crm.accessToken`) through `frontend/src/services/authSession.ts`. Axios attaches the header automatically. A 401 on a non-public-auth request clears the session and returns the user to `/login`. Logout is client-side deletion of that token. Password reset is the practical server-side session invalidation path (`tokenVersion`).

## Customer CRM

`ADMIN` and `SALES` can list, create, update, and add follow-ups. `WAREHOUSE` and `ACCOUNTS` are rejected with 403.

`businessName` and `address` are NOT NULL in the existing Prisma schema. The API treats them as optional in the request body and stores an empty string when omitted, so no migration is required.

Follow-up history rows also require `followUpDate` in the schema. If the client does not send a next follow-up date, the service uses the customer's current date or `now`.

Query parameters for `GET /api/customers`: `page`, `pageSize` (max 100), `search`, `status`, `customerType`, `followUp` (`overdue` \| `dueToday` \| `upcoming` \| `none`), `sortBy`, `sortOrder`.

## Products and inventory

`ADMIN` and `WAREHOUSE` can create and edit products and record IN/OUT movements. `SALES` and `ACCOUNTS` can list and view only.

`Product.minStock` is the alert threshold. Status: `CRITICAL` at zero stock, `LOW` when on-hand is above zero but at or below min, otherwise `HEALTHY`.

Stock updates use `prisma.$transaction` plus `SELECT ... FOR UPDATE` on the product row, then update `currentStock` and insert `StockMovement`. Failed OUT requests leave stock and history unchanged. Initial stock greater than zero writes an `Initial stock` IN movement in the same create transaction.

Query parameters for `GET /api/products` and `GET /api/inventory`: `page`, `pageSize` (max 100), `search`, `category`, `location`, `stockStatus` (`HEALTHY` \| `LOW` \| `CRITICAL`), `sortBy`, `sortOrder`.

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

Keep controllers thin. Stock mutations already run in a Prisma transaction in the product repository.

## Adding a frontend screen later

1. Add a path in `src/constants/navigation.ts` only if it belongs in the shell.
2. Add a page under `src/pages`.
3. Register the route in `src/routes/AppRoutes.tsx`.
4. Reuse `PageHeader`, `EmptyState`, `ErrorState`, and `PageSkeleton`.

## Future phases (not started)

1. Sales challans
2. Aggregated follow-up workspace (`/crm`)
3. Dashboard analytics
