import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, requireRole, type AuthPayload } from "../middleware/auth.js";
import { authLimiter, loginLimiter } from "../middleware/rateLimit.js";
import { writeAudit } from "../utils/audit.js";
import { sendEmail } from "../utils/email.js";
import {
  clearAuthCookies,
  cookieNames,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  setAuthCookies,
  signAccessToken,
} from "../utils/tokens.js";
import { config, demoAccounts } from "../config.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  role: z.enum(["receptionist", "doctor"]).default("receptionist"),
});

const LOCK_MS = config.loginLockMs;
const MAX_ATTEMPTS = config.loginMaxAttempts;

export const authRouter = Router();

/** Public demo accounts for the login UI — driven entirely by env/config. */
authRouter.get("/demo-accounts", (_req, res) => {
  return res.json({
    enabled: config.showDemoAccounts,
    appName: config.appName,
    accounts: demoAccounts(),
  });
});

function publicUser(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
  emailVerified?: boolean;
}) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.emailVerified),
  };
}

async function issueSession(
  res: import("express").Response,
  user: { _id: { toString(): string }; email: string; role: string },
  req: import("express").Request
) {
  const payload: AuthPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role as AuthPayload["role"],
  };
  const accessToken = signAccessToken(payload);
  const refresh = await issueRefreshToken({
    userId: payload.userId,
    userAgent: req.get("user-agent") || "",
    ip: req.ip,
  });
  setAuthCookies(res, accessToken, refresh.raw, refresh.expiresAt);
  return { accessToken, refreshToken: refresh.raw, expiresAt: refresh.expiresAt };
}

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid credentials payload", errors: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    return res.status(429).json({
      message: "Account temporarily locked due to failed logins",
      lockUntil: user.lockUntil,
    });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= MAX_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_MS);
      user.loginAttempts = 0;
    }
    await user.save();
    return res.status(401).json({ message: "Invalid email or password" });
  }

  user.loginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  const session = await issueSession(res, user, req);
  await writeAudit(
    { userId: user._id.toString(), email: user.email, role: user.role as "admin" },
    "login",
    "user",
    user._id.toString()
  );

  return res.json({
    token: session.accessToken,
    refreshToken: session.refreshToken,
    cookieAuth: true,
    user: publicUser(user),
  });
});

authRouter.post("/refresh", authLimiter, async (req, res) => {
  const raw =
    (typeof req.cookies?.[cookieNames.REFRESH_COOKIE] === "string"
      ? req.cookies[cookieNames.REFRESH_COOKIE]
      : undefined) ||
    (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined);

  if (!raw) return res.status(401).json({ message: "Refresh token required" });

  const rotated = await rotateRefreshToken(raw, {
    userAgent: req.get("user-agent") || "",
    ip: req.ip,
  });
  if (!rotated) {
    clearAuthCookies(res);
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }

  const user = await User.findById(rotated.userId);
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ message: "User not found" });
  }

  const accessToken = signAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role as AuthPayload["role"],
  });
  setAuthCookies(res, accessToken, rotated.raw, rotated.expiresAt);

  return res.json({
    token: accessToken,
    refreshToken: rotated.raw,
    user: publicUser(user),
  });
});

authRouter.post("/logout", async (req, res) => {
  const raw =
    (typeof req.cookies?.[cookieNames.REFRESH_COOKIE] === "string"
      ? req.cookies[cookieNames.REFRESH_COOKIE]
      : undefined) ||
    (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined);
  if (raw) await revokeRefreshToken(raw);
  clearAuthCookies(res);
  return res.json({ message: "Signed out" });
});

authRouter.post("/register", requireAuth, requireRole("admin"), authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const exists = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (exists) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const verifyToken = crypto.randomBytes(24).toString("hex");
  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: parsed.data.role,
    emailVerified: false,
    emailVerifyToken: verifyToken,
    emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const verifyUrl = `${config.clientOrigins[0]}/verify-email?token=${verifyToken}`;
  const mail = await sendEmail({
    to: user.email,
    subject: "Verify your Doctor Tracker email",
    body: `Hi ${user.name},\n\nVerify your email:\n${verifyUrl}\n\nToken: ${verifyToken}`,
    kind: "verification",
    meta: { verifyToken },
  });

  await writeAudit(req.auth, "create", "user", user._id.toString(), { role: user.role });

  return res.status(201).json({
    user: publicUser(user),
    verification: {
      required: true,
      demoToken: mail.demo ? verifyToken : undefined,
      outboxId: mail.id,
    },
  });
});

authRouter.post("/verify-email", authLimiter, async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!token) return res.status(400).json({ message: "Verification token required" });

  const user = await User.findOne({
    emailVerifyToken: token,
    emailVerifyExpires: { $gt: new Date() },
  });
  if (!user) return res.status(400).json({ message: "Invalid or expired verification token" });

  user.emailVerified = true;
  user.emailVerifyToken = null;
  user.emailVerifyExpires = null;
  await user.save();

  return res.json({ message: "Email verified", user: publicUser(user) });
});

authRouter.post("/resend-verification", requireAuth, authLimiter, async (req, res) => {
  const user = await User.findById(req.auth!.userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.emailVerified) return res.json({ message: "Email already verified" });

  const verifyToken = crypto.randomBytes(24).toString("hex");
  user.emailVerifyToken = verifyToken;
  user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  const mail = await sendEmail({
    to: user.email,
    subject: "Verify your Doctor Tracker email",
    body: `Hi ${user.name},\n\nYour verification token:\n${verifyToken}`,
    kind: "verification",
    meta: { verifyToken },
  });

  return res.json({
    message: "Verification email sent",
    demoToken: mail.demo ? verifyToken : undefined,
  });
});

authRouter.post("/forgot-password", authLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({
      message: "If that email exists, a reset token was issued.",
      resetToken: null,
    });
  }

  const resetToken = crypto.randomBytes(24).toString("hex");
  user.resetToken = resetToken;
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const mail = await sendEmail({
    to: user.email,
    subject: "Reset your Doctor Tracker password",
    body: `Reset token: ${resetToken}`,
    kind: "reset",
    meta: { resetToken },
  });

  return res.json({
    message: "Reset token issued (demo mode returns token in response).",
    resetToken: mail.demo ? resetToken : null,
  });
});

authRouter.post("/reset-password", authLimiter, async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    password: z.string().min(6).max(72),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const user = await User.findOne({
    resetToken: parsed.data.token,
    resetTokenExpires: { $gt: new Date() },
  });
  if (!user) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }

  user.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  user.resetToken = null;
  user.resetTokenExpires = null;
  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  return res.json({ message: "Password updated. You can sign in now." });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.auth!.userId).select(
    "-passwordHash -resetToken -emailVerifyToken"
  );
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user: publicUser(user) });
});
