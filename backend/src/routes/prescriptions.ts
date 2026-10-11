import { Router } from "express";
import { z } from "zod";
import { Prescription } from "../models/Prescription.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

const prescriptionSchema = z.object({
  doctor: z.string().min(1),
  patient: z.string().min(1),
  medication: z.string().min(2).max(160),
  dosage: z.string().min(1).max(120),
  frequency: z.string().min(1).max(120),
  status: z.enum(["active", "completed", "refill_due", "cancelled"]).optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional(),
});

export const prescriptionsRouter = Router();
prescriptionsRouter.use(requireAuth);

prescriptionsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof req.query.patient === "string" && req.query.patient) filter.patient = req.query.patient;
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Prescription.find(filter)
      .populate("doctor", "name")
      .populate("patient", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Prescription.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

prescriptionsRouter.post("/", requireRole("admin", "doctor"), async (req, res) => {
  const parsed = prescriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const [doctor, patient] = await Promise.all([
    Doctor.findOne({ _id: parsed.data.doctor, deletedAt: null }),
    Patient.findOne({ _id: parsed.data.patient, deletedAt: null }),
  ]);
  if (!doctor || !patient) return res.status(400).json({ message: "Doctor or patient not found" });

  const prescription = await Prescription.create({
    ...parsed.data,
    startDate: new Date(parsed.data.startDate),
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
  });
  await writeAudit(req.auth, "create", "prescription", prescription._id.toString());
  return res.status(201).json({ ...prescription.toObject(), id: prescription._id });
});

prescriptionsRouter.put("/:id", requireRole("admin", "doctor"), async (req, res) => {
  const parsed = prescriptionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startDate) update.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate !== undefined) {
    update.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  }

  const prescription = await Prescription.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    update,
    { new: true }
  ).lean();
  if (!prescription) return res.status(404).json({ message: "Prescription not found" });
  await writeAudit(req.auth, "update", "prescription", String(prescription._id));
  return res.json({ ...prescription, id: prescription._id });
});

prescriptionsRouter.delete("/:id", requireRole("admin", "doctor"), async (req, res) => {
  const prescription = await Prescription.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { deletedAt: new Date(), status: "cancelled" },
    { new: true }
  );
  if (!prescription) return res.status(404).json({ message: "Prescription not found" });
  await writeAudit(req.auth, "soft_delete", "prescription", prescription._id.toString());
  return res.json({ message: "Prescription cancelled" });
});
