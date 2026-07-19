# EMS API Contract

Keep this file in sync when changing fields, permissions, or validation rules.
Mirror corresponding types/rules in `ems-frontend`.

## Status enum

| Value |
|-------|
| `ACTIVE` |
| `INACTIVE` |

## Roles & permissions (database-backed)

Roles are rows in `access_roles` (one role per user via `users.role_id`).
Permissions are rows in `permissions`; assigned through `role_permissions`.

### System roles (immutable)

| Slug | Name | Notes |
|------|------|-------|
| `super-admin` | Super Admin | All permissions; protected |
| `hr-manager` | HR Manager | Employee management without delete/admin |
| `employee` | Employee | Self-service only |

Custom roles may be created/edited/deleted by users with `roles:manage`.
System roles cannot be renamed, edited, or deleted.

### Permission keys

| Key | Description |
|-----|-------------|
| `employees:read:self` | View own employee profile |
| `employees:read:all` | List/view all employees |
| `employees:create` | Create employees |
| `employees:update:self` | Edit own phone / profile image |
| `employees:update:all` | Edit any employee |
| `employees:delete` | Soft-delete employees |
| `employees:restore` | Restore soft-deleted employees |
| `employees:import` | CSV import |
| `employees:assign_manager` | Change reporting manager |
| `dashboard:read` | Dashboard stats |
| `organization:read` | Org tree / reportees |
| `users:manage` | Assign roles / enable-disable accounts |
| `roles:manage` | CRUD custom roles |

Authorization uses `requirePermission` / `requireAnyPermission`. Role changes take effect on the next authenticated request (live DB check).

## Employee fields

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| employeeCode | string | Unique, e.g. `EMP-0001` |
| fullName | string | Required, 2–100 chars |
| email | string | Unique, valid email |
| phone | string | E.164 |
| departmentId | uuid | FK → Department |
| designation | string | Required, 2–100 chars |
| salary | number | Positive, max 10_000_000, ≤2 decimals |
| joiningDate | ISO date | Required, not in the future |
| status | Status | Employee workforce status (≠ login `isActive`) |
| profileImageUrl | string \| null | Valid URL |
| reportingManagerId | uuid \| null | Self-FK; no cycles |
| deletedAt | datetime \| null | Soft delete marker |
| role | RoleSummary \| null | From linked user |
| roleId | uuid \| null | Linked user's role |

Create employee accepts `roleId` and/or `roleSlug` (defaults to `employee`).
Update employee **does not** change role — use admin user APIs.

## User fields

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| email | string | Unique |
| passwordHash | string | Never returned |
| roleId | uuid | FK → AccessRole |
| employeeId | uuid \| null | One-to-one → Employee |
| isActive | boolean | Login enabled |
| lastLoginAt | datetime \| null | |

## Auth responses

Login / `/api/auth/me` return:

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "employeeId": "...",
    "isActive": true,
    "role": { "id": "...", "slug": "super-admin", "name": "Super Admin", "isSystem": true },
    "permissions": ["employees:read:all", "..."],
    "fullName": "...",
    "employee": { }
  }
}
```

Cookies: `accessToken` (15m), `refreshToken` (7d) — httpOnly; never in JSON.

## Admin APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/admin/users` | `users:manage` |
| PATCH | `/api/admin/users/:id` | `users:manage` — body `{ roleId?, isActive? }` |
| GET | `/api/admin/roles` | `users:manage` \| `roles:manage` \| `employees:create` |
| POST | `/api/admin/roles` | `roles:manage` |
| PUT | `/api/admin/roles/:id` | `roles:manage` |
| DELETE | `/api/admin/roles/:id` | `roles:manage` |
| GET | `/api/admin/permissions` | `roles:manage` |

Safety rules:
- Cannot disable your own account
- Cannot remove the last active user with `users:manage` / `roles:manage`
- Cannot modify/delete system roles
- Cannot delete a role still assigned to users
- Disabling a user revokes all refresh tokens

## Soft delete

- `DELETE /api/employees/:id` requires `employees:delete`
- Soft-deleted rows excluded from default list/search/tree/dashboard
- Direct reports unassigned; linked `User.isActive = false`; refresh tokens revoked
- `POST /api/employees/:id/restore` requires `employees:restore`

## Dashboard / Organization / CSV

Unchanged response shapes. CSV role column accepts `roleSlug` (`employee`, `hr-manager`, `super-admin`) or legacy enum names (`EMPLOYEE`, …). Filter employees with `roleId` query param.

## Validation

- Phone: `/^\+[1-9]\d{6,14}$/`
- Salary max: `10_000_000`
- Password (create): min 8 chars

## Seed credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@ems.local | Admin@12345 |
| HR Manager | hr1@ems.local | Hr@12345678 |
| Employee | alex.rivera@ems.local | Employee@123 |

## Deployment note

Apply migration `20260719150000_custom_rbac` on the backend **before** deploying the permission-aware frontend.
