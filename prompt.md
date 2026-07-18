# Cursor Prompt: Employee Management System (EMS)

Copy everything below into Cursor's chat/composer (Agent mode recommended) as your initial prompt. Feed it one phase at a time if the codebase gets large — Cursor performs better with scoped, sequential asks than one giant monolithic request.

---

## MASTER PROMPT

```
You are building a production-grade Employee Management System (EMS). Act as a senior full-stack
engineer. Work incrementally, explain your architecture decisions briefly, and write clean,
typed, tested code. Do not skip validation, error handling, or security basics to save time.

## TECH STACK (strict)
- Frontend: Next.js 14+ (App Router), TypeScript, Tailwind CSS + shadcn/ui components
- Backend: Node.js + Express.js, TypeScript
- Database: PostgreSQL, accessed via Prisma ORM
- Auth: JWT (access + refresh tokens), bcrypt for password hashing, httpOnly cookies for token storage
- Validation: Zod on both frontend (react-hook-form + zod) and backend (middleware)
- State/data fetching: TanStack Query (React Query)
- Charts: Recharts
- Testing: Jest + Supertest (backend), Vitest + React Testing Library (frontend)
- Containerization: Docker + docker-compose (app + Postgres)

## PROJECT STRUCTURE
Set up TWO fully independent, separately deployable projects (NOT a monorepo, no shared/workspace
package). Each has its own package.json, its own git-friendly root, its own node_modules, and can
be deployed on its own without the other folder present.

/ems-backend        -> Express + TypeScript + Prisma + PostgreSQL API (deploy target: Render)
  /src
    /routes
    /controllers
    /middleware
    /schemas         -> Zod validation schemas (backend's own copy)
    /types            -> TypeScript types/enums (Role, Status, etc.) (backend's own copy)
    /prisma
  Dockerfile
  docker-compose.yml  -> spins up this API + a local Postgres for dev
  .env.example
  README.md

/ems-frontend        -> Next.js + TypeScript + Tailwind + shadcn/ui (deploy target: Vercel)
  /app
  /components
  /schemas            -> Zod validation schemas (frontend's own copy, mirrors backend's rules)
  /types              -> TypeScript types/enums (frontend's own copy, mirrors backend's shapes)
  /lib
  .env.example
  README.md

IMPORTANT — since there is no shared package, the Zod schemas and TypeScript types/enums
(Role, Status, Employee shape, validation rules like salary max, phone regex, etc.) must be
written independently in each project but kept IDENTICAL in behavior. When you define or change
a validation rule in one project, you must make the matching edit in the other project's copy —
call this out explicitly in your response whenever you touch a schema, so I don't forget to sync
the other side manually.

The two projects communicate ONLY over HTTP: the frontend calls the backend using a base URL from
an environment variable (NEXT_PUBLIC_API_URL), pointing at wherever the backend is deployed (e.g.
https://ems-api.onrender.com). Configure CORS on the backend to explicitly allow the frontend's
deployed origin (plus http://localhost:3000 for local dev).

## DATABASE SCHEMA (Prisma / PostgreSQL)
Design normalized tables for:

1. **User** (auth identity)
   - id (uuid, pk), email (unique), passwordHash, role (enum: SUPER_ADMIN, HR_MANAGER, EMPLOYEE),
     employeeId (fk -> Employee, one-to-one), isActive, createdAt, updatedAt, lastLoginAt

2. **Employee**
   - id (uuid, pk), employeeCode (unique, human-readable like EMP-0001), fullName, email (unique),
     phone, department (fk -> Department or enum — prefer a Department table), designation,
     salary (decimal), joiningDate, status (enum: ACTIVE, INACTIVE), profileImageUrl,
     reportingManagerId (self-referential fk -> Employee, nullable), deletedAt (nullable, for soft delete),
     createdAt, updatedAt

3. **Department**
   - id, name (unique), description

4. **RefreshToken** (for JWT rotation/invalidation)
   - id, userId (fk), tokenHash, expiresAt, revokedAt, createdAt

Constraints and rules to implement at the DB/service layer:
- reportingManagerId must never create a cycle (A reports to B, B reports to A) — validate on write.
- An employee cannot be their own reporting manager.
- Soft-deleted employees (deletedAt IS NOT NULL) must be excluded from all default queries,
  reporting trees, dashboard counts, and search — but remain in the DB.
- Cascade rule: if a manager is soft-deleted, their direct reports must be reassigned or explicitly
  flagged as "manager unassigned" — do not silently orphan them.

Write the Prisma schema file, generate the client, and write a seed script that creates:
- 1 Super Admin, 2 HR Managers, ~15 Employees across 4 departments, with a realistic 2-3 level
  reporting hierarchy, for local testing.

## AUTHENTICATION
- POST /api/auth/login — validate credentials with bcrypt.compare, issue a short-lived JWT access
  token (15 min) and a longer-lived refresh token (7 days), set both as httpOnly, secure, sameSite
  cookies. Never return tokens in the JSON body.
- POST /api/auth/logout — revoke the refresh token (mark revoked in RefreshToken table) and clear cookies.
- POST /api/auth/refresh — issue a new access token from a valid refresh token.
- Passwords: bcrypt with a minimum of 10 salt rounds. Never log or return password hashes.
- Express middleware `requireAuth` — verifies JWT, attaches `req.user` (id, role, employeeId).
- Express middleware `requireRole(...roles)` — 403s if req.user.role isn't in the allowed list.
- Frontend: a `ProtectedRoute` wrapper / Next.js middleware that redirects unauthenticated users
  to /login, and redirects unauthorized roles away from pages they can't access (e.g. Employee
  trying to hit /admin/employees/new).
- Rate-limit the login endpoint (express-rate-limit) to prevent brute force.

## ROLE-BASED ACCESS CONTROL (enforce on the BACKEND — frontend hiding is UX only, not security)
- SUPER_ADMIN: full CRUD on employees, can assign/change roles, can assign any reporting manager,
  can hard-view soft-deleted records, can delete (soft-delete) employees.
- HR_MANAGER: can create/edit/view all employees, can assign reporting managers, CANNOT delete
  employees, CANNOT assign or change the SUPER_ADMIN role to anyone.
- EMPLOYEE: can only GET and PATCH their own employee record, and only a whitelisted subset of
  fields (phone, profileImageUrl) — must NOT be able to edit salary, role, status, department,
  or reportingManagerId on themselves. Enforce this field-level restriction server-side by
  stripping/rejecting disallowed fields in the request body based on req.user.role, not just
  by hiding form fields in the UI.

## API ENDPOINTS (implement all, with Zod validation on every mutating endpoint)
- POST   /api/auth/login
- POST   /api/auth/logout
- POST   /api/auth/refresh
- GET    /api/employees            (paginated, filterable, searchable, sortable — see below)
- POST   /api/employees            (HR_MANAGER, SUPER_ADMIN only)
- GET    /api/employees/:id
- PUT    /api/employees/:id        (role-aware field restrictions as above)
- DELETE /api/employees/:id        (SUPER_ADMIN only, soft delete)
- PATCH  /api/employees/:id/manager (assign/change reporting manager; validate no circular reporting)
- GET    /api/employees/:id/reportees   (direct reports of this employee)
- GET    /api/organization/tree         (full hierarchy, nested JSON, exclude soft-deleted)
- GET    /api/dashboard/stats           (totalEmployees, activeEmployees, inactiveEmployees, departmentCount)
- GET    /api/departments
- POST   /api/employees/import          (bonus — CSV import, see below)

GET /api/employees query params to support:
  ?search=<name or email substring, case-insensitive>
  &department=<id>
  &role=<role>
  &status=<ACTIVE|INACTIVE>
  &sortBy=<joiningDate|fullName>
  &sortOrder=<asc|desc>
  &page=<n>&limit=<n>

## VALIDATION RULES (Zod schemas — write once in ems-backend/src/schemas, then re-implement the
identical rules in ems-frontend/schemas; these two copies must stay behaviorally in sync even
though they live in separate projects)
- email: valid email format, unique (check DB on create/update)
- phone: valid phone format (E.164 or a clearly stated regional pattern — state your choice)
- salary: positive number, reasonable max, 2 decimal precision
- fullName, department, designation, joiningDate: required
- joiningDate: cannot be in the future
- Return 400 with a structured field-level error object on validation failure, e.g.
  { errors: { email: "Invalid email format" } } — the frontend form must map these back to
  the correct input fields.

## ORGANIZATIONAL HIERARCHY
- Store hierarchy via reportingManagerId self-reference (already in schema above).
- Build the tree server-side: fetch all active employees in one query, then assemble into a
  nested tree structure in memory (do not do N+1 recursive queries).
- Circular reporting guard: before saving a new reportingManagerId, walk up the proposed manager's
  chain; if the current employee's id appears in that chain, reject with a 400 and clear message.
- Frontend: render the tree with an expandable/collapsible component (build custom with Tailwind,
  or use a library like react-d3-tree) — show name, designation, and a count of direct reports
  at each node. Provide a separate "My Team" view for managers showing just their direct reports.

## DASHBOARD
- Cards: Total Employees, Active Employees, Inactive Employees, Department Count — backed by
  GET /api/dashboard/stats, computed with efficient aggregate SQL queries (COUNT/GROUP BY), not
  by fetching all rows and counting in JS.
- Bonus: add Recharts visualizations — employees per department (bar chart), active vs inactive
  (pie/donut chart), hires per month over the last 12 months (line chart).

## FRONTEND PAGES
- /login
- /dashboard (role-aware widgets)
- /employees (table: search bar, filter dropdowns for department/role/status, sortable columns,
  pagination controls, "Add Employee" button visible only to HR_MANAGER/SUPER_ADMIN)
- /employees/[id] (profile view; edit mode respects role field restrictions; shows direct reports
  and reporting manager with links)
- /employees/new (HR_MANAGER/SUPER_ADMIN only)
- /organization (hierarchy tree view)
- /profile (the logged-in user's own editable profile, for the EMPLOYEE role)
- Use shadcn/ui components (Table, Dialog, Select, Badge, Card, Form) for a clean, consistent,
  accessible UI. Support dark mode via Tailwind's dark: variant and a theme toggle in the nav.
- All forms use react-hook-form + zodResolver, show inline validation errors, and disable
  submit while pending. Show loading skeletons and empty states, not blank screens.

## BONUS FEATURES (implement after core features are solid and tested)
1. Pagination — already covered in GET /api/employees; make the table UI paginate accordingly.
2. Soft delete — already in schema; add an admin-only "Deleted Employees" view with restore option.
3. CSV import — POST /api/employees/import accepts a CSV (multer for upload), parses with a
   library like csv-parse, validates every row with the shared Zod schema, and returns a summary
   { successCount, failedRows: [{ row, errors }] } without failing the whole batch on one bad row.
4. Dashboard charts — see above.
5. Dark mode — see above.
6. Docker — write a Dockerfile inside ems-backend, plus a docker-compose.yml (also inside
   ems-backend) that spins up the API + a local Postgres together with proper env var wiring and
   a healthcheck on Postgres before the API starts. The frontend does NOT need Docker — it will
   be deployed to Vercel directly from its own repo and run locally with `npm run dev`.
7. Unit tests — backend: test auth (login success/failure, token issuance), RBAC middleware
   (each role against each restricted endpoint), circular-reporting rejection, validation errors.
   Frontend: test the employee form validation and the protected route redirect behavior.
   Target meaningful coverage, not 100% for its own sake.
8. Deployment — add a README in EACH project with concrete steps:
   - ems-backend README: deploying to Render as a Web Service pointed at this repo, required env
     vars (DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, NODE_ENV, CORS_ORIGIN), and how
     to provision/connect a Render Postgres instance (or any managed Postgres).
   - ems-frontend README: deploying to Vercel pointed at this repo, required env var
     (NEXT_PUBLIC_API_URL pointing at the deployed Render backend URL), and a note that Vercel
     rebuilds automatically need that env var set in the Vercel dashboard, not just .env.local.

## SECURITY CHECKLIST (verify before calling this done)
- [ ] Passwords hashed with bcrypt, never returned in any API response
- [ ] JWTs in httpOnly cookies, not localStorage
- [ ] Every mutating endpoint validated with Zod server-side, even though the frontend also validates
- [ ] RBAC enforced in Express middleware, not just hidden in the UI
- [ ] SQL injection not possible (Prisma parameterizes queries — do not use raw string interpolation
      in any $queryRaw calls)
- [ ] CORS configured to only allow the known frontend origin
- [ ] Helmet.js applied to Express for standard security headers
- [ ] Rate limiting on /api/auth/login

## HOW TO PROCEED
Build ems-backend and ems-frontend as two separate projects — either as two separate folders in
Cursor, or (recommended) two separate Cursor windows/repos so there's no risk of the two codebases
bleeding into each other. Work in this order and pause for my review after each phase:

**ems-backend (build and fully test this first, standalone, using Postman/curl/Thunder Client —
do not wait on the frontend to exist):**
1. Project scaffold + Prisma schema + seed script + docker-compose for local Postgres
2. Auth (login/logout/refresh) + RBAC middleware, with tests
3. Employee CRUD API + validation + soft delete, with tests
4. Organization hierarchy endpoints + circular-reporting guard, with tests
5. Dashboard stats endpoint
6. Dockerfile, README with local setup + Render deployment steps

**ems-frontend (build against the now-working backend, pointed at localhost:4000 or wherever
the backend runs locally):**
7. Auth pages + protected routing + layout/nav + dark mode
8. Employee table (search/filter/sort/pagination) + employee detail/edit + new employee form
9. Organization tree view + dashboard charts
10. Bonus: CSV import
11. README with local setup + Vercel deployment steps

After each phase, show me the files changed and a short summary of what to test manually before
we move to the next phase. When you touch a Zod schema or type in one project that has a
counterpart in the other, explicitly flag it so I remember to update the other project by hand.
```

