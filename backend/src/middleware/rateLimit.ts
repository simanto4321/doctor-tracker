import rateLimit from "express-rate-limit";
import { config } from "../config.js";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests — please try again later." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth attempts — account temporarily throttled." },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts from this IP. Try again in 15 minutes." },
});
