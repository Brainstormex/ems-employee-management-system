# EMS Frontend

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui client for the Employee Management System.

> **Phase 10 complete** — CSV employee import.
> Phase 11 adds full Vercel deployment docs.

## Prerequisites

- Node.js 20+
- Running backend at `http://localhost:4000` (see `../ems-backend`)

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Description |
|----------|-------------|
| `API_PROXY_TARGET` | Backend origin for `/api` rewrites (server-only) |
| `NEXT_PUBLIC_API_URL` | Leave empty (recommended). Same-origin `/api` keeps cookies on the Next host. |

Set both in the Vercel dashboard for production. Example:

```
API_PROXY_TARGET=https://ems-api.onrender.com
NEXT_PUBLIC_API_URL=
```

Backend `CORS_ORIGIN` should still include your Vercel URL if you ever call the API cross-origin; with rewrites, browser traffic stays same-origin.

## Phase 10 features

- `/employees/import` — CSV upload (HR / Super Admin); partial success with per-row errors
- Sample file at `/samples/employees-import.csv`

## Phase 9 features

- `/dashboard` — live stat cards + Recharts (employees by department, status split, hires/month)
- `/organization` — expandable org tree (name, designation, direct report count) + **My team** for direct reports

## Phase 8 features

- `/employees` — search, department/role/status filters, sort, pagination
- `/employees/new` — HR / Super Admin create form (Zod + RHF)
- `/employees/[id]` — detail view, edit (role-aware), soft-delete (Super Admin)
- `/profile` — employee self-edit (`phone`, `profileImageUrl` only)

## Phase 7 features

- `/login` with Zod + react-hook-form validation
- JWT session via httpOnly cookies (`credentials: "include"`)
- Auto refresh on 401 via `/api/auth/refresh`
- Next.js middleware redirects unauthenticated users to `/login`
- App shell with nav, user menu, logout
- Dark mode toggle (`next-themes` + Tailwind `dark:`)
- Placeholder pages for employees / organization / profile (organization + dashboard now live in Phase 9)

## Demo logins

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@ems.local` | `Admin@12345` |
| HR | `hr1@ems.local` | `Hr@12345678` |
| Employee | `alex.rivera@ems.local` | `Employee@123` |

## Schema sync

Types live in `src/types`. Auth Zod schema in `src/schemas/auth.schema.ts`.
Frontend uses **Zod 4**; backend uses **Zod 3** — keep validation *rules* identical even if option names differ (`message` vs `required_error`).
When changing validation on the backend, update the frontend copy and `CONTRACT.md`.
