# EMS Frontend Contract (mirror of ems-backend/CONTRACT.md)

Keep Zod rules and enums identical to the backend.

## Enums
- Role: SUPER_ADMIN | HR_MANAGER | EMPLOYEE
- Status: ACTIVE | INACTIVE

## Auth
- Cookies: accessToken (15m), refreshToken (7d) — httpOnly, never in JSON
- Frontend must call API with credentials: "include"
- NEXT_PUBLIC_API_URL points at the backend origin

## Validation (login)
- email: valid email
- password: required

Phone / salary / employee schemas: `src/schemas/employee.schema.ts` (mirrors backend).
Keep phone E.164, salary max 10_000_000, and self-update `.strict()` fields in sync.

## Dashboard (`GET /api/dashboard/stats`)
Response `data`: `{ totalEmployees, activeEmployees, inactiveEmployees, departmentCount, charts }`
- `charts.employeesPerDepartment`: `{ departmentId, departmentName, count }[]`
- `charts.employeesByStatus`: `{ status, count }[]`
- `charts.hiresPerMonth`: `{ month: "YYYY-MM", count }[]` (last 12 months)

## Organization (`GET /api/organization/tree`)
Response `data`: `OrgTreeNode[]` roots; each node `{ id, employeeCode, fullName, designation, departmentName, status, directReportCount, children }`
Meta: `{ employeeCount, rootCount }`

## Reportees (`GET /api/employees/:id/reportees`)
Response `data`: `EmployeePublic[]`; meta `{ managerId, managerName, count }`

## CSV import (`POST /api/employees/import`)
- Multipart form field: `file` (`.csv`, max 2 MB / 500 rows)
- Auth: HR_MANAGER | SUPER_ADMIN
- Validates each row with create-employee rules; continues on row failures
- Department: `department` (name) or `departmentId` (uuid)
- Manager: `reportingManagerCode` or `reportingManagerId`
- Response `data`: `{ successCount, failedCount, failedRows: [{ row, errors }], created: EmployeePublic[] }`
