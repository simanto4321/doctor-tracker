import { Router } from "express";
import { z } from "zod";
import { Referral } from "../models/Referral.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Notification } from "../models/Notification.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

const referralSchema = z.object({
  patient: z.string().min(1),
  fromDoctor: z.string().min(1),
  toDoctor: z.string().min(1),
  reason: z.string().min(3).max(300),
  priority: z.enum(["routine", "urgent", "stat"]).optional(),
  status: z.enum(["pending", "accepted", "completed", "declined"]).optional(),
  notes: z.string().max(500).optional(),
});

export const referralsRouter = Router();
referralsRouter.use(requireAuth);

referralsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Referral.find(filter)
      .populate("patient", "name condition")
      .populate("fromDoctor", "name specialization")
      .populate("toDoctor", "name specialization")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Referral.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

referralsRouter.post("/", requireRole("admin", "doctor", "receptionist"), async (req, res) => {
  const parsed = referralSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  if (parsed.data.fromDoctor === parsed.data.toDoctor) {
    return res.status(400).json({ message: "From and to doctor must be different" });
  }

  const [patient, fromDoctor, toDoctor] = await Promise.all([
    Patient.findOne({ _id: parsed.data.patient, deletedAt: null }),
    Doctor.findOne({ _id: parsed.data.fromDoctor, deletedAt: null }),
    Doctor.findOne({ _id: parsed.data.toDoctor, deletedAt: null }),
  ]);
  if (!patient || !fromDoctor || !toDoctor) {
    return res.status(400).json({ message: "Patient or doctors not found" });
  }

  const referral = await Referral.create(parsed.data);
  await Notification.create({
    title: "New referral",
    body: `${patient.name}: ${fromDoctor.name} → ${toDoctor.name}`,
    type: "info",
    href: "/referrals",
  });
  await writeAudit(req.auth, "create", "referral", referral._id.toString());

  const populated = await Referral.findById(referral._id)
    .populate("patient", "name condition")
    .populate("fromDoctor", "name specialization")
    .populate("toDoctor", "name specialization")
    .lean();

  return res.status(201).json({ ...populated, id: referral._id });
});

referralsRouter.put("/:id", requireRole("admin", "doctor", "receptionist"), async (req, res) => {
  const parsed = referralSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const referral = await Referral.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    parsed.data,
    { new: true }
  )
    .populate("patient", "name condition")
    .populate("fromDoctor", "name specialization")
    .populate("toDoctor", "name specialization")
    .lean();
  if (!referral) return res.status(404).json({ message: "Referral not found" });
  await writeAudit(req.auth, "update", "referral", String(referral._id));
  return res.json({ ...referral, id: referral._id });
});
