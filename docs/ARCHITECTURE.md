# Architecture — Phase 1

This document records decisions for the Mini ERP + CRM Operations Portal foundation. It does not describe unimplemented business features as complete.

## Purpose

Establish a repository that can grow into a production operations portal without rewriting the shell, API envelope, or visual language.

## Repository layout

```
frontend/    React + Vite application
backend/     Express + TypeScript API
docs/        Architecture and development notes
```

Frontend source is grouped by UI role (`components/ui`, `navigation`, `feedback`), routing, services, and pages.

Backend source is grouped by HTTP role:

- `routes` register paths
- `controllers` translate HTTP to service calls
- `services` will own business rules
- `repositories` will own persistence (Prisma, later)
- `validators` will own request validation
- `middleware` owns cross-cutting HTTP behavior

Empty-looking repository and validator modules exist so later phases have a defined home. They do not fake a database.

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

## Frontend architecture

- Route tables live in `frontend/src/routes`.
- `AppLayout` is the authenticated-looking shell (sidebar + top bar + main).
- `AuthLayout` is used for `/login`.
- `ProtectedRoute` currently renders its outlet. JWT checks will be added here later. It does not invent a fake user.
- Axios lives in `frontend/src/services/api.ts` with a configurable base URL and a reserved request interceptor for a future Authorization header.

## Design system

Tokens are defined in `frontend/src/index.css` (`@theme`).

Intent:

- Forest primary (`#1B4332`) on warm stone canvas
- IBM Plex Sans
- Tight typography hierarchy instead of large decorative cards
- Subtle borders and low-elevation shadows
- Status color is never the only signal (badges include a text label for screen readers)

## What Phase 1 explicitly does not include

- Prisma schema or PostgreSQL queries
- JWT issuance, bcrypt, or role checks
- Customer / product / inventory / challan / CRM domain logic
- Reports, settings, or extra navigation items without a requirement
