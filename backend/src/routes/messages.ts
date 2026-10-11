import { Router } from "express";
import { z } from "zod";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

messagesRouter.get("/peers", async (_req, res) => {
  const users = await User.find().select("name email role").sort({ name: 1 }).lean();
  return res.json({
    items: users.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role })),
  });
});

messagesRouter.get("/", async (req, res) => {
  const userId = req.auth!.userId;
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const box = typeof req.query.box === "string" ? req.query.box : "inbox";

  const filter =
    box === "sent"
      ? { from: userId, deletedAt: null }
      : { to: userId, deletedAt: null };

  const [items, total, unreadCount] = await Promise.all([
    Message.find(filter)
      .populate("from", "name email role")
      .populate("to", "name email role")
      .populate("patient", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Message.countDocuments(filter),
    Message.countDocuments({ to: userId, deletedAt: null, readAt: null }),
  ]);

  return res.json({
    items: items.map((m) => ({ ...m, id: m._id })),
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

messagesRouter.post("/", async (req, res) => {
  const schema = z.object({
    to: z.string().min(1),
    body: z.string().min(1).max(2000),
    subject: z.string().max(160).optional(),
    patient: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  if (parsed.data.to === req.auth!.userId) {
    return res.status(400).json({ message: "Cannot message yourself" });
  }
  const peer = await User.findById(parsed.data.to);
  if (!peer) return res.status(400).json({ message: "Recipient not found" });

  const message = await Message.create({
    from: req.auth!.userId,
    to: parsed.data.to,
    body: parsed.data.body,
    subject: parsed.data.subject || "",
    patient: parsed.data.patient || null,
  });

  const populated = await Message.findById(message._id)
    .populate("from", "name email role")
    .populate("to", "name email role")
    .populate("patient", "name")
    .lean();

  return res.status(201).json({ ...populated, id: message._id });
});

messagesRouter.post("/:id/read", async (req, res) => {
  const message = await Message.findOne({
    _id: req.params.id,
    to: req.auth!.userId,
    deletedAt: null,
  });
  if (!message) return res.status(404).json({ message: "Message not found" });
  if (!message.readAt) {
    message.readAt = new Date();
    await message.save();
  }
  return res.json({ id: message._id, readAt: message.readAt });
});
