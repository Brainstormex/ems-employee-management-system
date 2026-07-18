import { z } from "zod";
import { Role, Status } from "../types";

/**
 * Phone format: E.164 international format.
 * Examples: +14155552671, +919876543210
 */
export const phoneRegex = /^\+[1-9]\d{6,14}$/;

export const MAX_SALARY = 10_000_000;
export const MIN_SALARY = 0.01;

const salarySchema = z
  .number({ required_error: "Salary is required" })
  .positive("Salary must be a positive number")
  .max(MAX_SALARY, `Salary cannot exceed ${MAX_SALARY}`)
  .refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) / 100 === val,
    "Salary must have at most 2 decimal places"
  );

const joiningDateSchema = z
  .string({ required_error: "Joining date is required" })
  .refine((val) => !Number.isNaN(Date.parse(val)), "Invalid joining date")
  .refine((val) => {
    const date = new Date(val);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date <= today;
  }, "Joining date cannot be in the future");

export const createEmployeeSchema = z.object({
  fullName: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be at most 100 characters"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format")
    .toLowerCase(),
  phone: z
    .string({ required_error: "Phone is required" })
    .trim()
    .regex(phoneRegex, "Phone must be in E.164 format (e.g. +14155552671)"),
  departmentId: z
    .string({ required_error: "Department is required" })
    .uuid("Invalid department ID"),
  designation: z
    .string({ required_error: "Designation is required" })
    .trim()
    .min(2, "Designation must be at least 2 characters")
    .max(100, "Designation must be at most 100 characters"),
  salary: salarySchema,
  joiningDate: joiningDateSchema,
  status: z.nativeEnum(Status).optional().default(Status.ACTIVE),
  role: z.nativeEnum(Role).optional().default(Role.EMPLOYEE),
  reportingManagerId: z.string().uuid("Invalid manager ID").nullable().optional(),
  profileImageUrl: z.string().url("Invalid profile image URL").nullable().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
});

export const updateEmployeeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be at most 100 characters")
    .optional(),
  email: z.string().trim().email("Invalid email format").toLowerCase().optional(),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone must be in E.164 format (e.g. +14155552671)")
    .optional(),
  departmentId: z.string().uuid("Invalid department ID").optional(),
  designation: z
    .string()
    .trim()
    .min(2, "Designation must be at least 2 characters")
    .max(100, "Designation must be at most 100 characters")
    .optional(),
  salary: salarySchema.optional(),
  joiningDate: joiningDateSchema.optional(),
  status: z.nativeEnum(Status).optional(),
  role: z.nativeEnum(Role).optional(),
  reportingManagerId: z.string().uuid("Invalid manager ID").nullable().optional(),
  profileImageUrl: z.string().url("Invalid profile image URL").nullable().optional(),
});

/** Fields an EMPLOYEE role may update on their own profile */
export const employeeSelfUpdateSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "Phone must be in E.164 format (e.g. +14155552671)")
      .optional(),
    profileImageUrl: z
      .string()
      .url("Invalid profile image URL")
      .nullable()
      .optional(),
  })
  .strict();

export const assignManagerSchema = z.object({
  reportingManagerId: z.string().uuid("Invalid manager ID").nullable(),
});

export const employeeQuerySchema = z.object({
  search: z.string().optional(),
  department: z.string().uuid().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(Status).optional(),
  sortBy: z.enum(["joiningDate", "fullName"]).optional().default("fullName"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format")
    .toLowerCase(),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeSelfUpdateInput = z.infer<typeof employeeSelfUpdateSchema>;
export type AssignManagerInput = z.infer<typeof assignManagerSchema>;
export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
