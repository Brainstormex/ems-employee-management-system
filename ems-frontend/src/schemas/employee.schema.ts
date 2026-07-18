import { z } from "zod";
import { Role, Status } from "@/types";

/**
 * Mirrors ems-backend/src/schemas/employee.schema.ts
 * Schema sync note: keep phone/salary/name rules identical.
 * Frontend uses Zod 4; backend uses Zod 3 — rules must match, API option names may differ.
 */
export const phoneRegex = /^\+[1-9]\d{6,14}$/;
export const MAX_SALARY = 10_000_000;

const salarySchema = z
  .number({ error: "Salary is required" })
  .positive("Salary must be a positive number")
  .max(MAX_SALARY, `Salary cannot exceed ${MAX_SALARY}`)
  .refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) / 100 === val,
    "Salary must have at most 2 decimal places"
  );

const joiningDateSchema = z
  .string()
  .min(1, "Joining date is required")
  .refine((val) => !Number.isNaN(Date.parse(val)), "Invalid joining date")
  .refine((val) => {
    const date = new Date(val);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date <= today;
  }, "Joining date cannot be in the future");

export const createEmployeeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be at most 100 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email format")
    .transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone must be in E.164 format (e.g. +14155552671)"),
  departmentId: z.string().uuid("Invalid department ID"),
  designation: z
    .string()
    .trim()
    .min(2, "Designation must be at least 2 characters")
    .max(100, "Designation must be at most 100 characters"),
  salary: salarySchema,
  joiningDate: joiningDateSchema,
  status: z.enum([Status.ACTIVE, Status.INACTIVE]),
  role: z.enum([Role.SUPER_ADMIN, Role.HR_MANAGER, Role.EMPLOYEE]),
  reportingManagerId: z.string().optional(),
  profileImageUrl: z.string().optional(),
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 8, "Password must be at least 8 characters"),
});

export const updateEmployeeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be at most 100 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone must be in E.164 format (e.g. +14155552671)"),
  departmentId: z.string().uuid("Invalid department ID"),
  designation: z
    .string()
    .trim()
    .min(2, "Designation must be at least 2 characters")
    .max(100, "Designation must be at most 100 characters"),
  salary: salarySchema,
  joiningDate: joiningDateSchema,
  status: z.enum([Status.ACTIVE, Status.INACTIVE]),
  role: z.enum([Role.SUPER_ADMIN, Role.HR_MANAGER, Role.EMPLOYEE]),
  reportingManagerId: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

export const employeeSelfUpdateSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "Phone must be in E.164 format (e.g. +14155552671)"),
    profileImageUrl: z.string().optional(),
  })
  .strict();

export type CreateEmployeeFormValues = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeFormValues = z.infer<typeof updateEmployeeSchema>;
export type EmployeeSelfUpdateFormValues = z.infer<
  typeof employeeSelfUpdateSchema
>;

/** Normalize optional URL / manager fields before sending to the API */
export function toCreatePayload(values: CreateEmployeeFormValues) {
  const profileImageUrl = emptyToNull(values.profileImageUrl);
  if (profileImageUrl && !isValidUrl(profileImageUrl)) {
    throw new Error("Invalid profile image URL");
  }

  return {
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    departmentId: values.departmentId,
    designation: values.designation,
    salary: values.salary,
    joiningDate: values.joiningDate,
    status: values.status,
    role: values.role,
    reportingManagerId: emptyToNull(values.reportingManagerId),
    profileImageUrl,
    ...(values.password ? { password: values.password } : {}),
  };
}

export function toUpdatePayload(values: UpdateEmployeeFormValues) {
  const profileImageUrl = emptyToNull(values.profileImageUrl);
  if (profileImageUrl && !isValidUrl(profileImageUrl)) {
    throw new Error("Invalid profile image URL");
  }

  return {
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    departmentId: values.departmentId,
    designation: values.designation,
    salary: values.salary,
    joiningDate: values.joiningDate,
    status: values.status,
    role: values.role,
    reportingManagerId: emptyToNull(values.reportingManagerId),
    profileImageUrl,
  };
}

export function toSelfUpdatePayload(values: EmployeeSelfUpdateFormValues) {
  const profileImageUrl = emptyToNull(values.profileImageUrl);
  if (profileImageUrl && !isValidUrl(profileImageUrl)) {
    throw new Error("Invalid profile image URL");
  }
  return {
    phone: values.phone,
    profileImageUrl,
  };
}

function emptyToNull(value?: string | null): string | null {
  if (value === undefined || value === null || value.trim() === "") return null;
  return value.trim();
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
