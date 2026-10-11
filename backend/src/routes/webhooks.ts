import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { WebhookSubscription } from "../models/WebhookSubscription.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { dispatchWebhook } from "../utils/webhooks.js";

export const webhooksRouter = Router();
webhooksRouter.use(requireAuth);

webhooksRouter.get("/", requireRole("admin"), async (_req, res) => {
  const items = await WebhookSubscription.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
  return res.json({
    items: items.map((item) => ({
      ...item,
      id: item._id,
      secret: undefined,
      secretHint: `${String(item.secret).slice(0, 4)}…`,
    })),
  });
});

webhooksRouter.post("/", requireRole("admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(120),
    targetUrl: z.string().url(),
    events: z.array(z.string()).min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const secret = crypto.randomBytes(24).toString("hex");
  const sub = await WebhookSubscription.create({
    name: parsed.data.name,
    targetUrl: parsed.data.targetUrl,
    secret,
    events: parsed.data.events || ["doctor.created", "patient.created", "appointment.created"],
  });

  return res.status(201).json({
    id: sub._id,
    name: sub.name,
    targetUrl: sub.targetUrl,
    events: sub.events,
    secret,
    message: "Store the secret now — it is only shown once.",
  });
});

webhooksRouter.post("/:id/test", requireRole("admin"), async (req, res) => {
  const sub = await WebhookSubscription.findOne({ _id: req.params.id, deletedAt: null });
  if (!sub) return res.status(404).json({ message: "Webhook not found" });
  await dispatchWebhook("webhook.test", {
    subscriptionId: String(sub._id),
    name: sub.name,
  });
  const fresh = await WebhookSubscription.findById(sub._id).lean();
  return res.json({
    message: "Test event dispatched",
    lastStatus: fresh?.lastStatus,
    lastDeliveryAt: fresh?.lastDeliveryAt,
  });
});

webhooksRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  const sub = await WebhookSubscription.findOne({ _id: req.params.id, deletedAt: null });
  if (!sub) return res.status(404).json({ message: "Webhook not found" });
  sub.deletedAt = new Date();
  sub.active = false;
  await sub.save();
  return res.json({ message: "Webhook deleted" });
});
