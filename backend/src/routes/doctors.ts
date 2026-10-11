import { Router } from "express";
import { z } from "zod";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Visit } from "../models/Visit.js";
import { Appointment } from "../models/Appointment.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { escapeRegex, parseDateRange, parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";
import { toCsv } from "../utils/csv.js";
import { Notification } from "../models/Notification.js";

const doctorSchema = z.object({
  name: z.string().min(2).max(120),
  specialization: z.string().min(2).max(120),
  hospital: z.string().min(2).max(160),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
  department: z.string().max(120).optional(),
  workingHours: z.string().max(120).optional(),
  bio: z.string().max(800).optional(),
});

const patientUnderDoctorSchema = z.object({
  name: z.string().min(2).max(120),
  age: z.number().int().min(0).max(130),
  gender: z.enum(["male", "female", "other"]),
  condition: z.string().min(2).max(160),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
  notes: z.string().max(500).optional(),
  riskFlag: z.enum(["none", "low", "medium", "high"]).optional(),
});

export const doctorsRouter = Router();
doctorsRouter.use(requireAuth);

function activeDoctorFilter(includeDeleted = false) {
  return includeDeleted ? {} : { deletedAt: null };
}

doctorsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const dateFilter = parseDateRange(req.query as Record<string, unknown>);
  const includeDeleted = req.query.includeDeleted === "true" && req.auth?.role === "admin";
  const filter: Record<string, unknown> = { ...dateFilter, ...activeDoctorFilter(includeDeleted) };
  if (includeDeleted && req.query.trashed === "true") filter.deletedAt = { $ne: null };

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const specialization =
    typeof req.query.specialization === "string" ? req.query.specialization.trim() : "";
  const hospital = typeof req.query.hospital === "string" ? req.query.hospital.trim() : "";
  const sortField = typeof req.query.sort === "string" ? req.query.sort : "createdAt";
  const sortDir = req.query.dir === "asc" ? 1 : -1;
  const allowedSort = new Set(["createdAt", "name", "specialization", "hospital", "patientCount"]);
  const sortKey = allowedSort.has(sortField) ? sortField : "createdAt";

  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { specialization: rx }, { hospital: rx }, { email: rx }, { phone: rx }];
  }
  if (specialization) filter.specialization = new RegExp(`^${escapeRegex(specialization)}$`, "i");
  if (hospital) filter.hospital = new RegExp(escapeRegex(hospital), "i");

  const total = await Doctor.countDocuments(filter);

  if (sortKey === "patientCount") {
    const aggregated = await Doctor.aggregate<{
      _id: unknown;
      name: string;
      specialization: string;
      hospital: string;
      phone: string;
      email: string;
      department?: string;
      workingHours?: string;
      bio?: string;
      createdAt?: Date;
      patientCount: number;
    }>([
      { $match: filter },
      {
        $lookup: {
          from: "patients",
          let: { doctorId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$doctor", "$$doctorId"] },
                deletedAt: null,
              },
            },
            { $count: "count" },
          ],
          as: "patientStats",
        },
      },
      {
        $addFields: {
          patientCount: {
            $ifNull: [{ $arrayElemAt: ["$patientStats.count", 0] }, 0],
          },
        },
      },
      { $sort: { patientCount: sortDir, name: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    return res.json({
      items: aggregated.map((doctor) => ({
        ...doctor,
        id: doctor._id,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }

  const sort: Record<string, 1 | -1> = { [sortKey]: sortDir };
  const items = await Doctor.find(filter).sort(sort).skip(skip).limit(limit).lean();
  const doctorIds = items.map((d) => d._id);
  const counts = await Patient.aggregate<{ _id: unknown; count: number }>([
    { $match: { doctor: { $in: doctorIds }, deletedAt: null } },
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

doctorsRouter.get("/export.csv", async (req, res) => {
  const doctors = await Doctor.find({ deletedAt: null }).sort({ name: 1 }).lean();
  const csv = toCsv(
    doctors.map((d) => ({
      name: d.name,
      specialization: d.specialization,
      hospital: d.hospital,
      department: d.department || "",
      phone: d.phone,
      email: d.email,
      workingHours: d.workingHours || "",
      createdAt: d.createdAt,
    }))
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="doctors.csv"');
  return res.send(csv);
});

doctorsRouter.get("/meta/filters", async (_req, res) => {
  const [specializations, hospitals, departments] = await Promise.all([
    Doctor.distinct("specialization", { deletedAt: null }),
    Doctor.distinct("hospital", { deletedAt: null }),
    Doctor.distinct("department", { deletedAt: null }),
  ]);
  return res.json({
    specializations: specializations.sort(),
    hospitals: hospitals.sort(),
    departments: departments.filter(Boolean).sort(),
  });
});

doctorsRouter.get("/:id", async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).lean();
  if (!doctor || (doctor.deletedAt && req.auth?.role !== "admin")) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const [patients, visits, appointments, caseload] = await Promise.all([
    Patient.find({ doctor: doctor._id, deletedAt: null }).sort({ createdAt: -1 }).limit(20).lean(),
    Visit.find({ doctor: doctor._id, deletedAt: null })
      .populate("patient", "name")
      .sort({ visitedAt: -1 })
      .limit(10)
      .lean(),
    Appointment.find({ doctor: doctor._id, deletedAt: null, startsAt: { $gte: new Date() } })
      .populate("patient", "name")
      .sort({ startsAt: 1 })
      .limit(10)
      .lean(),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { doctor: doctor._id, deletedAt: null } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 8 },
    ]),
  ]);

  return res.json({
    ...doctor,
    id: doctor._id,
    patients: patients.map((p) => ({ ...p, id: p._id })),
    visits: visits.map((v) => ({ ...v, id: v._id })),
    upcomingAppointments: appointments.map((a) => ({ ...a, id: a._id })),
    patientCount: patients.length,
    caseloadTrend: caseload.map((row) => ({ month: row._id, patients: row.count })),
  });
});

doctorsRouter.post("/", requireRole("admin", "receptionist"), async (req, res) => {
  const parsed = doctorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const doctor = await Doctor.create(parsed.data);
    await writeAudit(req.auth, "create", "doctor", doctor._id.toString());
    await Notification.create({
      title: "New doctor added",
      body: `${doctor.name} · ${doctor.specialization}`,
      type: "success",
      href: `/doctors/${doctor._id}`,
    });
    return res.status(201).json({ ...doctor.toObject(), id: doctor._id, patientCount: 0 });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 11000) {
      return res.status(409).json({ message: "A doctor with this email already exists" });
    }
    throw error;
  }
});

doctorsRouter.put("/:id", requireRole("admin", "receptionist"), async (req, res) => {
  const parsed = doctorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const doctor = await Doctor.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      parsed.data,
      { new: true, runValidators: true }
    ).lean();
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    await writeAudit(req.auth, "update", "doctor", String(doctor._id));
    const patientCount = await Patient.countDocuments({ doctor: doctor._id, deletedAt: null });
    return res.json({ ...doctor, id: doctor._id, patientCount });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 11000) {
      return res.status(409).json({ message: "A doctor with this email already exists" });
    }
    throw error;
  }
});

doctorsRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  const hard = req.query.hard === "true";
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  if (hard) {
    await Patient.updateMany({ doctor: doctor._id }, { deletedAt: new Date() });
    await doctor.deleteOne();
    await writeAudit(req.auth, "hard_delete", "doctor", doctor._id.toString());
    return res.json({ message: "Doctor permanently deleted" });
  }

  doctor.deletedAt = new Date();
  await doctor.save();
  await Patient.updateMany({ doctor: doctor._id, deletedAt: null }, { deletedAt: new Date() });
  await writeAudit(req.auth, "soft_delete", "doctor", doctor._id.toString());
  return res.json({ message: "Doctor moved to trash" });
});

doctorsRouter.post("/:id/restore", requireRole("admin"), async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) return res.status(404).json({ message: "Doctor not found" });
  doctor.deletedAt = null;
  await doctor.save();
  await writeAudit(req.auth, "restore", "doctor", doctor._id.toString());
  return res.json({ ...doctor.toObject(), id: doctor._id });
});

doctorsRouter.get("/:id/patients", async (req, res) => {
  const doctor = await Doctor.findOne({ _id: req.params.id, deletedAt: null }).lean();
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { doctor: doctor._id, deletedAt: null };
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

doctorsRouter.post("/:id/patients", requireRole("admin", "receptionist"), async (req, res) => {
  const doctor = await Doctor.findOne({ _id: req.params.id, deletedAt: null });
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
  await writeAudit(req.auth, "create", "patient", patient._id.toString(), { doctorId: doctor._id });
  await Notification.create({
    title: "Patient assigned",
    body: `${patient.name} assigned to ${doctor.name}`,
    type: "info",
    href: `/patients/${patient._id}`,
  });
  return res.status(201).json({ ...patient.toObject(), id: patient._id });
});

doctorsRouter.delete("/:id/patients/:patientId", requireRole("admin", "receptionist"), async (req, res) => {
  const patient = await Patient.findOne({
    _id: req.params.patientId,
    doctor: req.params.id,
    deletedAt: null,
  });
  if (!patient) {
    return res.status(404).json({ message: "Patient not found for this doctor" });
  }

  patient.deletedAt = new Date();
  await patient.save();
  await writeAudit(req.auth, "soft_delete", "patient", patient._id.toString());
  return res.json({ message: "Patient removed from doctor list" });
});
