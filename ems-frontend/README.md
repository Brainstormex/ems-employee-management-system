# EMS Frontend

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui client for the Employee Management System.

> **Custom RBAC** — database roles, permission gates, `/admin/users` and `/admin/roles`.
> Phase 11 adds full Vercel deployment docs.

## Prerequisites

- Node.js 20+
- Running backend at `http://localhost:4000` (see `../ems-backend`) with migration `20260719150000_custom_rbac` applied

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

## Admin (RBAC)

- `/admin/users` — change role, enable/disable login (`users:manage`)
- `/admin/roles` — create/edit custom roles and permissions (`roles:manage`)
- System roles (`super-admin`, `hr-manager`, `employee`) are protected
- UI gates use permission keys from `/api/auth/me`

## Phase 10 features

- `/employees/import` — CSV upload; roles via `roleSlug`
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
