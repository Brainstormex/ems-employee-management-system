import request from "supertest";
import { createApp } from "../src/app";
import { SYSTEM_ROLE_SLUGS } from "../src/lib/permissions";
import {
  ADMIN,
  HR,
  EMPLOYEE,
  getCookies,
  cookieHeader,
  loginAs,
} from "./helpers";

describe("Auth API", () => {
  const app = createApp();

  describe("POST /api/auth/login", () => {
    it("logs in with valid credentials and sets httpOnly cookies", async () => {
      const res = await request(app).post("/api/auth/login").send(ADMIN);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: ADMIN.email,
        role: { slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN },
      });
      expect(res.body.user.permissions).toEqual(
        expect.arrayContaining(["users:manage", "roles:manage"])
      );
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
      const { cookies } = await loginAs(app, HR);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(HR.email);
      expect(res.body.user.role.slug).toBe(SYSTEM_ROLE_SLUGS.HR_MANAGER);
      expect(res.body.user.permissions).toContain("employees:create");
    });

    it("returns 401 without cookie", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("issues a new access token from a valid refresh cookie", async () => {
      const { cookies } = await loginAs(app, EMPLOYEE);

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
      const { cookies } = await loginAs(app, ADMIN);

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

  it("allows SUPER_ADMIN on admin-only route", async () => {
    const { cookies } = await loginAs(app, ADMIN);
    const res = await request(app)
      .get("/rbac/admin-only")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
  });

  it("blocks HR_MANAGER on admin-only route", async () => {
    const { cookies } = await loginAs(app, HR);
    const res = await request(app)
      .get("/rbac/admin-only")
      .set("Cookie", cookies);
    expect(res.status).toBe(403);
  });

  it("blocks EMPLOYEE on admin-only route", async () => {
    const { cookies } = await loginAs(app, EMPLOYEE);
    const res = await request(app)
      .get("/rbac/admin-only")
      .set("Cookie", cookies);
    expect(res.status).toBe(403);
  });

  it("allows HR_MANAGER on hr-or-admin route", async () => {
    const { cookies } = await loginAs(app, HR);
    const res = await request(app)
      .get("/rbac/hr-or-admin")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
  });

  it("blocks EMPLOYEE on hr-or-admin route", async () => {
    const { cookies } = await loginAs(app, EMPLOYEE);
    const res = await request(app)
      .get("/rbac/hr-or-admin")
      .set("Cookie", cookies);
    expect(res.status).toBe(403);
  });

  it("allows any authenticated role on any-auth route", async () => {
    const { cookies } = await loginAs(app, EMPLOYEE);
    const res = await request(app)
      .get("/rbac/any-auth")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(SYSTEM_ROLE_SLUGS.EMPLOYEE);
  });

  it("returns 401 on protected route without auth", async () => {
    const res = await request(app).get("/rbac/admin-only");
    expect(res.status).toBe(401);
  });
});
