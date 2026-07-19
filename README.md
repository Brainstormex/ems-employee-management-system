# Employee Management System

Full-stack employee management application with role-based access, employee records, reporting hierarchies, dashboard analytics, and CSV import.

## Features

- Secure JWT authentication using httpOnly cookies and refresh-token rotation
- Role-based access for Super Admin, HR Manager, and Employee users
- Employee search, filtering, sorting, pagination, creation, editing, and soft deletion
- Expandable organization hierarchy with direct-report views
- Dashboard statistics and Recharts visualizations
- CSV employee import with per-row validation and partial-success reporting
- Responsive interface with dark mode
- PostgreSQL persistence through Prisma

## Tech stack

| Area | Technologies |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form, Zod, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma 6, Zod, JWT, Jest, Supertest |
| Database | PostgreSQL 16 |
| Deployment | Vercel (frontend), Render and Docker (backend) |

## Repository structure

```text
ems-system/
├── ems-backend/    # Express API, Prisma schema, migrations, seed, and tests
├── ems-frontend/   # Next.js application
└── prompt.md       # Original project specification
```

The frontend and backend are independent Node.js projects. Run dependency installation and scripts from their respective directories.

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop

## Local development

### 1. Start the backend

```bash
cd ems-backend
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:generate
npm run db:seed
npm run dev
```

The API runs at [http://localhost:4000](http://localhost:4000). Verify it at [http://localhost:4000/health](http://localhost:4000/health).

### 2. Start the frontend

In a second terminal:

```bash
cd ems-frontend
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The default frontend configuration proxies `/api/*` to `http://localhost:4000`, keeping authentication cookies on the frontend origin.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@ems.local` | `Admin@12345` |
| HR Manager | `hr1@ems.local` | `Hr@12345678` |
| Employee | `alex.rivera@ems.local` | `Employee@123` |

These credentials are for local demonstration only and must be changed before a real deployment.

## Main pages

| Path | Purpose |
|---|---|
| `/login` | Authentication |
| `/dashboard` | Workforce statistics and charts |
| `/employees` | Employee list and management |
| `/employees/new` | Create an employee |
| `/employees/import` | Import employees from CSV |
| `/employees/[id]` | Employee profile and editing |
| `/organization` | Reporting hierarchy and direct reports |
| `/profile` | Current employee profile |

## Useful commands

### Backend

```bash
npm run dev                 # Start API with hot reload
npm run build               # Compile TypeScript
npm test                    # Run Jest and Supertest tests
npm run db:migrate:deploy   # Apply database migrations
npm run db:seed             # Reset and seed demo data
npm run docker:full         # Start API and PostgreSQL in Docker
```

### Frontend

```bash
npm run dev                 # Start Next.js locally
npm run build               # Create a production build
npm start                   # Run the production build
```

## API overview

The backend exposes endpoints under `/api` for:

- Authentication: `/api/auth`
- Employees and CSV import: `/api/employees`
- Departments: `/api/departments`
- Organization hierarchy: `/api/organization/tree`
- Dashboard statistics: `/api/dashboard/stats`

See [`ems-backend/README.md`](ems-backend/README.md) for endpoint details, environment variables, Docker usage, and Render deployment instructions.

## Validation contract

Frontend and backend validation rules are maintained separately because the projects do not share a package. Keep corresponding schemas, enums, and API response types synchronized.

- [`ems-backend/CONTRACT.md`](ems-backend/CONTRACT.md)
- [`ems-frontend/CONTRACT.md`](ems-frontend/CONTRACT.md)

## Deployment

- Backend: follow [`ems-backend/README.md`](ems-backend/README.md) for Render or Docker deployment.
- Frontend: see [`ems-frontend/README.md`](ems-frontend/README.md) for environment configuration; complete Vercel deployment documentation is planned for Phase 11.

For production, use strong JWT secrets, HTTPS, `COOKIE_SECURE=true`, the managed PostgreSQL connection string, and the exact deployed frontend origin in `CORS_ORIGIN`.
