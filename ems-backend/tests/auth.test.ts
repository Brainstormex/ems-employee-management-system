import request from "supertest";
import { createApp } from "../src/app";
import { Role } from "../src/types";

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

describe("Auth API", () => {
  const app = createApp();

  describe("POST /api/auth/login", () => {
    it("logs in with valid credentials and sets httpOnly cookies", async () => {
      const res = await request(app).post("/api/auth/login").send(ADMIN);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: ADMIN.email,
        role: Role.SUPER_ADMIN,
      });
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();

      const cookies = getCookies(res);
      expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
      expect(cookies.every((c) => c.includes("HttpOnly"))).toBe(true);
    });

    it("rejects invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: ADMIN.email, password: "wrong-password" });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it("rejects unknown email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@ems.local", password: "whatever" });

      expect(res.status).toBe(401);
    });

    it("returns field errors for invalid body", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "not-an-email", password: "" });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.email || res.body.errors.password).toBeTruthy();
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns current user when authenticated", async () => {
      const login = await request(app).post("/api/auth/login").send(HR);
      const cookies = cookieHeader(getCookies(login));

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(HR.email);
      expect(res.body.user.role).toBe(Role.HR_MANAGER);
    });

    it("returns 401 without cookie", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("issues a new access token from a valid refresh cookie", async () => {
      const login = await request(app).post("/api/auth/login").send(EMPLOYEE);
      const cookies = cookieHeader(getCookies(login));

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      const newCookies = getCookies(res);
      expect(newCookies.some((c) => c.startsWith("accessToken="))).toBe(true);
      expect(newCookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
    });

    it("returns 401 without refresh cookie", async () => {
      const res = await request(app).post("/api/auth/refresh");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears cookies and revokes refresh token", async () => {
      const login = await request(app).post("/api/auth/login").send(ADMIN);
      const cookies = cookieHeader(getCookies(login));

      const logout = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", cookies);

      expect(logout.status).toBe(200);

      const refresh = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookies);

      expect(refresh.status).toBe(401);
    });
  });
});

describe("RBAC middleware", () => {
  const app = createApp();

  async function loginAs(creds: { email: string; password: string }) {
    const res = await request(app).post("/api/auth/login").send(creds);
    expect(res.status).toBe(200);
    return cookieHeader(getCookies(res));
  }

  it("allows SUPER_ADMIN on admin-only route", async () => {
    const cookies = await loginAs(ADMIN);
    const res = await request(app)
      .get("/rbac/admin-only")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
  });

  it("blocks HR_MANAGER on admin-only route", async () => {
    const cookies = await loginAs(HR);
    const res = await request(app)
      .get("/rbac/admin-only")
      .set("Cookie", cookies);
    expect(res.status).toBe(403);
  });

  it("blocks EMPLOYEE on admin-only route", async () => {
    const cookies = await loginAs(EMPLOYEE);
    const res = await request(app)
      .get("/rbac/admin-only")
      .set("Cookie", cookies);
    expect(res.status).toBe(403);
  });

  it("allows HR_MANAGER on hr-or-admin route", async () => {
    const cookies = await loginAs(HR);
    const res = await request(app)
      .get("/rbac/hr-or-admin")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
  });

  it("blocks EMPLOYEE on hr-or-admin route", async () => {
    const cookies = await loginAs(EMPLOYEE);
    const res = await request(app)
      .get("/rbac/hr-or-admin")
      .set("Cookie", cookies);
    expect(res.status).toBe(403);
  });

  it("allows any authenticated role on any-auth route", async () => {
    const cookies = await loginAs(EMPLOYEE);
    const res = await request(app)
      .get("/rbac/any-auth")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(Role.EMPLOYEE);
  });

  it("returns 401 on protected route without auth", async () => {
    const res = await request(app).get("/rbac/admin-only");
    expect(res.status).toBe(401);
  });
});
