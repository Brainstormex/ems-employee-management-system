# EMS Frontend Contract (mirror of ems-backend/CONTRACT.md)

## Status
- `ACTIVE` | `INACTIVE` (employee workforce status)

## Auth
- Cookies: accessToken (15m), refreshToken (7d) — httpOnly
- `credentials: "include"`
- Prefer same-origin `/api` via Next rewrite (`API_PROXY_TARGET`); leave `NEXT_PUBLIC_API_URL` empty
- `/api/auth/me` returns `role: { id, slug, name, isSystem }` and `permissions: string[]`
- On failed refresh after 401, client must logout to clear stale cookies

## Permissions
Use `PERMISSIONS` from `src/types` / `hasPermission` from auth context.
Key gates:
- `employees:create` — Add / import
- `employees:delete` — Soft-delete
- `users:manage` — `/admin/users`
- `roles:manage` — `/admin/roles`

## Employee schemas
- Create: optional `roleId` (uuid) — load options from `GET /api/admin/roles`
- Update: no role field (use admin users API)
- List filter: `roleId`

## Admin pages
- `/admin/users` — assign role, enable/disable
- `/admin/roles` — create/edit/delete custom roles; system roles read-only

## CSV import
Sample uses `roleSlug` (`employee`). Legacy enum names still accepted by backend.
