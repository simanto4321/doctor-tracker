import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { cookieNames, getJwtSecret } from "../utils/tokens.js";

export type AuthPayload = {
  userId: string;
  email: string;
  role: "admin" | "receptionist" | "doctor";
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function readAccessToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookieToken = req.cookies?.[cookieNames.ACCESS_COOKIE];
  if (typeof cookieToken === "string" && cookieToken) return cookieToken;
  return undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readAccessToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: AuthPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "You do not have permission for this action" });
    }
    return next();
  };
}
