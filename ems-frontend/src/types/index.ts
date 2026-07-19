export enum Status {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export interface RoleSummary {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
}

/** Stable permission keys — keep in sync with backend `src/lib/permissions.ts`. */
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

export const SYSTEM_ROLE_SLUGS = {
  SUPER_ADMIN: "super-admin",
  HR_MANAGER: "hr-manager",
  EMPLOYEE: "employee",
} as const;

export type SystemRoleSlug =
  (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS];

export interface AuthUser {
  id: string;
  email: string;
  employeeId: string | null;
  isActive: boolean;
  role: RoleSummary;
  permissions: string[];
  fullName?: string | null;
  employeeCode?: string | null;
  lastLoginAt?: string | null;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    designation: string;
    department: { id: string; name: string } | null;
  } | null;
}

export interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string>;
}

export interface EmployeePublic {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  department?: { id: string; name: string } | null;
  designation: string;
  salary: number;
  joiningDate: string;
  status: Status;
  profileImageUrl: string | null;
  reportingManagerId: string | null;
  reportingManager?: {
    id: string;
    fullName: string;
    employeeCode: string;
    designation: string;
  } | null;
  role?: RoleSummary | null;
  roleId?: string | null;
  userId?: string | null;
  isUserActive?: boolean | null;
  directReportCount?: number;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentPublic {
  id: string;
  name: string;
  description: string | null;
  employeeCount?: number;
}

export interface AccessRole {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
  description: string | null;
  permissionKeys: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionCatalogItem {
  id: string;
  key: string;
  name: string;
  description: string;
  group: string;
}

export interface AdminUser {
  id: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  employeeId: string | null;
  role: RoleSummary;
  permissions: string[];
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    designation: string;
    deletedAt: string | null;
  } | null;
}

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  departmentCount: number;
}

export interface DashboardCharts {
  employeesPerDepartment: {
    departmentId: string;
    departmentName: string;
    count: number;
  }[];
  employeesByStatus: { status: string; count: number }[];
  hiresPerMonth: { month: string; count: number }[];
}

export interface DashboardStatsResponse extends DashboardStats {
  charts: DashboardCharts;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrgTreeNode {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  departmentName: string;
  status: Status;
  directReportCount: number;
  children: OrgTreeNode[];
}

export function hasPermission(
  user: { permissions: string[] } | null | undefined,
  ...keys: string[]
): boolean {
  if (!user || keys.length === 0) return false;
  return keys.every((key) => user.permissions.includes(key));
}

export function hasAnyPermission(
  user: { permissions: string[] } | null | undefined,
  ...keys: string[]
): boolean {
  if (!user || keys.length === 0) return false;
  return keys.some((key) => user.permissions.includes(key));
}

export function roleLabel(role: RoleSummary | string | null | undefined): string {
  if (!role) return "—";
  if (typeof role === "string") return role;
  return role.name;
}

/** True when the user can create employees. */
export function canManageEmployees(
  user: { permissions: string[] } | null | undefined
): boolean {
  return hasPermission(user, PERMISSIONS.EMPLOYEES_CREATE);
}

/** True when the user can soft-delete employees. */
export function canDeleteEmployees(
  user: { permissions: string[] } | null | undefined
): boolean {
  return hasPermission(user, PERMISSIONS.EMPLOYEES_DELETE);
}
