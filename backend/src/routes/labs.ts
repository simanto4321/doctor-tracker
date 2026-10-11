import { Router } from "express";
import { z } from "zod";
import { LabResult } from "../models/LabResult.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

const labSchema = z.object({
  patient: z.string().min(1),
  doctor: z.string().min(1),
  testName: z.string().min(2).max(120),
  value: z.number(),
  unit: z.string().min(1).max(40),
  refLow: z.number(),
  refHigh: z.number(),
  collectedAt: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const labsRouter = Router();
labsRouter.use(requireAuth);

labsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof req.query.patient === "string" && req.query.patient) filter.patient = req.query.patient;
  if (req.query.abnormal === "true") filter.abnormal = true;

  const [items, total] = await Promise.all([
    LabResult.find(filter)
      .populate("patient", "name")
      .populate("doctor", "name")
      .sort({ collectedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LabResult.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

labsRouter.get("/trends/:patientId", async (req, res) => {
  const testName = typeof req.query.testName === "string" ? req.query.testName : "";
  const filter: Record<string, unknown> = {
    patient: req.params.patientId,
    deletedAt: null,
  };
  if (testName) filter.testName = testName;

  const items = await LabResult.find(filter).sort({ collectedAt: 1 }).limit(40).lean();
  return res.json({
    items: items.map((item) => ({
      id: item._id,
      testName: item.testName,
      value: item.value,
      unit: item.unit,
      abnormal: item.abnormal,
      collectedAt: item.collectedAt,
      refLow: item.refLow,
      refHigh: item.refHigh,
    })),
  });
});

labsRouter.post("/", requireRole("admin", "doctor", "receptionist"), async (req, res) => {
  const parsed = labSchema.safeParse({
    ...req.body,
    value: Number(req.body?.value),
    refLow: Number(req.body?.refLow),
    refHigh: Number(req.body?.refHigh),
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const [doctor, patient] = await Promise.all([
    Doctor.findOne({ _id: parsed.data.doctor, deletedAt: null }),
    Patient.findOne({ _id: parsed.data.patient, deletedAt: null }),
  ]);
  if (!doctor || !patient) return res.status(400).json({ message: "Doctor or patient not found" });

  const abnormal = parsed.data.value < parsed.data.refLow || parsed.data.value > parsed.data.refHigh;
  const lab = await LabResult.create({
    ...parsed.data,
    collectedAt: new Date(parsed.data.collectedAt),
    abnormal,
  });
  await writeAudit(req.auth, "create", "lab", lab._id.toString());
  return res.status(201).json({ ...lab.toObject(), id: lab._id });
});

labsRouter.delete("/:id", requireRole("admin", "doctor"), async (req, res) => {
  const lab = await LabResult.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );
  if (!lab) return res.status(404).json({ message: "Lab result not found" });
  await writeAudit(req.auth, "soft_delete", "lab", lab._id.toString());
  return res.json({ message: "Lab result archived" });
});
