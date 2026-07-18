import { CookieOptions, Response } from "express";

const ACCESS_COOKIE = "accessToken";
const REFRESH_COOKIE = "refreshToken";

function baseCookieOptions(): CookieOptions {
  const isSecure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    path: "/",
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookies(res: Response): void {
  const opts = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
