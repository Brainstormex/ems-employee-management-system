import { RoleSummary } from "../types";
import { PermissionKey } from "../lib/permissions";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        employeeId: string | null;
        role: RoleSummary;
        permissions: PermissionKey[];
        isActive: boolean;
      };
    }
  }
}

export {};
