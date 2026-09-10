# Mini ERP + CRM Operations Portal

Production-oriented operations portal for customers, products, inventory, sales challans, and CRM follow-ups.

**Phase 1 status:** project foundation, API shell, routing, application chrome, and design system. Database, authentication, and business modules are **not** implemented yet.

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Axios |
| Backend | Node.js, TypeScript, Express |
| Database (later) | PostgreSQL + Prisma |
| Auth (later) | JWT, bcrypt, RBAC |
| Deployment (later) | Frontend on Vercel, API on Render, PostgreSQL on Neon / Supabase / Render |

## Local setup

Prerequisites: Node.js 20+ and npm.

```bash
# Backend
cd backend
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
npm install
npm run dev

# Frontend (second terminal)
cd frontend
copy .env.example .env
npm install
npm run dev
```

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
| `npm test` | Health and 404 contract tests |

### Frontend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |

## Environment variables

See `backend/.env.example` and `frontend/.env.example`.

Used in Phase 1:

- `PORT`, `NODE_ENV`, `FRONTEND_URL`
- `VITE_API_BASE_URL`

Documented for later phases, unused now:

- `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`

Never commit real secrets.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)

## Current limitations

- No PostgreSQL / Prisma connection
- No JWT authentication or RBAC
- No customer, product, inventory, challan, or CRM business logic
- `docker-compose.yml` is a PostgreSQL placeholder and is not required to run Phase 1
