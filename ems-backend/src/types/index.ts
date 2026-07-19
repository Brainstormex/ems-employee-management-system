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

export interface AuthUser {
  id: string;
  email: string;
  employeeId: string | null;
  role: RoleSummary;
  permissions: string[];
  isActive: boolean;
}

export interface EmployeePublic {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  designation: string;
  salary: number;
  joiningDate: string;
  status: Status;
  profileImageUrl: string | null;
  reportingManagerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentPublic {
  id: string;
  name: string;
  description: string | null;
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
