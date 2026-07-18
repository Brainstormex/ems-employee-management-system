# EMS API Contract

Keep this file in sync when changing fields, enums, or validation rules.
Mirror identical Zod rules in `ems-frontend/schemas` when that project exists.

## Enums

### Role
| Value | Description |
|-------|-------------|
| `SUPER_ADMIN` | Full access |
| `HR_MANAGER` | Create/edit/view employees; cannot delete or assign SUPER_ADMIN |
| `EMPLOYEE` | Own profile only (phone, profileImageUrl) |

### Status
| Value |
|-------|
| `ACTIVE` |
| `INACTIVE` |

## Employee fields

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| employeeCode | string | Unique, e.g. `EMP-0001` |
| fullName | string | Required, 2–100 chars |
| email | string | Unique, valid email |
| phone | string | E.164 (`+` + 7–15 digits) |
| departmentId | uuid | FK → Department |
| designation | string | Required, 2–100 chars |
| salary | number | Positive, max 10_000_000, ≤2 decimals |
| joiningDate | ISO date | Required, not in the future |
| status | Status | Default `ACTIVE` |
| profileImageUrl | string \| null | Valid URL |
| reportingManagerId | uuid \| null | Self-FK; no cycles; not self |
| deletedAt | datetime \| null | Soft delete marker |

## User fields

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| email | string | Unique (matches employee email when linked) |
| passwordHash | string | Never returned in API |
| role | Role | |
| employeeId | uuid \| null | One-to-one → Employee |
| isActive | boolean | |
| lastLoginAt | datetime \| null | |

## Auth cookies

| Cookie | Lifetime | Notes |
|--------|----------|-------|
| `accessToken` | 15 min | httpOnly, secure (prod), sameSite=lax |
| `refreshToken` | 7 days | httpOnly, secure (prod), sameSite=lax |

Tokens are **never** returned in JSON body.

## Validation (must stay identical FE/BE)

- Phone: `/^\+[1-9]\d{6,14}$/` (E.164)
- Salary max: `10_000_000`
- Salary min: `0.01`
- Full name / designation: 2–100 chars
- Joining date: not future
- Password (create user): min 8 chars

## Error shape (validation 400)

```json
{
  "errors": {
    "email": "Invalid email format",
    "phone": "Phone must be in E.164 format (e.g. +14155552671)"
  }
}
```

## Soft delete

- `DELETE /api/employees/:id` sets `deletedAt` (SUPER_ADMIN only)
- Soft-deleted rows excluded from default list/search/tree/dashboard
- Direct reports of a deleted manager get `reportingManagerId = null`
- Linked `User.isActive = false` and refresh tokens revoked
- `POST /api/employees/:id/restore` restores employee + user

## Dashboard (`GET /api/dashboard/stats`)

Response `data`:
- `totalEmployees`, `activeEmployees`, `inactiveEmployees`, `departmentCount` (numbers)
- `charts.employeesPerDepartment`: `{ departmentId, departmentName, count }[]`
- `charts.employeesByStatus`: `{ status: Status, count }[]`
- `charts.hiresPerMonth`: `{ month: "YYYY-MM", count }[]` (rolling 12 months, UTC)

## Organization (`GET /api/organization/tree`)

Response `data`: nested `OrgTreeNode[]` (roots only). Each node:
`{ id, employeeCode, fullName, designation, departmentName, status, directReportCount, children }`
Meta: `{ employeeCount, rootCount }`. Excludes soft-deleted employees.

## Reportees (`GET /api/employees/:id/reportees`)

Response `data`: `EmployeePublic[]`; meta `{ managerId, managerName, count }`

## CSV import (`POST /api/employees/import`)

- Multipart field `file` (`.csv`, max 2 MB, max 500 rows)
- Roles: `HR_MANAGER`, `SUPER_ADMIN`
- Per-row Zod validation (`createEmployeeSchema`); batch does not abort on one bad row
- Columns: `fullName`, `email`, `phone`, `department` *or* `departmentId`, `designation`, `salary`, `joiningDate`; optional `status`, `role`, `reportingManagerCode` / `reportingManagerId`, `password`, `profileImageUrl`
- Default password if omitted: `ChangeMe@123`
- Response `data`: `{ successCount, failedCount, failedRows: [{ row, errors }], created }`

|------|-------|----------|
| Super Admin | admin@ems.local | Admin@12345 |
| HR Manager | hr1@ems.local | Hr@12345678 |
| HR Manager | hr2@ems.local | Hr@12345678 |
| Employee | (see seed) | Employee@123 |
