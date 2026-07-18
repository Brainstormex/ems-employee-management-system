import { Role } from "../types";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        employeeId: string | null;
      };
    }
  }
}

export {};
