import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import type { AuthPayload } from "../middleware/auth.js";
import { RefreshToken } from "../models/RefreshToken.js";

const ACCESS_COOKIE = "dt_access";
const REFRESH_COOKIE = "dt_refresh";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT secret is not configured");
  return secret;
}

export function signAccessToken(payload: AuthPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env.ACCESS_TOKEN_TTL || "15m") as jwt.SignOptions["expiresIn"],
  });
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createRefreshTokenValue() {
  return crypto.randomBytes(48).toString("hex");
}

export async function issueRefreshToken(params: {
  userId: string;
  userAgent?: string;
  ip?: string;
}) {
  const raw = createRefreshTokenValue();
  const days = Number(process.env.REFRESH_TOKEN_DAYS || 14);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    user: params.userId,
    tokenHash: hashToken(raw),
    expiresAt,
    userAgent: params.userAgent || "",
    ip: params.ip || "",
  });
  return { raw, expiresAt };
}

export async function rotateRefreshToken(raw: string, meta: { userAgent?: string; ip?: string }) {
  const existing = await RefreshToken.findOne({
    tokenHash: hashToken(raw),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!existing) return null;
  existing.revokedAt = new Date();
  await existing.save();
  return issueRefreshToken({
    userId: String(existing.user),
    userAgent: meta.userAgent,
    ip: meta.ip,
  }).then(async (next) => ({ userId: String(existing.user), ...next }));
}

export async function revokeRefreshToken(raw: string) {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(raw), revokedAt: null },
    { revokedAt: new Date() }
  );
}

function cookieOptions(maxAgeMs: number) {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.VERCEL === "1";
  return {
    httpOnly: true,
    secure,
    // Cross-site frontend/API on Vercel needs None+Secure; local stays Lax.
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  refreshExpiresAt: Date
) {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie(
    REFRESH_COOKIE,
    refreshToken,
    cookieOptions(Math.max(1000, refreshExpiresAt.getTime() - Date.now()))
  );
}

export function clearAuthCookies(res: Response) {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.VERCEL === "1";
  const base = {
    path: "/",
    secure,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
  };
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

export const cookieNames = { ACCESS_COOKIE, REFRESH_COOKIE };
