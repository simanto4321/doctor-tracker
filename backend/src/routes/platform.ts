import { Router } from "express";
import { EmailOutbox } from "../models/EmailOutbox.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getCache } from "../utils/cache.js";
import { sendActivityDigests } from "../utils/digest.js";

export const platformRouter = Router();

platformRouter.get("/health/detail", async (_req, res) => {
  const cache = getCache();
  return res.json({
    status: "ok",
    service: "doctor-tracker-api",
    dbMode: process.env.MONGODB_URI ? "external" : "memory",
    cacheMode: cache.mode,
    cookieAuth: true,
    docs: "/api/docs",
  });
});

platformRouter.get("/emails", requireAuth, requireRole("admin"), async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const items = await EmailOutbox.find().sort({ createdAt: -1 }).limit(limit).lean();
  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
  });
});

platformRouter.post("/digests/run", requireAuth, requireRole("admin"), async (_req, res) => {
  const result = await sendActivityDigests();
  return res.json({ message: "Activity digests queued/sent", ...result });
});