---

## Tips for using this in Cursor

1. **Create two separate folders/repos** — `ems-backend` and `ems-frontend` — each opened as its own Cursor window. Paste the whole master prompt into both, since it describes both projects, but tell Cursor at the top of each session which one it's working on right now, e.g. *"We're building ems-backend only in this session — ignore the frontend sections for now."*
2. **Build and fully test the backend first**, standalone, using Postman/Thunder Client/curl, before starting the frontend at all. This way the frontend is built against a real, working API from day one instead of guessing at response shapes.
3. If Cursor tries to do everything in one shot and the output gets shallow, stop it and say: *"Just do Phase 1 for now, then stop and wait for me."* The "HOW TO PROCEED" section at the bottom is there to force this pacing.
4. After each phase, actually run the project (`docker-compose up` in ems-backend, or `npm run dev` in either) before approving the next phase — catching issues early is much cheaper than debugging phase 8 problems that originated in phase 2.
5. Since there's no shared package, **keep a short markdown file called `CONTRACT.md`** in both projects (or just in one, referenced by the other) listing the exact Employee/User field names, types, and enum values (Role, Status). Whenever you change a field on one side, update `CONTRACT.md` and manually port the change to the other project. This is the manual substitute for what a shared package would have done automatically — cheap insurance against the two sides quietly drifting apart.
6. When deploying: push `ems-backend` to its own GitHub repo and connect that repo to Render; push `ems-frontend` to its own separate GitHub repo and connect that to Vercel. Set `NEXT_PUBLIC_API_URL` in Vercel's environment variables to the live Render URL once the backend is deployed.