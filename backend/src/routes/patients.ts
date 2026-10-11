import { Router } from "express";
import { z } from "zod";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Visit } from "../models/Visit.js";
import { Prescription } from "../models/Prescription.js";
import { Appointment } from "../models/Appointment.js";
import { LabResult } from "../models/LabResult.js";
import { Vital } from "../models/Vital.js";
import { ConditionEvent } from "../models/ConditionEvent.js";
import { DocumentFile } from "../models/DocumentFile.js";
import { Referral } from "../models/Referral.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { escapeRegex, parseDateRange, parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";
import { toCsv } from "../utils/csv.js";

const patientSchema = z.object({
  name: z.string().min(2).max(120),
  age: z.number().int().min(0).max(130),
  gender: z.enum(["male", "female", "other"]),
  condition: z.string().min(2).max(160),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
  doctor: z.string().min(1),
  notes: z.string().max(500).optional(),
  riskFlag: z.enum(["none", "low", "medium", "high"]).optional(),
});

export const patientsRouter = Router();
patientsRouter.use(requireAuth);

patientsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const dateFilter = parseDateRange(req.query as Record<string, unknown>);
  const includeDeleted = req.query.includeDeleted === "true" && req.auth?.role === "admin";
  const trashedOnly = includeDeleted && req.query.trashed === "true";
  const filter: Record<string, unknown> = { ...dateFilter };
  if (trashedOnly) {
    filter.deletedAt = { $ne: null };
  } else if (!includeDeleted) {
    filter.deletedAt = null;
  }

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const condition = typeof req.query.condition === "string" ? req.query.condition.trim() : "";
  const gender = typeof req.query.gender === "string" ? req.query.gender.trim() : "";
  const doctorId = typeof req.query.doctor === "string" ? req.query.doctor.trim() : "";
  const riskFlag = typeof req.query.riskFlag === "string" ? req.query.riskFlag.trim() : "";
  const sortField = typeof req.query.sort === "string" ? req.query.sort : "createdAt";
  const sortDir = req.query.dir === "asc" ? 1 : -1;
  const allowedSort = new Set(["createdAt", "name", "age", "condition"]);
  const sort: Record<string, 1 | -1> = {
    [allowedSort.has(sortField) ? sortField : "createdAt"]: sortDir,
  };

  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { condition: rx }, { email: rx }, { phone: rx }];
  }
  if (condition) filter.condition = new RegExp(escapeRegex(condition), "i");
  if (gender) filter.gender = gender;
  if (doctorId) filter.doctor = doctorId;
  if (riskFlag) filter.riskFlag = riskFlag;

  const [items, total] = await Promise.all([
    Patient.find(filter)
      .populate("doctor", "name specialization hospital")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((patient) => ({
      ...patient,
      id: patient._id,
      doctorId:
        patient.doctor && typeof patient.doctor === "object" && "_id" in patient.doctor
          ? String((patient.doctor as { _id: unknown })._id)
          : String(patient.doctor),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

patientsRouter.get("/export.csv", async (_req, res) => {
  const patients = await Patient.find({ deletedAt: null })
    .populate("doctor", "name")
    .sort({ name: 1 })
    .lean();
  const csv = toCsv(
    patients.map((p) => ({
      name: p.name,
      age: p.age,
      gender: p.gender,
      condition: p.condition,
      riskFlag: p.riskFlag || "none",
      phone: p.phone,
      email: p.email,
      doctor:
        p.doctor && typeof p.doctor === "object" && "name" in p.doctor
          ? (p.doctor as { name: string }).name
          : "",
      createdAt: p.createdAt,
    }))
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="patients.csv"');
  return res.send(csv);
});

patientsRouter.get("/meta/filters", async (_req, res) => {
  const [conditions, doctors] = await Promise.all([
    Patient.distinct("condition", { deletedAt: null }),
    Doctor.find({ deletedAt: null }).select("name specialization").sort({ name: 1 }).lean(),
  ]);

  return res.json({
    conditions: conditions.sort(),
    doctors: doctors.map((d) => ({ id: d._id, name: d.name, specialization: d.specialization })),
  });
});

patientsRouter.get("/:id", async (req, res) => {
  const patient = await Patient.findById(req.params.id)
    .populate("doctor", "name specialization hospital email phone")
    .lean();
  if (!patient || (patient.deletedAt && req.auth?.role !== "admin")) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const [visits, prescriptions, appointments, labs, vitals, conditionHistory, documents, referrals] =
    await Promise.all([
      Visit.find({ patient: patient._id, deletedAt: null })
        .populate("doctor", "name")
        .sort({ visitedAt: -1 })
        .limit(20)
        .lean(),
      Prescription.find({ patient: patient._id, deletedAt: null })
        .populate("doctor", "name")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Appointment.find({ patient: patient._id, deletedAt: null })
        .populate("doctor", "name")
        .sort({ startsAt: -1 })
        .limit(20)
        .lean(),
      LabResult.find({ patient: patient._id, deletedAt: null })
        .populate("doctor", "name")
        .sort({ collectedAt: -1 })
        .limit(20)
        .lean(),
      Vital.find({ patient: patient._id, deletedAt: null }).sort({ recordedAt: -1 }).limit(20).lean(),
      ConditionEvent.find({ patient: patient._id, deletedAt: null })
        .sort({ recordedAt: -1 })
        .limit(20)
        .lean(),
      DocumentFile.find({ patient: patient._id, deletedAt: null })
        .select("-content")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Referral.find({ patient: patient._id, deletedAt: null })
        .populate("fromDoctor", "name")
        .populate("toDoctor", "name")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

  const notesTimeline = [
    ...visits.map((v) => ({
      id: String(v._id),
      type: "visit" as const,
      at: v.visitedAt,
      title: v.diagnosis,
      detail: v.notes || v.treatment || "",
    })),
    ...conditionHistory.map((c) => ({
      id: String(c._id),
      type: "condition" as const,
      at: c.recordedAt,
      title: `${c.condition} · ${c.status}`,
      detail: c.note || "",
    })),
    ...labs.map((l) => ({
      id: String(l._id),
      type: "lab" as const,
      at: l.collectedAt,
      title: `${l.testName}: ${l.value}${l.unit}`,
      detail: l.abnormal ? "Abnormal flag" : "Within reference range",
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return res.json({
    ...patient,
    id: patient._id,
    visits: visits.map((v) => ({ ...v, id: v._id })),
    prescriptions: prescriptions.map((p) => ({ ...p, id: p._id })),
    appointments: appointments.map((a) => ({ ...a, id: a._id })),
    labs: labs.map((l) => ({ ...l, id: l._id })),
    vitals: vitals.map((v) => ({ ...v, id: v._id })),
    conditionHistory: conditionHistory.map((c) => ({ ...c, id: c._id })),
    documents: documents.map((d) => ({ ...d, id: d._id })),
    referrals: referrals.map((r) => ({ ...r, id: r._id })),
    notesTimeline,
  });
});

patientsRouter.post("/", requireRole("admin", "receptionist"), async (req, res) => {
  const parsed = patientSchema.safeParse({
    ...req.body,
    age: Number(req.body?.age),
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const doctor = await Doctor.findOne({ _id: parsed.data.doctor, deletedAt: null });
  if (!doctor) {
    return res.status(400).json({ message: "Assigned doctor does not exist" });
  }

  const patient = await Patient.create(parsed.data);
  await writeAudit(req.auth, "create", "patient", patient._id.toString());
  const populated = await Patient.findById(patient._id)
    .populate("doctor", "name specialization hospital")
    .lean();

  return res.status(201).json({ ...populated, id: patient._id });
});

patientsRouter.put("/:id", requireRole("admin", "receptionist"), async (req, res) => {
  const parsed = patientSchema.safeParse({
    ...req.body,
    age: Number(req.body?.age),
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const doctor = await Doctor.findOne({ _id: parsed.data.doctor, deletedAt: null });
  if (!doctor) {
    return res.status(400).json({ message: "Assigned doctor does not exist" });
  }

  const patient = await Patient.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    parsed.data,
    { new: true, runValidators: true }
  )
    .populate("doctor", "name specialization hospital")
    .lean();

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  await writeAudit(req.auth, "update", "patient", String(patient._id));
  return res.json({ ...patient, id: patient._id });
});

patientsRouter.delete("/:id", requireRole("admin", "receptionist"), async (req, res) => {
  const hard = req.query.hard === "true" && req.auth?.role === "admin";
  const patient = await Patient.findById(req.params.id);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  if (hard) {
    await patient.deleteOne();
    await writeAudit(req.auth, "hard_delete", "patient", patient._id.toString());
    return res.json({ message: "Patient permanently deleted" });
  }

  patient.deletedAt = new Date();
  await patient.save();
  await writeAudit(req.auth, "soft_delete", "patient", patient._id.toString());
  return res.json({ message: "Patient moved to trash" });
});

patientsRouter.post("/:id/restore", requireRole("admin"), async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  patient.deletedAt = null;
  await patient.save();
  await writeAudit(req.auth, "restore", "patient", patient._id.toString());
  return res.json({ ...patient.toObject(), id: patient._id });
});
