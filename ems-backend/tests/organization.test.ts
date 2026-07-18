import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { buildOrgTree } from "../src/services/organization.service";
import { Status } from "../src/types";

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
    user: res.body.user as { id: string; employeeId: string; email: string },
  };
}

type TreeNode = {
  id: string;
  fullName: string;
  directReportCount: number;
  children: TreeNode[];
};

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

describe("buildOrgTree (unit)", () => {
  it("builds nested tree and marks orphans as roots", () => {
    const tree = buildOrgTree([
      {
        id: "a",
        employeeCode: "EMP-1",
        fullName: "Ava",
        designation: "CEO",
        status: Status.ACTIVE,
        reportingManagerId: null,
        departmentName: "Engineering",
      },
      {
        id: "b",
        employeeCode: "EMP-2",
        fullName: "Bob",
        designation: "VP",
        status: Status.ACTIVE,
        reportingManagerId: "a",
        departmentName: "Engineering",
      },
      {
        id: "c",
        employeeCode: "EMP-3",
        fullName: "Cara",
        designation: "Eng",
        status: Status.ACTIVE,
        reportingManagerId: "b",
        departmentName: "Engineering",
      },
      {
        id: "d",
        employeeCode: "EMP-4",
        fullName: "Dan",
        designation: "Orphan",
        status: Status.ACTIVE,
        reportingManagerId: "missing-manager",
        departmentName: "Sales",
      },
    ]);

    expect(tree).toHaveLength(2); // Ava + Dan
    expect(tree[0].fullName).toBe("Ava");
    expect(tree[0].directReportCount).toBe(1);
    expect(tree[0].children[0].fullName).toBe("Bob");
    expect(tree[0].children[0].children[0].fullName).toBe("Cara");
    expect(tree[1].fullName).toBe("Dan");
  });
});

