import { Router } from "express";
import { z } from "zod";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { requireAuth } from "../middleware/auth.js";
import { escapeRegex, parseDateRange, parsePagination } from "../utils/parseQuery.js";

const doctorSchema = z.object({
  name: z.string().min(2).max(120),
  specialization: z.string().min(2).max(120),
  hospital: z.string().min(2).max(160),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
});

const patientUnderDoctorSchema = z.object({
  name: z.string().min(2).max(120),
  age: z.number().int().min(0).max(130),
  gender: z.enum(["male", "female", "other"]),
  condition: z.string().min(2).max(160),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
  notes: z.string().max(500).optional(),
});

export const doctorsRouter = Router();
doctorsRouter.use(requireAuth);

doctorsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const dateFilter = parseDateRange(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { ...dateFilter };

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const specialization =
    typeof req.query.specialization === "string" ? req.query.specialization.trim() : "";
  const hospital = typeof req.query.hospital === "string" ? req.query.hospital.trim() : "";

  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { specialization: rx }, { hospital: rx }, { email: rx }, { phone: rx }];
  }
  if (specialization) filter.specialization = new RegExp(`^${escapeRegex(specialization)}$`, "i");
  if (hospital) filter.hospital = new RegExp(escapeRegex(hospital), "i");

  const [items, total] = await Promise.all([
    Doctor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Doctor.countDocuments(filter),
  ]);

  const doctorIds = items.map((d) => d._id);
  const counts = await Patient.aggregate<{ _id: unknown; count: number }>([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: "$doctor", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return res.json({
    items: items.map((doctor) => ({
      ...doctor,
      id: doctor._id,
      patientCount: countMap.get(String(doctor._id)) || 0,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

doctorsRouter.get("/meta/filters", async (_req, res) => {
  const [specializations, hospitals] = await Promise.all([
    Doctor.distinct("specialization"),
    Doctor.distinct("hospital"),
  ]);
  return res.json({
    specializations: specializations.sort(),
    hospitals: hospitals.sort(),
  });
});

doctorsRouter.get("/:id", async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).lean();
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const patients = await Patient.find({ doctor: doctor._id }).sort({ createdAt: -1 }).lean();
  return res.json({
    ...doctor,
    id: doctor._id,
    patients: patients.map((p) => ({ ...p, id: p._id })),
  });
});

doctorsRouter.post("/", async (req, res) => {
  const parsed = doctorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const doctor = await Doctor.create(parsed.data);
    return res.status(201).json({ ...doctor.toObject(), id: doctor._id, patientCount: 0 });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 11000) {
      return res.status(409).json({ message: "A doctor with this email already exists" });
    }
    throw error;
  }
});

doctorsRouter.put("/:id", async (req, res) => {
  const parsed = doctorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    const patientCount = await Patient.countDocuments({ doctor: doctor._id });
    return res.json({ ...doctor, id: doctor._id, patientCount });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 11000) {
      return res.status(409).json({ message: "A doctor with this email already exists" });
    }
    throw error;
  }
});

doctorsRouter.delete("/:id", async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  await Patient.deleteMany({ doctor: doctor._id });
  await doctor.deleteOne();
  return res.json({ message: "Doctor and related patients deleted" });
});

doctorsRouter.get("/:id/patients", async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).lean();
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { doctor: doctor._id };
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { condition: rx }, { email: rx }, { phone: rx }];
  }

  const [items, total] = await Promise.all([
    Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);

  return res.json({
    doctor: { ...doctor, id: doctor._id },
    items: items.map((p) => ({ ...p, id: p._id })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

doctorsRouter.post("/:id/patients", async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const parsed = patientUnderDoctorSchema.safeParse({
    ...req.body,
    age: Number(req.body?.age),
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const patient = await Patient.create({ ...parsed.data, doctor: doctor._id });
  return res.status(201).json({ ...patient.toObject(), id: patient._id });
});

doctorsRouter.delete("/:id/patients/:patientId", async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.patientId, doctor: req.params.id });
  if (!patient) {
    return res.status(404).json({ message: "Patient not found for this doctor" });
  }

  await patient.deleteOne();
  return res.json({ message: "Patient removed from doctor list" });
});
