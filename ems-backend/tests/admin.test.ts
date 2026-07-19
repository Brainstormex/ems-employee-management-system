import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { SYSTEM_ROLE_SLUGS } from "../src/lib/permissions";
import { ADMIN, HR, EMPLOYEE, loginAs } from "./helpers";

describe("Admin users & roles API", () => {
  const app = createApp();
  let customRoleId: string | null = null;
  let hrRoleId: string;
  let employeeRoleId: string;

  beforeAll(async () => {
    const hr = await prisma.accessRole.findUnique({
      where: { slug: SYSTEM_ROLE_SLUGS.HR_MANAGER },
    });
    const emp = await prisma.accessRole.findUnique({
      where: { slug: SYSTEM_ROLE_SLUGS.EMPLOYEE },
    });
    if (!hr || !emp) throw new Error("System roles missing");
    hrRoleId = hr.id;
    employeeRoleId = emp.id;
  });

  afterAll(async () => {
    if (customRoleId) {
      await prisma.accessRole.deleteMany({ where: { id: customRoleId } });
    }
    // Ensure alex is still employee role and active
    const alex = await prisma.user.findUnique({
      where: { email: EMPLOYEE.email },
    });
    if (alex) {
      await prisma.user.update({
        where: { id: alex.id },
        data: { roleId: employeeRoleId, isActive: true },
      });
    }
    await prisma.$disconnect();
  });

  it("lists users for Super Admin", async () => {
    const { cookies } = await loginAs(app, ADMIN);
    const res = await request(app)
      .get("/api/admin/users")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("blocks HR from listing users", async () => {
    const { cookies } = await loginAs(app, HR);
    const res = await request(app)
      .get("/api/admin/users")
      .set("Cookie", cookies);
    expect(res.status).toBe(403);
  });

  it("creates a custom role and assigns it", async () => {
    const { cookies } = await loginAs(app, ADMIN);
    const name = `Analyst ${Date.now()}`;
    const create = await request(app)
      .post("/api/admin/roles")
      .set("Cookie", cookies)
      .send({
        name,
        description: "Read-only analyst",
        permissionKeys: ["employees:read:all", "dashboard:read"],
      });
    expect(create.status).toBe(201);
    customRoleId = create.body.data.id;
    expect(create.body.data.isSystem).toBe(false);

    const alex = await prisma.user.findUnique({
      where: { email: EMPLOYEE.email },
    });
    const patch = await request(app)
      .patch(`/api/admin/users/${alex!.id}`)
      .set("Cookie", cookies)
      .send({ roleId: customRoleId });
    expect(patch.status).toBe(200);
    expect(patch.body.data.role.id).toBe(customRoleId);

    // restore employee role for other suites
    await request(app)
      .patch(`/api/admin/users/${alex!.id}`)
      .set("Cookie", cookies)
      .send({ roleId: employeeRoleId });
  });

  it("blocks modifying system roles", async () => {
    const { cookies } = await loginAs(app, ADMIN);
    const res = await request(app)
      .put(`/api/admin/roles/${hrRoleId}`)
      .set("Cookie", cookies)
      .send({ name: "Hacked HR" });
    expect(res.status).toBe(400);
  });

  it("blocks self-disable", async () => {
    const { cookies, user } = await loginAs(app, ADMIN);
    const res = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set("Cookie", cookies)
      .send({ isActive: false });
    expect(res.status).toBe(400);
  });

  it("disables a user and blocks their login", async () => {
    const { cookies } = await loginAs(app, ADMIN);
    const alex = await prisma.user.findUnique({
      where: { email: EMPLOYEE.email },
    });

    const disable = await request(app)
      .patch(`/api/admin/users/${alex!.id}`)
      .set("Cookie", cookies)
      .send({ isActive: false });
    expect(disable.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send(EMPLOYEE);
    expect(login.status).toBe(401);

    await request(app)
      .patch(`/api/admin/users/${alex!.id}`)
      .set("Cookie", cookies)
      .send({ isActive: true });
  });

  it("prevents demoting the last privileged admin", async () => {
    const { cookies, user } = await loginAs(app, ADMIN);
    // Ensure only one privileged admin: demote would fail
    const res = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set("Cookie", cookies)
      .send({ roleId: employeeRoleId });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last active administrator/i);
  });
});
