# EMS Backend

Express + TypeScript + Prisma + PostgreSQL API for the Employee Management System.

> **Phase 6 complete** — production Docker image, migrations, and Render deployment docs.
> Backend is ready to use standalone. Frontend (Phases 7–11) points at this API.

## Prerequisites

- Node.js 20+
- Docker Desktop (for local Postgres / full stack)

## Local setup (recommended for development)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env

# 3. Start Postgres only
docker compose up -d postgres
# or: npm run docker:up

# 4. Apply migrations + generate client
npm run db:migrate:deploy
npm run db:generate

# If you previously used `db:push` on this database and migrate deploy fails
# because tables already exist, baseline the migration once:
#   npx prisma migrate resolve --applied 20260716120000_init

# 5. Seed demo data
npm run db:seed

# 6. Start the API (hot reload)
npm run dev
```

Health check: [http://localhost:4000/health](http://localhost:4000/health)

### Full Docker stack (API + Postgres)

```bash
# Build and run both services
docker compose --profile full up --build -d
# or: npm run docker:full

curl http://localhost:4000/health

# Seed (from host, against compose Postgres on localhost:5432)
npm run db:seed

# Stop
npm run docker:down
```

The API container runs `prisma migrate deploy` on startup via `docker-entrypoint.sh`.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_ACCESS_SECRET` | yes | Long random secret (≥32 chars) |
| `JWT_REFRESH_SECRET` | yes | Long random secret (≥32 chars) |
| `NODE_ENV` | yes | `development` / `production` / `test` |
| `CORS_ORIGIN` | yes | Frontend origin(s), comma-separated |
| `PORT` | no | Default `4000` |
| `JWT_ACCESS_EXPIRES_IN` | no | Default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | no | Default `7d` |
| `COOKIE_SECURE` | no | `true` on HTTPS (Render); `false` for local HTTP |

See `.env.example` for local defaults.

---

## API overview

### Auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | httpOnly cookies; rate-limited |
| POST | `/api/auth/logout` | Revokes refresh token |
| POST | `/api/auth/refresh` | Rotates tokens |
| GET | `/api/auth/me` | Current user |

Tokens are **never** returned in the JSON body.

### Employees

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/employees` | Auth; scoped by `employees:read:*` |
| POST | `/api/employees` | `employees:create` |
| POST | `/api/employees/import` | `employees:import` (CSV) |
| GET | `/api/employees/:id` | Auth; scoped by permissions |
| PUT | `/api/employees/:id` | `employees:update:*` |
| DELETE | `/api/employees/:id` | `employees:delete` |
| POST | `/api/employees/:id/restore` | `employees:restore` |
| GET | `/api/employees/:id/reportees` | Auth; scoped |
| PATCH | `/api/employees/:id/manager` | `employees:assign_manager` |
| GET | `/api/departments` | Auth |
| GET | `/api/admin/users` | `users:manage` |
| PATCH | `/api/admin/users/:id` | `users:manage` |
| GET | `/api/admin/roles` | `users:manage` / `roles:manage` / `employees:create` |
| POST/PUT/DELETE | `/api/admin/roles` | `roles:manage` |
| GET | `/api/admin/permissions` | `roles:manage` |

List query: `search`, `department`, `role`, `status`, `sortBy`, `sortOrder`, `page`, `limit`, `includeDeleted`.

### Organization & dashboard

| Method | Path |
|--------|------|
| GET | `/api/organization/tree` |
| GET | `/api/dashboard/stats` |

### Quick curl

```bash
curl -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ems.local","password":"Admin@12345"}'

curl -b cookies.txt http://localhost:4000/api/auth/me
curl -b cookies.txt http://localhost:4000/api/dashboard/stats
curl -b cookies.txt http://localhost:4000/api/organization/tree
```

## Seed credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@ems.local` | `Admin@12345` |
| HR Manager | `hr1@ems.local` | `Hr@12345678` |
| HR Manager | `hr2@ems.local` | `Hr@12345678` |
| Employee | `alex.rivera@ems.local` | `Employee@123` |

