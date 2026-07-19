import { parse } from "csv-parse/sync";
import { ZodError } from "zod";
import { hashPassword } from "../controllers/auth.controller";
import { AppError, formatZodErrors } from "../middleware/error";
import { prisma } from "../lib/prisma";
import {
  createEmployeeSchema,
  CreateEmployeeInput,
} from "../schemas/employee.schema";
import { Status } from "../types";
import { SYSTEM_ROLE_SLUGS } from "../lib/permissions";
import {
  assertDepartmentExists,
  assertEmailAvailable,
  assertManagerExists,
  generateEmployeeCode,
  employeeInclude,
  serializeEmployee,
} from "./employee.service";
import {
  assertAssignableRole,
  getRoleBySlug,
} from "./rbac.service";
import { AuthUser } from "../types";
import { PermissionKey } from "../lib/permissions";

export type CsvImportFailedRow = {
  row: number;
  errors: Record<string, string>;
};

export type CsvImportResult = {
  successCount: number;
  failedCount: number;
  failedRows: CsvImportFailedRow[];
  created: ReturnType<typeof serializeEmployee>[];
};

type Actor = AuthUser & { permissions: PermissionKey[] };

/** CSV may use department name / manager code / role slug aliases; coerce string salary. */
function normalizeCsvRecord(raw: Record<string, string>): Record<string, unknown> {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const found = Object.entries(raw).find(
        ([k]) => k.trim().toLowerCase() === key.toLowerCase()
      );
      if (found && found[1].trim() !== "") return found[1].trim();
    }
    return undefined;
  };

  const salaryRaw = get("salary");
  const salary =
    salaryRaw !== undefined ? Number(salaryRaw.replace(/,/g, "")) : undefined;

  const emptyToNull = (v: string | undefined) =>
    v === undefined || v === "" || v.toLowerCase() === "null" ? null : v;

  const roleRaw = get("role", "roleSlug", "role_slug");
  // Map legacy enum names to slugs
  let roleSlug = roleRaw;
  if (roleRaw) {
    const upper = roleRaw.toUpperCase();
    if (upper === "SUPER_ADMIN") roleSlug = SYSTEM_ROLE_SLUGS.SUPER_ADMIN;
    else if (upper === "HR_MANAGER") roleSlug = SYSTEM_ROLE_SLUGS.HR_MANAGER;
    else if (upper === "EMPLOYEE") roleSlug = SYSTEM_ROLE_SLUGS.EMPLOYEE;
    else roleSlug = roleRaw.toLowerCase();
  }

  return {
    fullName: get("fullName", "full_name", "name"),
    email: get("email"),
    phone: get("phone"),
    departmentId: get("departmentId", "department_id"),
    departmentName: get("department", "departmentName", "department_name"),
    designation: get("designation", "title"),
    salary,
    joiningDate: get("joiningDate", "joining_date"),
    status: get("status")?.toUpperCase(),
    roleId: get("roleId", "role_id"),
    roleSlug,
    reportingManagerId: emptyToNull(
      get("reportingManagerId", "reporting_manager_id")
    ),
    reportingManagerCode: emptyToNull(
      get("reportingManagerCode", "reporting_manager_code", "managerCode")
    ),
    profileImageUrl: emptyToNull(
      get("profileImageUrl", "profile_image_url")
    ),
    password: get("password"),
  };
}

async function resolveDepartmentId(
  departmentId: string | undefined,
  departmentName: string | undefined,
  deptCache: Map<string, string>
): Promise<{ id?: string; error?: string }> {
  if (departmentId) {
    try {
      await assertDepartmentExists(departmentId);
      return { id: departmentId };
    } catch (err) {
      if (err instanceof AppError && err.errors?.departmentId) {
        return { error: err.errors.departmentId };
      }
      throw err;
    }
  }

  if (!departmentName) {
    return { error: "Department is required (department or departmentId)" };
  }

  const key = departmentName.toLowerCase();
  const cached = deptCache.get(key);
  if (cached) return { id: cached };

  const dept = await prisma.department.findFirst({
    where: { name: { equals: departmentName, mode: "insensitive" } },
  });
  if (!dept) {
    return { error: `Department not found: ${departmentName}` };
  }
  deptCache.set(key, dept.id);
  return { id: dept.id };
}

