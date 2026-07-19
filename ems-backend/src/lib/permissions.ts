/**
 * Stable permission keys used across backend authorization and frontend gates.
 * Keep in sync with seed data and CONTRACT.md.
 */
export const PERMISSIONS = {
  EMPLOYEES_READ_SELF: "employees:read:self",
  EMPLOYEES_READ_ALL: "employees:read:all",
  EMPLOYEES_CREATE: "employees:create",
  EMPLOYEES_UPDATE_SELF: "employees:update:self",
  EMPLOYEES_UPDATE_ALL: "employees:update:all",
  EMPLOYEES_DELETE: "employees:delete",
  EMPLOYEES_RESTORE: "employees:restore",
  EMPLOYEES_IMPORT: "employees:import",
  EMPLOYEES_ASSIGN_MANAGER: "employees:assign_manager",
  DASHBOARD_READ: "dashboard:read",
  ORGANIZATION_READ: "organization:read",
  USERS_MANAGE: "users:manage",
  ROLES_MANAGE: "roles:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

export const PERMISSION_CATALOG: {
  key: PermissionKey;
  name: string;
  description: string;
  group: string;
}[] = [
  {
    key: PERMISSIONS.EMPLOYEES_READ_SELF,
    name: "Read own employee profile",
    description: "View the linked employee record",
    group: "Employees",
  },
  {
    key: PERMISSIONS.EMPLOYEES_READ_ALL,
    name: "Read all employees",
    description: "List and view any employee",
    group: "Employees",
  },
  {
    key: PERMISSIONS.EMPLOYEES_CREATE,
    name: "Create employees",
    description: "Create employee and linked user accounts",
    group: "Employees",
  },
  {
    key: PERMISSIONS.EMPLOYEES_UPDATE_SELF,
    name: "Update own profile",
    description: "Edit limited fields on own employee profile",
    group: "Employees",
  },
  {
    key: PERMISSIONS.EMPLOYEES_UPDATE_ALL,
    name: "Update all employees",
    description: "Edit employee records for others",
    group: "Employees",
  },
  {
    key: PERMISSIONS.EMPLOYEES_DELETE,
    name: "Soft-delete employees",
    description: "Soft-delete employees and disable their login",
    group: "Employees",
  },
  {
    key: PERMISSIONS.EMPLOYEES_RESTORE,
    name: "Restore employees",
    description: "Restore soft-deleted employees",
    group: "Employees",
  },
  {
    key: PERMISSIONS.EMPLOYEES_IMPORT,
    name: "Import employees CSV",
    description: "Bulk-import employees from CSV",
    group: "Employees",
  },
  {
    key: PERMISSIONS.EMPLOYEES_ASSIGN_MANAGER,
    name: "Assign reporting managers",
    description: "Change reportingManagerId",
    group: "Employees",
  },
  {
    key: PERMISSIONS.DASHBOARD_READ,
    name: "View dashboard",
    description: "Access dashboard stats and charts",
    group: "Analytics",
  },
  {
    key: PERMISSIONS.ORGANIZATION_READ,
    name: "View organization",
    description: "Access organization tree and reportees",
    group: "Analytics",
  },
  {
    key: PERMISSIONS.USERS_MANAGE,
    name: "Manage users",
    description: "Assign roles and enable/disable login accounts",
    group: "Administration",
  },
  {
    key: PERMISSIONS.ROLES_MANAGE,
    name: "Manage roles",
    description: "Create and edit custom roles and their permissions",
    group: "Administration",
  },
];

export const SYSTEM_ROLE_SLUGS = {
  SUPER_ADMIN: "super-admin",
  HR_MANAGER: "hr-manager",
  EMPLOYEE: "employee",
} as const;

export type SystemRoleSlug =
  (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS];

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleSlug, PermissionKey[]> = {
  [SYSTEM_ROLE_SLUGS.SUPER_ADMIN]: [...ALL_PERMISSION_KEYS],
  [SYSTEM_ROLE_SLUGS.HR_MANAGER]: [
    PERMISSIONS.EMPLOYEES_READ_SELF,
    PERMISSIONS.EMPLOYEES_READ_ALL,
    PERMISSIONS.EMPLOYEES_CREATE,
    PERMISSIONS.EMPLOYEES_UPDATE_SELF,
    PERMISSIONS.EMPLOYEES_UPDATE_ALL,
    PERMISSIONS.EMPLOYEES_IMPORT,
    PERMISSIONS.EMPLOYEES_ASSIGN_MANAGER,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.ORGANIZATION_READ,
  ],
  [SYSTEM_ROLE_SLUGS.EMPLOYEE]: [
    PERMISSIONS.EMPLOYEES_READ_SELF,
    PERMISSIONS.EMPLOYEES_UPDATE_SELF,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.ORGANIZATION_READ,
  ],
};

/** Permissions that mark a user as capable of recovering admin access. */
export const PRIVILEGED_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.ROLES_MANAGE,
];
