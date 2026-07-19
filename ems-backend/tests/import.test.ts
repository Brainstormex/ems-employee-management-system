import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { ADMIN, HR, EMPLOYEE, loginAs } from "./helpers";

describe("POST /api/employees/import", () => {
  const app = createApp();
  const emails = [
    "csv.ok1@ems.local",
    "csv.ok2@ems.local",
    "csv.bad@ems.local",
    "csv.dup@ems.local",
  ];

  afterAll(async () => {
    await cleanupByEmails(emails);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupByEmails(emails);
  });

  async function cleanupByEmails(list: string[]) {
    for (const email of list) {
      const emp = await prisma.employee.findUnique({
        where: { email },
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
  }

  it("rejects EMPLOYEE role", async () => {
    const { cookies } = await loginAs(app, EMPLOYEE);
    const res = await request(app)
      .post("/api/employees/import")
      .set("Cookie", cookies)
      .attach(
        "file",
        Buffer.from(
          "fullName,email,phone,department,designation,salary,joiningDate\nA,a@x.com,+15551111111,Engineering,Dev,1,2024-01-01\n"
        ),
        "employees.csv"
      );

    expect(res.status).toBe(403);
  });

  it("imports valid rows and reports failed rows without aborting", async () => {
    const { cookies } = await loginAs(app, HR);
    const csv = [
      "fullName,email,phone,department,designation,salary,joiningDate,status,role,reportingManagerCode,password",
      "CSV Ok One,csv.ok1@ems.local,+15550000001,Engineering,Engineer,90000,2024-03-01,ACTIVE,employee,EMP-0001,ChangeMe@123",
      "CSV Bad,csv.bad@ems.local,not-a-phone,Engineering,Engineer,90000,2024-03-01,ACTIVE,employee,,ChangeMe@123",
      "CSV Ok Two,csv.ok2@ems.local,+15550000002,Sales,Rep,80000,2024-04-01,ACTIVE,employee,,ChangeMe@123",
    ].join("\n");

    const res = await request(app)
      .post("/api/employees/import")
      .set("Cookie", cookies)
      .attach("file", Buffer.from(csv), "employees.csv");

    expect(res.status).toBe(200);
    expect(res.body.data.successCount).toBe(2);
    expect(res.body.data.failedCount).toBe(1);
    expect(res.body.data.failedRows).toHaveLength(1);
    expect(res.body.data.failedRows[0].row).toBe(3);
    expect(res.body.data.failedRows[0].errors).toHaveProperty("phone");
    expect(res.body.data.created).toHaveLength(2);
  });

  it("rejects missing file", async () => {
    const { cookies } = await loginAs(app, ADMIN);
    const res = await request(app)
      .post("/api/employees/import")
      .set("Cookie", cookies);

    expect(res.status).toBe(400);
  });

  it("blocks HR from assigning SUPER_ADMIN via CSV", async () => {
    const { cookies } = await loginAs(app, HR);
    const csv = [
      "fullName,email,phone,department,designation,salary,joiningDate,role",
      "CSV Admin Attempt,csv.dup@ems.local,+15550000003,Engineering,Admin,100000,2024-01-01,SUPER_ADMIN",
    ].join("\n");

    const res = await request(app)
      .post("/api/employees/import")
      .set("Cookie", cookies)
      .attach("file", Buffer.from(csv), "employees.csv");

    expect(res.status).toBe(200);
    expect(res.body.data.successCount).toBe(0);
    expect(res.body.data.failedRows[0].errors.roleId).toMatch(/Super Admin|administrator|privileged/i);
  });
});