describe("Organization hierarchy API", () => {
  const app = createApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("GET /api/organization/tree", () => {
    it("returns nested hierarchy excluding soft-deleted", async () => {
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .get("/api/organization/tree")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.meta.employeeCount).toBeGreaterThanOrEqual(15);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Seed root is Ava Chen (CEO)
      const root = res.body.data.find((n: TreeNode) => n.fullName === "Ava Chen");
      expect(root).toBeTruthy();
      expect(root.directReportCount).toBeGreaterThanOrEqual(3);

      // Soft-deleted must never appear — create one and verify
      const { cookies: adminCookies } = await loginAs(app, ADMIN);
      const eng = await prisma.department.findUnique({
        where: { name: "Engineering" },
      });
      const created = await request(app)
        .post("/api/employees")
        .set("Cookie", adminCookies)
        .send({
          fullName: "Ghost Employee",
          email: `ghost.${Date.now()}@ems.local`,
          phone: "+14155553333",
          departmentId: eng!.id,
          designation: "Ghost",
          salary: 50000,
          joiningDate: "2024-01-01",
        });
      expect(created.status).toBe(201);
      const ghostId = created.body.data.id as string;

      await request(app)
        .delete(`/api/employees/${ghostId}`)
        .set("Cookie", adminCookies);

      const treeAfter = await request(app)
        .get("/api/organization/tree")
        .set("Cookie", adminCookies);
      expect(findNode(treeAfter.body.data, ghostId)).toBeNull();

      // cleanup hard delete
      const emp = await prisma.employee.findUnique({
        where: { id: ghostId },
        include: { user: true },
      });
      if (emp?.user) {
        await prisma.refreshToken.deleteMany({ where: { userId: emp.user.id } });
        await prisma.user.delete({ where: { id: emp.user.id } });
      }
      if (emp) await prisma.employee.delete({ where: { id: ghostId } });
    });

    it("requires authentication", async () => {
      const res = await request(app).get("/api/organization/tree");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/employees/:id/reportees", () => {
    it("returns direct reports for a manager", async () => {
      const ava = await prisma.employee.findUnique({
        where: { email: "admin@ems.local" },
      });
      const { cookies } = await loginAs(app, HR);
      const res = await request(app)
        .get(`/api/employees/${ava!.id}/reportees`)
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.meta.count).toBeGreaterThanOrEqual(3);
      expect(
        res.body.data.every(
          (e: { reportingManagerId: string }) => e.reportingManagerId === ava!.id
        )
      ).toBe(true);
    });

    it("allows EMPLOYEE to view own reportees", async () => {
      // Sam Patel (EMP-0005) manages Alex — login as sam
      const samLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "sam.patel@ems.local", password: "Employee@123" });
      expect(samLogin.status).toBe(200);
      const cookies = cookieHeader(getCookies(samLogin));
      const samId = samLogin.body.user.employeeId as string;

      const res = await request(app)
        .get(`/api/employees/${samId}/reportees`)
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.meta.count).toBeGreaterThanOrEqual(1);
    });

    it("blocks EMPLOYEE from viewing someone else's reportees", async () => {
      const { cookies, user } = await loginAs(app, EMPLOYEE);
      const ava = await prisma.employee.findUnique({
        where: { email: "admin@ems.local" },
      });
      expect(user.employeeId).not.toBe(ava!.id);

      const res = await request(app)
        .get(`/api/employees/${ava!.id}/reportees`)
        .set("Cookie", cookies);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/employees/:id/manager", () => {
    it("assigns a valid manager", async () => {
      const { cookies } = await loginAs(app, HR);
      const alex = await prisma.employee.findUnique({
        where: { email: "alex.rivera@ems.local" },
      });
      const jordan = await prisma.employee.findUnique({
        where: { email: "jordan.lee@ems.local" },
      });

      // Move Alex under Jordan (valid — Jordan is VP Eng, not in Alex's downline incorrectly)
      // Alex currently reports to Sam who reports to Jordan — so Jordan is ancestor.
      // Assigning Jordan as Alex's manager is fine (skipping Sam).
      const res = await request(app)
        .patch(`/api/employees/${alex!.id}/manager`)
        .set("Cookie", cookies)
        .send({ reportingManagerId: jordan!.id });

      expect(res.status).toBe(200);
      expect(res.body.data.reportingManagerId).toBe(jordan!.id);

      // Restore original manager (Sam Patel)
      const sam = await prisma.employee.findUnique({
        where: { email: "sam.patel@ems.local" },
      });
      await request(app)
        .patch(`/api/employees/${alex!.id}/manager`)
        .set("Cookie", cookies)
        .send({ reportingManagerId: sam!.id });
    });

    it("rejects self as manager", async () => {
      const { cookies } = await loginAs(app, HR);
      const alex = await prisma.employee.findUnique({
        where: { email: "alex.rivera@ems.local" },
      });

      const res = await request(app)
        .patch(`/api/employees/${alex!.id}/manager`)
        .set("Cookie", cookies)
        .send({ reportingManagerId: alex!.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/own reporting manager/i);
    });

    it("rejects circular reporting (subordinate as manager)", async () => {
      const { cookies } = await loginAs(app, ADMIN);
      // Jordan Lee manages Sam Patel. Try to make Sam the manager of Jordan → cycle.
      const jordan = await prisma.employee.findUnique({
        where: { email: "jordan.lee@ems.local" },
      });
      const sam = await prisma.employee.findUnique({
        where: { email: "sam.patel@ems.local" },
      });

      const res = await request(app)
        .patch(`/api/employees/${jordan!.id}/manager`)
        .set("Cookie", cookies)
        .send({ reportingManagerId: sam!.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/circular/i);
    });

    it("rejects deeper circular reporting (grandchild as manager)", async () => {
      const { cookies } = await loginAs(app, ADMIN);
      // Ava -> Jordan -> Sam -> Alex. Make Alex manager of Ava → cycle.
      const ava = await prisma.employee.findUnique({
        where: { email: "admin@ems.local" },
      });
      const alex = await prisma.employee.findUnique({
        where: { email: "alex.rivera@ems.local" },
      });

      const res = await request(app)
        .patch(`/api/employees/${ava!.id}/manager`)
        .set("Cookie", cookies)
        .send({ reportingManagerId: alex!.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/circular/i);
    });

    it("allows clearing manager (null)", async () => {
      const { cookies: adminCookies } = await loginAs(app, ADMIN);
      const eng = await prisma.department.findUnique({
        where: { name: "Engineering" },
      });

      const created = await request(app)
        .post("/api/employees")
        .set("Cookie", adminCookies)
        .send({
          fullName: "Temp Unmanaged",
          email: `unmanaged.${Date.now()}@ems.local`,
          phone: "+14155554444",
          departmentId: eng!.id,
          designation: "Temp",
          salary: 55000,
          joiningDate: "2024-03-01",
          reportingManagerId: (
            await prisma.employee.findUnique({ where: { email: "admin@ems.local" } })
          )!.id,
        });
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;

      const cleared = await request(app)
        .patch(`/api/employees/${id}/manager`)
        .set("Cookie", adminCookies)
        .send({ reportingManagerId: null });

      expect(cleared.status).toBe(200);
      expect(cleared.body.data.reportingManagerId).toBeNull();

      const emp = await prisma.employee.findUnique({
        where: { id },
        include: { user: true },
      });
      if (emp?.user) {
        await prisma.refreshToken.deleteMany({ where: { userId: emp.user.id } });
        await prisma.user.delete({ where: { id: emp.user.id } });
      }
      if (emp) await prisma.employee.delete({ where: { id } });
    });

    it("blocks EMPLOYEE from assigning managers", async () => {
      const { cookies, user } = await loginAs(app, EMPLOYEE);
      const jordan = await prisma.employee.findUnique({
        where: { email: "jordan.lee@ems.local" },
      });

      const res = await request(app)
        .patch(`/api/employees/${user.employeeId}/manager`)
        .set("Cookie", cookies)
        .send({ reportingManagerId: jordan!.id });

      expect(res.status).toBe(403);
    });
  });
});
