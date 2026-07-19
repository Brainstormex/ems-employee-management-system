import request from "supertest";
import { createApp } from "../src/app";
import { SYSTEM_ROLE_SLUGS } from "../src/lib/permissions";

export const ADMIN = { email: "admin@ems.local", password: "Admin@12345" };
export const HR = { email: "hr1@ems.local", password: "Hr@12345678" };
export const EMPLOYEE = {
  email: "alex.rivera@ems.local",
  password: "Employee@123",
};

export function getCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function cookieHeader(cookies: string[]): string {
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

export async function loginAs(
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
      email: string;
      role: { id: string; slug: string; name: string; isSystem: boolean };
      permissions: string[];
    },
  };
}

export { SYSTEM_ROLE_SLUGS };
