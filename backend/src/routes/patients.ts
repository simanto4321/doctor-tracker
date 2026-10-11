import { Router } from "express";
import { z } from "zod";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { requireAuth } from "../middleware/auth.js";
import { escapeRegex, parseDateRange, parsePagination } from "../utils/parseQuery.js";

const patientSchema = z.object({
  name: z.string().min(2).max(120),
  age: z.number().int().min(0).max(130),
  gender: z.enum(["male", "female", "other"]),
  condition: z.string().min(2).max(160),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
  doctor: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const patientsRouter = Router();
patientsRouter.use(requireAuth);

patientsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const dateFilter = parseDateRange(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { ...dateFilter };

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const condition = typeof req.query.condition === "string" ? req.query.condition.trim() : "";
  const gender = typeof req.query.gender === "string" ? req.query.gender.trim() : "";
  const doctorId = typeof req.query.doctor === "string" ? req.query.doctor.trim() : "";

  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { condition: rx }, { email: rx }, { phone: rx }];
  }
  if (condition) filter.condition = new RegExp(escapeRegex(condition), "i");
  if (gender) filter.gender = gender;
  if (doctorId) filter.doctor = doctorId;

  const [items, total] = await Promise.all([
    Patient.find(filter)
      .populate("doctor", "name specialization hospital")
      .sort({ createdAt: -1 })
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

patientsRouter.get("/meta/filters", async (_req, res) => {
  const [conditions, doctors] = await Promise.all([
    Patient.distinct("condition"),
    Doctor.find().select("name specialization").sort({ name: 1 }).lean(),
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
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  return res.json({ ...patient, id: patient._id });
});

patientsRouter.post("/", async (req, res) => {
  const parsed = patientSchema.safeParse({
    ...req.body,
    age: Number(req.body?.age),
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const doctor = await Doctor.findById(parsed.data.doctor);
  if (!doctor) {
    return res.status(400).json({ message: "Assigned doctor does not exist" });
  }

  const patient = await Patient.create(parsed.data);
  const populated = await Patient.findById(patient._id)
    .populate("doctor", "name specialization hospital")
    .lean();

  return res.status(201).json({ ...populated, id: patient._id });
});

patientsRouter.put("/:id", async (req, res) => {
  const parsed = patientSchema.safeParse({
    ...req.body,
    age: Number(req.body?.age),
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const doctor = await Doctor.findById(parsed.data.doctor);
  if (!doctor) {
    return res.status(400).json({ message: "Assigned doctor does not exist" });
  }

  const patient = await Patient.findByIdAndUpdate(req.params.id, parsed.data, {
    new: true,
    runValidators: true,
  })
    .populate("doctor", "name specialization hospital")
    .lean();

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  return res.json({ ...patient, id: patient._id });
});

patientsRouter.delete("/:id", async (req, res) => {
  const patient = await Patient.findByIdAndDelete(req.params.id);
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }
  return res.json({ message: "Patient deleted" });
});
