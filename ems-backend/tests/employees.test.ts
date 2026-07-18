import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { Role, Status } from "../src/types";

const ADMIN = { email: "admin@ems.local", password: "Admin@12345" };
const HR = { email: "hr1@ems.local", password: "Hr@12345678" };
const EMPLOYEE = { email: "alex.rivera@ems.local", password: "Employee@123" };

function getCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function cookieHeader(cookies: string[]): string {
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function loginAs(
  app: ReturnType<typeof createApp>,
  creds: { email: string; password: string }
) {
  const res = await request(app).post("/api/auth/login").send(creds);
  expect(res.status).toBe(200);
  return {
    cookies: cookieHeader(getCookies(res)),
    user: res.body.user as {
      id: string;
      employeeId: string;
      role: Role;
      email: string;
    },
  };
}

describe("Employee CRUD API", () => {
  const app = createApp();
  let engineeringId: string;
  let createdEmployeeId: string | null = null;

  beforeAll(async () => {
    const eng = await prisma.department.findUnique({
      where: { name: "Engineering" },
    });
    if (!eng) throw new Error("Seed departments missing — run npm run db:seed");
    engineeringId = eng.id;
  });

  afterAll(async () => {
    // Clean up any leftover test employees created during this suite
    if (createdEmployeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: createdEmployeeId },
        include: { user: true },
      });
      if (emp?.user) {
        await prisma.refreshToken.deleteMany({ where: { userId: emp.user.id } });
        await prisma.user.delete({ where: { id: emp.user.id } });
      }
      if (emp) {
        await prisma.employee.delete({ where: { id: emp.id } });
      }
    }
    await prisma.$disconnect();
  });

  describe("GET /api/departments", () => {
    it("lists departments for authenticated users", async () => {
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .get("/api/departments")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      expect(res.body.data[0]).toHaveProperty("name");
    });
  });

  describe("GET /api/employees", () => {
    it("returns paginated employees for HR", async () => {
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .get("/api/employees")
        .query({ page: 1, limit: 5, sortBy: "fullName", sortOrder: "asc" })
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
      expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
    });

    it("supports search by name", async () => {
      const { cookies } = await loginAs(app, ADMIN);
      const res = await request(app)
        .get("/api/employees")
        .query({ search: "Ava" })
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.some((e: { fullName: string }) => e.fullName.includes("Ava"))).toBe(
        true
      );
    });

    it("filters by status", async () => {
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .get("/api/employees")
        .query({ status: Status.INACTIVE })
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(
        res.body.data.every((e: { status: string }) => e.status === Status.INACTIVE)
      ).toBe(true);
    });

    it("limits EMPLOYEE list to own record", async () => {
      const { cookies, user } = await loginAs(app, EMPLOYEE);
      const res = await request(app)
        .get("/api/employees")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(user.employeeId);
    });
  });

  describe("POST /api/employees", () => {
    it("allows HR to create an employee", async () => {
      const { cookies } = await loginAs(app, HR);
      const unique = `test.hr.${Date.now()}@ems.local`;

      const res = await request(app)
        .post("/api/employees")
        .set("Cookie", cookies)
        .send({
          fullName: "Test Hire",
          email: unique,
          phone: "+14155559999",
          departmentId: engineeringId,
          designation: "QA Engineer",
          salary: 75000.5,
          joiningDate: "2024-06-01",
          status: Status.ACTIVE,
          role: Role.EMPLOYEE,
          password: "TestPass@123",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe(unique);
      expect(res.body.data.employeeCode).toMatch(/^EMP-\d{4}$/);
      expect(res.body.data.role).toBe(Role.EMPLOYEE);
      createdEmployeeId = res.body.data.id;
    });

    it("blocks HR from assigning SUPER_ADMIN role", async () => {
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .post("/api/employees")
        .set("Cookie", cookies)
        .send({
          fullName: "Evil Hire",
          email: `evil.${Date.now()}@ems.local`,
          phone: "+14155558888",
          departmentId: engineeringId,
          designation: "Hacker",
          salary: 100000,
          joiningDate: "2024-01-01",
          role: Role.SUPER_ADMIN,
        });

      expect(res.status).toBe(403);
    });

    it("blocks EMPLOYEE from creating employees", async () => {
      const { cookies } = await loginAs(app, EMPLOYEE);
      const res = await request(app)
        .post("/api/employees")
        .set("Cookie", cookies)
        .send({
          fullName: "Nope",
          email: `nope.${Date.now()}@ems.local`,
          phone: "+14155557777",
          departmentId: engineeringId,
          designation: "Intern",
          salary: 40000,
          joiningDate: "2024-01-01",
        });

      expect(res.status).toBe(403);
    });

    it("returns validation errors for bad payload", async () => {
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .post("/api/employees")
        .set("Cookie", cookies)
        .send({
          fullName: "A",
          email: "bad",
          phone: "123",
          departmentId: "not-a-uuid",
          designation: "X",
          salary: -5,
          joiningDate: "2099-01-01",
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.email || res.body.errors.phone).toBeTruthy();
    });
  });

  describe("PUT /api/employees/:id", () => {
    it("allows EMPLOYEE to update phone only", async () => {
      const { cookies, user } = await loginAs(app, EMPLOYEE);
      const res = await request(app)
        .put(`/api/employees/${user.employeeId}`)
        .set("Cookie", cookies)
        .send({ phone: "+14155551234" });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe("+14155551234");
    });

    it("rejects EMPLOYEE updating salary", async () => {
      const { cookies, user } = await loginAs(app, EMPLOYEE);
      const res = await request(app)
        .put(`/api/employees/${user.employeeId}`)
        .set("Cookie", cookies)
        .send({ salary: 999999 });

      expect(res.status).toBe(400);
      expect(res.body.errors?.salary || res.body.message).toBeTruthy();
    });

    it("blocks EMPLOYEE from editing another profile", async () => {
      const { cookies } = await loginAs(app, EMPLOYEE);
      const admin = await prisma.user.findUnique({
        where: { email: ADMIN.email },
      });
      const res = await request(app)
        .put(`/api/employees/${admin!.employeeId}`)
        .set("Cookie", cookies)
        .send({ phone: "+14155550000" });

      expect(res.status).toBe(403);
    });

    it("allows HR to update designation", async () => {
      expect(createdEmployeeId).toBeTruthy();
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .put(`/api/employees/${createdEmployeeId}`)
        .set("Cookie", cookies)
        .send({ designation: "Senior QA Engineer" });

      expect(res.status).toBe(200);
      expect(res.body.data.designation).toBe("Senior QA Engineer");
    });
  });

  describe("DELETE /api/employees/:id (soft delete)", () => {
    it("blocks HR from deleting", async () => {
      expect(createdEmployeeId).toBeTruthy();
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .delete(`/api/employees/${createdEmployeeId}`)
        .set("Cookie", cookies);

      expect(res.status).toBe(403);
    });

    it("allows SUPER_ADMIN to soft-delete and unassigns reports", async () => {
      // Create a manager + report for cascade check
      const { cookies: adminCookies } = await loginAs(app, ADMIN);
      const mgrEmail = `mgr.${Date.now()}@ems.local`;
      const reportEmail = `report.${Date.now()}@ems.local`;

      const mgr = await request(app)
        .post("/api/employees")
        .set("Cookie", adminCookies)
        .send({
          fullName: "Temp Manager",
          email: mgrEmail,
          phone: "+14155551111",
          departmentId: engineeringId,
          designation: "Temp Mgr",
          salary: 90000,
          joiningDate: "2023-01-01",
          role: Role.EMPLOYEE,
        });
      expect(mgr.status).toBe(201);
      const managerId = mgr.body.data.id as string;

      const report = await request(app)
        .post("/api/employees")
        .set("Cookie", adminCookies)
        .send({
          fullName: "Temp Report",
          email: reportEmail,
          phone: "+14155552222",
          departmentId: engineeringId,
          designation: "Temp Report",
          salary: 60000,
          joiningDate: "2023-06-01",
          role: Role.EMPLOYEE,
          reportingManagerId: managerId,
        });
      expect(report.status).toBe(201);
      const reportId = report.body.data.id as string;

      const del = await request(app)
        .delete(`/api/employees/${managerId}`)
        .set("Cookie", adminCookies);
      expect(del.status).toBe(200);

      // Soft-deleted excluded from default list
      const list = await request(app)
        .get("/api/employees")
        .query({ search: "Temp Manager" })
        .set("Cookie", adminCookies);
      expect(list.body.data.every((e: { id: string }) => e.id !== managerId)).toBe(
        true
      );

      // Direct report unassigned
      const reportAfter = await request(app)
        .get(`/api/employees/${reportId}`)
        .set("Cookie", adminCookies);
      expect(reportAfter.body.data.reportingManagerId).toBeNull();

      // Admin can see with includeDeleted
      const deleted = await request(app)
        .get("/api/employees")
        .query({ search: "Temp Manager", includeDeleted: "true" })
        .set("Cookie", adminCookies);
      expect(deleted.body.data.some((e: { id: string }) => e.id === managerId)).toBe(
        true
      );

      // Restore
      const restored = await request(app)
        .post(`/api/employees/${managerId}/restore`)
        .set("Cookie", adminCookies);
      expect(restored.status).toBe(200);
      expect(restored.body.data.deletedAt).toBeNull();

      // Cleanup temps
      for (const id of [managerId, reportId]) {
        const emp = await prisma.employee.findUnique({
          where: { id },
          include: { user: true },
        });
        if (emp?.user) {
          await prisma.refreshToken.deleteMany({ where: { userId: emp.user.id } });
          await prisma.user.delete({ where: { id: emp.user.id } });
        }
        if (emp) await prisma.employee.delete({ where: { id } });
      }
    });

    it("soft-deletes the created test employee as SUPER_ADMIN", async () => {
      expect(createdEmployeeId).toBeTruthy();
      const { cookies } = await loginAs(app, ADMIN);
      const res = await request(app)
        .delete(`/api/employees/${createdEmployeeId}`)
        .set("Cookie", cookies);
      expect(res.status).toBe(200);

      // Hard-clean so afterAll is a no-op
      const emp = await prisma.employee.findUnique({
        where: { id: createdEmployeeId! },
        include: { user: true },
      });
      if (emp?.user) {
        await prisma.refreshToken.deleteMany({ where: { userId: emp.user.id } });
        await prisma.user.delete({ where: { id: emp.user.id } });
      }
      if (emp) await prisma.employee.delete({ where: { id: emp.id } });
      createdEmployeeId = null;
    });
  });
});
