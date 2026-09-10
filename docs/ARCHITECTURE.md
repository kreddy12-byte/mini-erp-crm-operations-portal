# Architecture

This document records decisions for the Mini ERP + CRM Operations Portal. It does not describe unimplemented business features as complete.

## Purpose

Grow a production operations portal without rewriting the shell, API envelope, visual language, or persistence model.

## Repository layout

```
frontend/    React + Vite application
backend/     Express + TypeScript API
backend/prisma/  Prisma schema, migrations, seed
docs/        Architecture and development notes
```

Backend source is grouped by HTTP role:

- `routes` register paths
- `controllers` translate HTTP to service calls
- `services` own business rules (later phases)
- `repositories` wrap Prisma; the shared client lives in `src/config/database.ts`
- `validators` own request validation
- `middleware` owns cross-cutting HTTP behavior, including JWT authentication and RBAC

## API envelope

Success:

```json
{
  "success": true,
  "message": "API is healthy",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User-friendly message"
  }
}
```

`AppError` is the operational error type. The error middleware never returns stack traces, filesystem paths, secrets, or environment values.

`GET /api/health` also reports `database: "connected" | "disconnected"` so process liveness is not confused with PostgreSQL availability. In development the API still starts if PostgreSQL is down. In production a failed database connection stops startup.

## Database

PostgreSQL is the system of record. Prisma is the TypeScript access layer. `DATABASE_URL` is the only connection setting; the same URL shape works for local Postgres, Neon, Supabase, and Render.

The shared `PrismaClient` is constructed once in `backend/src/config/database.ts`. Request handlers must not create additional clients.

### Entities

| Model | Purpose |
| --- | --- |
| `User` | Staff accounts (JWT + bcrypt + RBAC, optional Google identity) |
| `AuthToken` | Hashed, expiring, single-use email verification and password reset tokens |
| `Customer` | CRM/customer master |
| `CustomerFollowUp` | Follow-up timeline, separate from the customer's current note |
| `Product` | Catalog and on-hand quantity |
| `StockMovement` | Immutable IN/OUT inventory history |
| `SalesChallan` | Sales delivery document header |
| `SalesChallanItem` | Challan lines with product snapshots |

Location/warehouse is a `Product.location` string. A warehouse subsystem is out of scope.

### Relationships

```
User
 ├── CustomerFollowUp (author)
 ├── StockMovement (author)
 ├── SalesChallan (author)
 └── AuthToken (verification / reset; cascade on user delete)

Customer
 ├── CustomerFollowUp
 └── SalesChallan

Product
 ├── StockMovement
 └── SalesChallanItem

SalesChallan
 └── SalesChallanItem
```

### Challan snapshot

`SalesChallanItem` stores `productId` **and** `productNameSnapshot`, `skuSnapshot`, `unitPriceSnapshot`.

The product id keeps the line tied to the catalog row. The snapshot fields are the values that were true when the challan was written, so later catalog edits cannot rewrite history.

### Money and quantities

- `unitPrice` and `unitPriceSnapshot` use `Decimal(12, 2)`
- Stock and movement quantities use integers
- SQL `CHECK` constraints reject negative `currentStock` and non-positive movement/challan quantities
- Stock changes go through `Product` + `StockMovement` in one Prisma interactive transaction with `SELECT ... FOR UPDATE` on the product row. Concurrent adjustments on the same product serialize. This is row locking, not a distributed lock. Prisma's transaction timeout (default 5s) is the practical limit.

### Delete strategy

Historical documents must survive master-data cleanup.

| Parent delete | Child | Behavior |
| --- | --- | --- |
| User | follow-ups, movements, challans | Restrict |
| User | auth tokens | Cascade |
| Customer | follow-ups, challans | Restrict |
| Product | movements, challan items | Restrict |
| SalesChallan | challan items | Cascade |

Challan line items are part of the document, so they are removed only if the header is removed. Confirmed challans should not be deleted in application code later; `INACTIVE` customers and catalog changes should be handled without destroying history.

