import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { writeAudit } from "../utils/audit.js";

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

export const authRouter = Router();

function signToken(user: { _id: { toString(): string }; email: string; role: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT secret is not configured");
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role },
    secret,
    { expiresIn: "12h" }
  );
}

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid credentials payload", errors: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = signToken(user);
  await writeAudit(
    { userId: user._id.toString(), email: user.email, role: user.role as "admin" },
    "login",
    "user",
    user._id.toString()
  );

  return res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

authRouter.post("/register", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const exists = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (exists) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: parsed.data.role,
  });

  await writeAudit(req.auth, "create", "user", user._id.toString(), { role: user.role });

  return res.status(201).json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

authRouter.post("/forgot-password", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await User.findOne({ email });
  // Always return success to avoid email enumeration
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

  return res.json({
    message: "Reset token issued (demo mode returns token in response).",
    resetToken,
  });
});

authRouter.post("/reset-password", async (req, res) => {
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
  await user.save();

  return res.json({ message: "Password updated. You can sign in now." });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.auth!.userId).select("-passwordHash -resetToken");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});
