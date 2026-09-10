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
| `User` | Staff accounts (JWT + bcrypt + RBAC) |
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
 └── SalesChallan (author)

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
- Atomic stock updates still belong in a later service/transaction phase

### Delete strategy

Historical documents must survive master-data cleanup.

| Parent delete | Child | Behavior |
| --- | --- | --- |
| User | follow-ups, movements, challans | Restrict |
| Customer | follow-ups, challans | Restrict |
| Product | movements, challan items | Restrict |
| SalesChallan | challan items | Cascade |

Challan line items are part of the document, so they are removed only if the header is removed. Confirmed challans should not be deleted in application code later; `INACTIVE` customers and catalog changes should be handled without destroying history.

`StockMovement` has `createdAt` only. Movements are an append-only ledger.

## Frontend architecture

- Route tables live in `frontend/src/routes`.
- `AppLayout` is the shell (sidebar + top bar + main).
- `AuthLayout` is used for `/login`.
- `ProtectedRoute` requires a restored authenticated session. Unauthenticated users are redirected to `/login`.
- `GuestRoute` keeps `/login` public and sends authenticated users to `/dashboard`.
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

Access tokens are JWTs signed with `JWT_SECRET`. Claims are limited to `sub` (user id) and `role`. Passwords are stored as bcrypt hashes and are never returned by the API.

`authenticate` requires a Bearer token. `authorizeRoles(...)` is the reusable RBAC gate. Backend authorization is authoritative; the frontend only uses role for later navigation filtering.

## What is not implemented yet

- Customer / product / inventory / challan / CRM HTTP APIs
- Frontend business screens beyond Phase 1 placeholders
- Refresh tokens, OAuth, password reset, or MFA