`StockMovement` has `createdAt` only. Movements are an append-only ledger.

## Frontend architecture

- Route tables live in `frontend/src/routes`.
- `AppLayout` is the shell (sidebar + top bar + main).
- `AuthLayout` is used for `/login`, `/signup`, `/forgot-password`, `/reset-password`, and `/verify-email`.
- `ProtectedRoute` requires a restored authenticated session. Unauthenticated users are redirected to `/login`.
- `GuestRoute` keeps `/login`, `/signup`, and `/forgot-password` public and sends authenticated users to `/dashboard`.
- `/reset-password` and `/verify-email` stay reachable with a token even if a session already exists, so email links are not discarded.
- Auth state lives in `AuthProvider`. Axios lives in `frontend/src/services/api.ts` and attaches the Bearer token from `authSession`.

## Design system

Tokens are defined in `frontend/src/index.css` (`@theme`).

Intent:

- Forest primary (`#1B4332`) on warm stone canvas
- IBM Plex Sans
- Tight typography hierarchy instead of large decorative cards
- Subtle borders and low-elevation shadows
- Status color is never the only signal (badges include a text label for screen readers)

## Authentication

Access tokens are JWTs signed with `JWT_SECRET`. Claims are `sub` (user id), `role`, and `tokenVersion`. Passwords are stored as bcrypt hashes (cost 10) and are never returned by the API. `passwordHash` is nullable so Google-only accounts do not store a password.

`authenticate` requires a Bearer token, loads the user, and rejects the session when `tokenVersion` does not match (used after password reset). `authorizeRoles(...)` is the reusable RBAC gate. Backend authorization is authoritative; the frontend only uses role for navigation filtering.

### Signup and default role

Public `POST /api/auth/signup` ignores any `role` field on the request. New self-registered users are always `SALES`. This is an ERP security rule: a public form must not be able to select `ADMIN`, `WAREHOUSE`, or `ACCOUNTS`. Privileged roles are assigned by seed data or by an administrator outside this public flow. There is no public endpoint that lets a user elevate their own role.

Password rules: at least 10 characters, at least one letter and one number, confirmation must match. Email is trimmed and lowercased.

Signup does not return a JWT. The user must verify email first.

### Email verification and password reset

`AuthToken` rows store SHA-256 hashes of opaque tokens (`randomBytes(32)` as base64url). Raw tokens appear only in emailed links built from `FRONTEND_URL`. Tokens expire (24h verification, 1h reset), are single-use, and unused tokens of the same type are invalidated when a new one is issued.

`EmailService` (`backend/src/services/email.service.ts`) is the delivery abstraction. Authentication code does not contain SMTP details. If `SMTP_HOST` or `EMAIL_FROM` is missing, signup/resend/forgot-password return `503 EMAIL_NOT_CONFIGURED` instead of claiming that mail was sent.

Forgot-password and resend-verification use the same generic success message whether or not the email exists, after email delivery is confirmed to be configured.

Password reset hashes the new password with bcrypt and increments `tokenVersion` so previously issued JWTs fail `authenticate`.

### Google sign-in

The React app uses Google Identity Services to obtain an ID token. `POST /api/auth/google` verifies that token server-side with `google-auth-library` (`GOOGLE_CLIENT_ID` as audience). The API never trusts a client-supplied email.

- Existing `googleId` → sign in
- Existing user with the same verified email → link `googleId` and sign in (role unchanged)
- New Google user → create `SALES` account with `passwordHash` null and email already verified

If `GOOGLE_CLIENT_ID` is unset, the API returns `503 GOOGLE_NOT_CONFIGURED`. The frontend shows a clear error when `VITE_GOOGLE_CLIENT_ID` is missing. There is no fake Google button success path.

### JWT storage tradeoff

The frontend keeps the access token in `localStorage` (`mini-erp-crm.accessToken`) and sends `Authorization: Bearer`. HttpOnly cookies were not adopted here because the existing Axios Bearer architecture already works for this case study and switching storage would require CSRF work for a cookie session. The XSS tradeoff is documented: a script injected into the origin can read the token. Logout is client-side deletion; the JWT remains cryptographically valid until expiry unless `tokenVersion` has changed.