async function resolveManagerId(
  reportingManagerId: string | null | undefined,
  reportingManagerCode: string | null | undefined
): Promise<{ id: string | null; error?: string }> {
  if (reportingManagerId) {
    try {
      await assertManagerExists(reportingManagerId);
      return { id: reportingManagerId };
    } catch (err) {
      if (err instanceof AppError && err.errors?.reportingManagerId) {
        return { id: null, error: err.errors.reportingManagerId };
      }
      throw err;
    }
  }

  if (!reportingManagerCode) return { id: null };

  const manager = await prisma.employee.findFirst({
    where: {
      employeeCode: {
        equals: reportingManagerCode,
        mode: "insensitive",
      },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!manager) {
    return {
      id: null,
      error: `Reporting manager not found: ${reportingManagerCode}`,
    };
  }
  return { id: manager.id };
}

async function resolveRoleId(
  roleId: string | undefined,
  roleSlug: string | undefined
): Promise<{ id?: string; error?: string }> {
  if (roleId) {
    const role = await prisma.accessRole.findUnique({ where: { id: roleId } });
    if (!role) return { error: "Role not found" };
    return { id: role.id };
  }
  if (roleSlug) {
    const role = await getRoleBySlug(roleSlug);
    if (!role) return { error: `Role not found: ${roleSlug}` };
    return { id: role.id };
  }
  const fallback = await getRoleBySlug(SYSTEM_ROLE_SLUGS.EMPLOYEE);
  return { id: fallback?.id };
}

export async function createEmployeeRecord(
  body: CreateEmployeeInput,
  actor: Actor
) {
  const resolved = await resolveRoleId(body.roleId, body.roleSlug);
  if (!resolved.id) {
    throw new AppError(400, resolved.error || "Role is required", {
      roleId: resolved.error || "Role is required",
    });
  }

  await assertAssignableRole(actor, resolved.id);
  await assertDepartmentExists(body.departmentId);
  await assertEmailAvailable(body.email);

  if (body.reportingManagerId) {
    await assertManagerExists(body.reportingManagerId);
  }

  const password = body.password || "ChangeMe@123";
  const passwordHash = await hashPassword(password);

  const employee = await prisma.$transaction(async (tx) => {
    const employeeCode = await generateEmployeeCode(tx);

    const created = await tx.employee.create({
      data: {
        employeeCode,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        departmentId: body.departmentId,
        designation: body.designation,
        salary: body.salary,
        joiningDate: new Date(body.joiningDate),
        status: body.status ?? Status.ACTIVE,
        profileImageUrl: body.profileImageUrl ?? null,
        reportingManagerId: body.reportingManagerId ?? null,
      },
    });

    await tx.user.create({
      data: {
        email: body.email,
        passwordHash,
        roleId: resolved.id!,
        employeeId: created.id,
        isActive: true,
      },
    });

    return tx.employee.findUniqueOrThrow({
      where: { id: created.id },
      include: employeeInclude,
    });
  });

  return serializeEmployee(employee);
}

export async function importEmployeesFromCsv(
  buffer: Buffer,
  actor: Actor
): Promise<CsvImportResult> {
  let records: Record<string, string>[];

  try {
    records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, string>[];
  } catch {
    throw new AppError(400, "Invalid CSV file");
  }

  if (records.length === 0) {
    throw new AppError(400, "CSV file has no data rows");
  }

  if (records.length > 500) {
    throw new AppError(400, "CSV import is limited to 500 rows per file");
  }

  const failedRows: CsvImportFailedRow[] = [];
  const created: ReturnType<typeof serializeEmployee>[] = [];
  const seenEmails = new Set<string>();
  const deptCache = new Map<string, string>();

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2;
    const normalized = normalizeCsvRecord(records[i]);
    const errors: Record<string, string> = {};

    const dept = await resolveDepartmentId(
      typeof normalized.departmentId === "string"
        ? normalized.departmentId
        : undefined,
      typeof normalized.departmentName === "string"
        ? normalized.departmentName
        : undefined,
      deptCache
    );
    if (dept.error) errors.departmentId = dept.error;

    const manager = await resolveManagerId(
      (normalized.reportingManagerId as string | null | undefined) ?? null,
      (normalized.reportingManagerCode as string | null | undefined) ?? null
    );
    if (manager.error) errors.reportingManagerId = manager.error;

    const role = await resolveRoleId(
      typeof normalized.roleId === "string" ? normalized.roleId : undefined,
      typeof normalized.roleSlug === "string" ? normalized.roleSlug : undefined
    );
    if (role.error) errors.roleId = role.error;

    const candidate = {
      fullName: normalized.fullName,
      email: normalized.email,
      phone: normalized.phone,
      departmentId: dept.id,
      designation: normalized.designation,
      salary: normalized.salary,
      joiningDate: normalized.joiningDate,
      status: normalized.status || Status.ACTIVE,
      roleId: role.id,
      reportingManagerId: manager.id,
      profileImageUrl: normalized.profileImageUrl,
      password: normalized.password,
    };

    const parsed = createEmployeeSchema.safeParse(candidate);
    if (!parsed.success) {
      Object.assign(errors, formatZodErrors(parsed.error as ZodError));
    }

    if (parsed.success && role.id) {
      try {
        await assertAssignableRole(actor, role.id);
      } catch (err) {
        if (err instanceof AppError) {
          errors.roleId = err.errors?.roleId || err.message;
        }
      }
    }

    const emailCandidate = parsed.success
      ? parsed.data.email
      : typeof normalized.email === "string"
        ? normalized.email.trim().toLowerCase()
        : undefined;
    if (emailCandidate && seenEmails.has(emailCandidate)) {
      errors.email = "Duplicate email in this CSV file";
    }

    if (Object.keys(errors).length > 0 || !parsed.success) {
      failedRows.push({ row: rowNumber, errors });
      continue;
    }

    const data = parsed.data;
    seenEmails.add(data.email);

    try {
      const employee = await createEmployeeRecord(data, actor);
      created.push(employee);
    } catch (err) {
      if (err instanceof AppError && err.errors) {
        failedRows.push({ row: rowNumber, errors: err.errors });
      } else if (err instanceof AppError) {
        failedRows.push({
          row: rowNumber,
          errors: { _root: err.message },
        });
      } else {
        failedRows.push({
          row: rowNumber,
          errors: { _root: "Unexpected error creating employee" },
        });
      }
    }
  }

  return {
    successCount: created.length,
    failedCount: failedRows.length,
    failedRows,
    created,
  };
}