**Change these before any real deployment.**

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Hot-reload API |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run `dist/index.js` |
| `npm run db:migrate:deploy` | Apply migrations (prod/CI) |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:seed` | Seed demo data |
| `npm run docker:up` | Postgres only |
| `npm run docker:full` | API + Postgres containers |
| `npm test` | Jest + Supertest |

## Project layout

```
ems-backend/
  prisma/
    schema.prisma
    seed.ts
    migrations/          # used by migrate deploy
  src/
    app.ts
    index.ts
    lib/                 # prisma, jwt, cookies
    schemas/             # Zod (mirror in frontend)
    types/
    routes/
    controllers/
    middleware/
    services/
  tests/
  Dockerfile             # multi-stage production image
  docker-entrypoint.sh   # migrate deploy → start
  docker-compose.yml
  render.yaml            # optional Render Blueprint
  CONTRACT.md
  .env.example
```

## Phone validation

E.164: `+` + country code + number (7–15 digits after `+`), e.g. `+14155552671`.

## Schema sync note

Zod schemas / enums in `src/schemas` and `src/types` must stay behaviorally identical to `ems-frontend` copies. See `CONTRACT.md`.

---

## Deploy to Render

Push **this** `ems-backend` folder as its own GitHub repository (not a monorepo with the frontend).

### Option A — Dashboard (manual)

1. **Create a PostgreSQL database**
   - Render Dashboard → **New** → **PostgreSQL**
   - Name: `ems-postgres` (or similar)
   - Copy the **Internal Database URL** (or External if needed)

2. **Create a Web Service**
   - **New** → **Web Service** → connect the `ems-backend` GitHub repo
   - Runtime: **Node**
   - Build command:
     ```bash
     npm ci && npx prisma generate && npm run build
     ```
   - Start command:
     ```bash
     npx prisma migrate deploy && node dist/index.js
     ```
   - Health check path: `/health`

3. **Environment variables** (Web Service → Environment)

   | Key | Value |
   |-----|--------|
   | `DATABASE_URL` | Paste from the Postgres instance (Internal URL preferred) |
   | `JWT_ACCESS_SECRET` | Generate a long random string |
   | `JWT_REFRESH_SECRET` | Generate a different long random string |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | Your Vercel frontend URL, e.g. `https://ems-frontend.vercel.app` |
   | `COOKIE_SECURE` | `true` |
   | `PORT` | `4000` (Render also injects `PORT`; the app reads it) |

4. **Deploy** — wait for the build. Open `https://<your-service>.onrender.com/health`.

5. **Seed once** (optional) — from your laptop with the **External** DB URL:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:seed
   ```

6. **Frontend** — set `NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com` in Vercel.

### Option B — Blueprint (`render.yaml`)

1. Push this repo to GitHub.
2. Render → **New** → **Blueprint** → select the repo.
3. Set `CORS_ORIGIN` when prompted (your Vercel URL).
4. JWT secrets are auto-generated; `DATABASE_URL` is wired from the Blueprint database.

### Option C — Docker on Render

1. Web Service → **Docker** runtime, root Dockerfile.
2. Set the same env vars as Option A.
3. The image entrypoint runs `prisma migrate deploy` then starts the server.

### CORS + cookies checklist (production)

- [ ] `CORS_ORIGIN` matches the frontend origin exactly (no trailing slash mismatch)
- [ ] `COOKIE_SECURE=true` (HTTPS)
- [ ] Frontend calls the API with `credentials: "include"`
- [ ] Frontend and API are on HTTPS so `SameSite` cookies work cross-site (`sameSite: "none"` when secure)

### Free-tier note

Render free web services spin down after idle time; the first request after sleep can take ~30–60s. Upgrade if you need always-on.
