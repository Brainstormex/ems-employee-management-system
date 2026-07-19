import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { ADMIN, EMPLOYEE, loginAs } from "./helpers";

describe("GET /api/dashboard/stats", () => {
  const app = createApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns aggregate card stats excluding soft-deleted", async () => {
    const { cookies } = await loginAs(app, ADMIN);
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);

    const { data } = res.body;
    expect(data.totalEmployees).toBeGreaterThanOrEqual(15);
    expect(data.activeEmployees).toBeGreaterThan(0);
    expect(data.inactiveEmployees).toBeGreaterThanOrEqual(0);
    expect(data.departmentCount).toBe(4);
    expect(data.totalEmployees).toBe(
      data.activeEmployees + data.inactiveEmployees
    );

    // Cross-check against DB aggregates
    const [total, active, inactive, depts] = await Promise.all([
      prisma.employee.count({ where: { deletedAt: null } }),
      prisma.employee.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.employee.count({ where: { deletedAt: null, status: "INACTIVE" } }),
      prisma.department.count(),
    ]);

    expect(data.totalEmployees).toBe(total);
    expect(data.activeEmployees).toBe(active);
    expect(data.inactiveEmployees).toBe(inactive);
    expect(data.departmentCount).toBe(depts);
  });

  it("includes chart series for department, status, and hires", async () => {
    const { cookies } = await loginAs(app, ADMIN);
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);
    const { charts } = res.body.data;

    expect(charts.employeesPerDepartment.length).toBeGreaterThanOrEqual(1);
    expect(charts.employeesPerDepartment[0]).toEqual(
      expect.objectContaining({
        departmentId: expect.any(String),
        departmentName: expect.any(String),
        count: expect.any(Number),
      })
    );

    const statusTotal = charts.employeesByStatus.reduce(
      (sum: number, s: { count: number }) => sum + s.count,
      0
    );
    expect(statusTotal).toBe(res.body.data.totalEmployees);

    expect(charts.hiresPerMonth).toHaveLength(12);
    expect(charts.hiresPerMonth[0].month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("allows EMPLOYEE to read stats", async () => {
    const { cookies } = await loginAs(app, EMPLOYEE);
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body.data.totalEmployees).toBeGreaterThan(0);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(401);
  });
});
