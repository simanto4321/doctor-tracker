import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { TeleSession } from "../models/TeleSession.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

export const telemedicineRouter = Router();
telemedicineRouter.use(requireAuth);

function demoJoinUrl(id: string) {
  const base = process.env.TELE_JOIN_BASE || "https://meet.doctortracker.local/session";
  return `${base}/${id}?token=${crypto.randomBytes(8).toString("hex")}`;
}

telemedicineRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const filter: Record<string, unknown> = { deletedAt: null };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    TeleSession.find(filter)
      .populate("patient", "name condition")
      .populate("doctor", "name specialization")
      .sort({ scheduledAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TeleSession.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((s) => ({ ...s, id: s._id })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

telemedicineRouter.post("/", requireRole("admin", "receptionist", "doctor"), async (req, res) => {
  const schema = z.object({
    patient: z.string().min(1),
    doctor: z.string().min(1),
    scheduledAt: z.string().min(1),
    durationMinutes: z.number().int().min(5).max(180).optional(),
    reason: z.string().max(240).optional(),
    notes: z.string().max(500).optional(),
    joinUrl: z.string().url().optional(),
  });
  const parsed = schema.safeParse({
    ...req.body,
    durationMinutes:
      req.body?.durationMinutes != null ? Number(req.body.durationMinutes) : undefined,
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const [patient, doctor] = await Promise.all([
    Patient.findOne({ _id: parsed.data.patient, deletedAt: null }),
    Doctor.findOne({ _id: parsed.data.doctor, deletedAt: null }),
  ]);
  if (!patient || !doctor) {
    return res.status(400).json({ message: "Patient or doctor not found" });
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ message: "Invalid scheduledAt" });
  }

  const session = await TeleSession.create({
    patient: patient._id,
    doctor: doctor._id,
    scheduledAt,
    durationMinutes: parsed.data.durationMinutes || 30,
    reason: parsed.data.reason || "",
    notes: parsed.data.notes || "",
    joinUrl: parsed.data.joinUrl || "pending",
    createdBy: req.auth!.userId,
    status: "scheduled",
  });
  if (!parsed.data.joinUrl) {
    session.joinUrl = demoJoinUrl(String(session._id));
    await session.save();
  }

  await writeAudit(req.auth, "create", "tele_session", session._id.toString());
  const populated = await TeleSession.findById(session._id)
    .populate("patient", "name condition")
    .populate("doctor", "name specialization")
    .lean();

  return res.status(201).json({ ...populated, id: session._id });
});

telemedicineRouter.patch("/:id/status", requireRole("admin", "receptionist", "doctor"), async (req, res) => {
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  const allowed = ["scheduled", "in_progress", "completed", "cancelled", "no_show"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const session = await TeleSession.findOne({ _id: req.params.id, deletedAt: null });
  if (!session) return res.status(404).json({ message: "Session not found" });
  session.status = status as typeof session.status;
  await session.save();
  await writeAudit(req.auth, "update", "tele_session", session._id.toString(), { status });
  return res.json({ id: session._id, status: session.status, joinUrl: session.joinUrl });
});
