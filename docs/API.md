# API reference

Base URL: `{API_ORIGIN}/api` (local default `http://localhost:4000/api`).

Success shape:

```json
{ "success": true, "message": "...", "data": {} }
```

Error shape:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

Authenticated routes require:

```
Authorization: Bearer <accessToken>
```

## Health

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | none | `200` when database is connected; `503` when disconnected (body still uses the success envelope with `database: "disconnected"`) |

## Auth

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/auth/signup` | none | Always creates `SALES`; returns session JWT immediately (SMTP not required) |
| POST | `/auth/login` | none | Email + password; does not require `emailVerifiedAt` |
| POST | `/auth/google` | none | Server-side Google ID token verify |
| POST | `/auth/verify-email` | none | Optional; consumes verification token; returns session |
| POST | `/auth/resend-verification` | none | Optional; requires SMTP; generic response |
| POST | `/auth/forgot-password` | none | Requires SMTP; generic response |
| POST | `/auth/reset-password` | none | Bumps `tokenVersion` |
| GET | `/auth/me` | JWT | Current user (no password hash) |

Rate limits apply to login, signup, forgot-password, resend-verification, and related sensitive auth routes.

## Customers (ADMIN, SALES)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/customers` | Query: `search`, `status`, `customerType`, `followUp`, `sortBy`, `sortOrder`, `page`, `pageSize` |
| POST | `/customers` | Create |
| GET | `/customers/:id` | Detail + recent follow-ups |
| PATCH | `/customers/:id` | Partial update |
| GET | `/customers/:id/follow-ups` | Timeline |
| POST | `/customers/:id/follow-ups` | Append follow-up |

No customer DELETE.

## Products (view: all authenticated; mutate: ADMIN, WAREHOUSE)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/products` | Paginated list |
| POST | `/products` | Create; optional opening stock |
| GET | `/products/:id` | Detail |
| PATCH | `/products/:id` | Metadata only; `currentStock` rejected |

## Inventory (view: all authenticated; move: ADMIN, WAREHOUSE)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/inventory` | List + stock summary |
| GET | `/inventory/:productId/movements` | History |
| POST | `/inventory/:productId/movements` | `IN` / `OUT`; OUT rejects insufficient stock |

No movement DELETE.

## Challans (view: all authenticated; mutate: ADMIN, SALES)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/challans` | Paginated list |
| POST | `/challans` | Create `DRAFT` (no stock change) |
| GET | `/challans/:id` | Detail with snapshots |
| GET | `/challans/:id/pdf` | Download Sales Challan PDF (read-only; uses historical item snapshots) |
| PATCH | `/challans/:id` | Edit draft only |
| POST | `/challans/:id/confirm` | Atomic stock deduction |
| POST | `/challans/:id/cancel` | Cancel draft only |

No challan DELETE. Confirmed challans cannot be cancelled.

## Postman

Import [`postman/Mini-ERP-CRM.postman_collection.json`](./postman/Mini-ERP-CRM.postman_collection.json).

1. Set `baseUrl` (default `http://localhost:4000/api`).
2. Run **Auth → POST login** (seeded admin/sales accounts) to populate `accessToken`.
3. Use Customers / Products / Inventory / Challans folders as needed.
4. Replace placeholder IDs or rely on test scripts that capture created IDs.

Collection variables use placeholders only. Do not commit real production tokens.
