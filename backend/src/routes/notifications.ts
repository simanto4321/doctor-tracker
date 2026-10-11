import { Router } from "express";
import { Notification } from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const unreadOnly = req.query.unread === "true";
  const filter = unreadOnly ? { read: false } : {};
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(30).lean();
  const unreadCount = await Notification.countDocuments({ read: false });
  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
    unreadCount,
  });
});

notificationsRouter.post("/read-all", async (_req, res) => {
  await Notification.updateMany({ read: false }, { read: true });
  return res.json({ message: "All notifications marked as read" });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const item = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true }).lean();
  if (!item) return res.status(404).json({ message: "Notification not found" });
  return res.json({ ...item, id: item._id });
});
