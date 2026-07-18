export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  HR_MANAGER = "HR_MANAGER",
  EMPLOYEE = "EMPLOYEE",
}

export enum Status {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
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
  role?: Role | null;
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

export function roleLabel(role: Role): string {
  switch (role) {
    case Role.SUPER_ADMIN:
      return "Super Admin";
    case Role.HR_MANAGER:
      return "HR Manager";
    case Role.EMPLOYEE:
      return "Employee";
    default:
      return role;
  }
}

export function canManageEmployees(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.HR_MANAGER;
}

export function canDeleteEmployees(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}
