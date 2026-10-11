import { Router } from "express";
import { z } from "zod";
import { Vital } from "../models/Vital.js";
import { Patient } from "../models/Patient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

const vitalSchema = z.object({
  patient: z.string().min(1),
  recordedAt: z.string().min(1),
  heartRate: z.number(),
  bloodPressureSys: z.number(),
  bloodPressureDia: z.number(),
  temperatureC: z.number(),
  spo2: z.number(),
  weightKg: z.number().optional().nullable(),
  notes: z.string().max(300).optional(),
});

export const vitalsRouter = Router();
vitalsRouter.use(requireAuth);

vitalsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof req.query.patient === "string" && req.query.patient) {
    filter.patient = req.query.patient;
  }
  const [items, total] = await Promise.all([
    Vital.find(filter)
      .populate("patient", "name condition")
      .sort({ recordedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Vital.countDocuments(filter),
  ]);
  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

vitalsRouter.get("/patient/:patientId", async (req, res) => {
  const items = await Vital.find({ patient: req.params.patientId, deletedAt: null })
    .sort({ recordedAt: -1 })
    .limit(30)
    .lean();
  return res.json({ items: items.map((item) => ({ ...item, id: item._id })) });
});

vitalsRouter.post("/", requireRole("admin", "doctor", "receptionist"), async (req, res) => {
  const parsed = vitalSchema.safeParse({
    ...req.body,
    heartRate: Number(req.body?.heartRate),
    bloodPressureSys: Number(req.body?.bloodPressureSys),
    bloodPressureDia: Number(req.body?.bloodPressureDia),
    temperatureC: Number(req.body?.temperatureC),
    spo2: Number(req.body?.spo2),
    weightKg: req.body?.weightKg != null && req.body.weightKg !== "" ? Number(req.body.weightKg) : null,
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const patient = await Patient.findOne({ _id: parsed.data.patient, deletedAt: null });
  if (!patient) return res.status(400).json({ message: "Patient not found" });

  const vital = await Vital.create({
    ...parsed.data,
    recordedAt: new Date(parsed.data.recordedAt),
  });
  await writeAudit(req.auth, "create", "vital", vital._id.toString());
  return res.status(201).json({ ...vital.toObject(), id: vital._id });
});