A “remember me” checkbox is not offered. Persistence already matches `JWT_EXPIRES_IN`; a checkbox that did not change server expiry would be misleading.

### Rate limiting

In-memory limits (process-local, not Redis):

- 8 failed password logins per email per 15 minutes
- 5 signup / resend / forgot-password requests per email per 15 minutes

This is a practical case-study control, not a distributed rate limiter.

## Customer CRM

`GET/POST /api/customers` and `GET/PATCH /api/customers/:id` plus nested follow-ups. `ADMIN` and `SALES` may manage customers. `WAREHOUSE` and `ACCOUNTS` cannot. Follow-up `createdBy` is always the authenticated user. Customer rows are not deleted.

The Prisma `Customer` / `CustomerFollowUp` models from Phase 2 are reused without a new migration. Sales challans for a customer are listed through `GET /api/challans?customerId=`.

## Products and inventory

The Phase 2 `Product` and `StockMovement` models are reused without a schema change. `Product.minStock` is the minimum stock alert quantity (the case-study name `minStockAlertQty`).

Stock status is calculated in `backend/src/services/stock-status.ts` and returned on every product payload:

- `CRITICAL` when `currentStock` is 0 (checked first, including when `minStock` is also 0)
- `LOW` when `currentStock > 0` and `currentStock <= minStock`
- `HEALTHY` when `currentStock > minStock`

`PATCH /api/products/:id` cannot change `currentStock`. IN/OUT movements are the only stock writes. `createdBy` on a movement is always `req.auth.id`. Creating a product with `currentStock > 0` also writes an `Initial stock` IN movement in the same transaction.

RBAC:

| Action | ADMIN | WAREHOUSE | SALES | ACCOUNTS |
| --- | --- | --- | --- | --- |
| View products / inventory / history | yes | yes | yes | yes |
| Create / edit products | yes | yes | no | no |
| Record IN/OUT movements | yes | yes | no | no |

Frontend routes: `/products`, `/products/:id`, `/inventory`. Navigation hiding is UX only.

## Sales challans

The Phase 2 `SalesChallan` / `SalesChallanItem` models are reused without a schema change. HTTP APIs live at `/api/challans`. There is no DELETE: historical documents stay in the database, and `CANCELLED` is the terminal draft exit.

Lifecycle:

- Create is always `DRAFT`. Stock is not reduced. No `OUT` movement is written.
- `PATCH` is allowed only while `DRAFT`. Item snapshots are re-read from the current product rows. Clients cannot set `challanNumber`, `createdBy`, `status`, `createdAt`, `totalQuantity`, or snapshot fields.
- `POST /api/challans/:id/confirm` runs in one Prisma interactive transaction: lock the challan `FOR UPDATE`, lock product rows `FOR UPDATE` in id order, reject the whole request if any line lacks stock, then deduct stock, write one `OUT` movement per line (`Sales challan {challanNumber}`), and set `CONFIRMED`. Snapshots are not rewritten.
- `DRAFT → CANCELLED` is allowed and does not touch stock. `CONFIRMED → CANCELLED` is rejected (`409 INVALID_CHALLAN_STATE`) so inventory is not silently reversed.

Challan numbers are allocated server-side as `CHL-YYYYMMDD-####` (UTC day sequence) under a PostgreSQL advisory lock, with the unique constraint as a collision backstop.

RBAC:

| Action | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
| --- | --- | --- | --- | --- |
| View list / detail | yes | yes | yes | yes |
| Create / edit drafts | yes | yes | no | no |
| Confirm / cancel drafts | yes | yes | no | no |

Frontend routes: `/challans`, `/challans/new`, `/challans/:id`. Navigation hiding is UX only. Warehouse and Accounts can view but cannot create, edit, confirm, or cancel.

## What is not implemented yet
- Dashboard analytics
- The aggregated `/crm` follow-up workspace
- Refresh tokens or MFA
