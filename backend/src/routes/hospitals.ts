import { Router } from "express";
import { z } from "zod";
import { Hospital } from "../models/Hospital.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { writeAudit } from "../utils/audit.js";

const hospitalSchema = z.object({
  name: z.string().min(2).max(160),
  city: z.string().min(2).max(120),
  address: z.string().max(240).optional(),
  phone: z.string().max(40).optional(),
  departments: z.array(z.string()).optional(),
  bedCount: z.number().int().min(0).optional(),
});

export const hospitalsRouter = Router();
hospitalsRouter.use(requireAuth);

hospitalsRouter.get("/", async (_req, res) => {
  const hospitals = await Hospital.find({ deletedAt: null }).sort({ name: 1 }).lean();
  const withCounts = await Promise.all(
    hospitals.map(async (hospital) => {
      const doctorCount = await Doctor.countDocuments({
        hospital: hospital.name,
        deletedAt: null,
      });
      const doctorIds = await Doctor.find({ hospital: hospital.name, deletedAt: null }).distinct("_id");
      const patientCount = await Patient.countDocuments({
        doctor: { $in: doctorIds },
        deletedAt: null,
      });
      return {
        ...hospital,
        id: hospital._id,
        doctorCount,
        patientCount,
      };
    })
  );
  return res.json({ items: withCounts });
});

hospitalsRouter.get("/:id", async (req, res) => {
  const hospital = await Hospital.findOne({ _id: req.params.id, deletedAt: null }).lean();
  if (!hospital) return res.status(404).json({ message: "Hospital not found" });
  const doctors = await Doctor.find({ hospital: hospital.name, deletedAt: null })
    .select("name specialization department workingHours email phone")
    .sort({ name: 1 })
    .lean();
  return res.json({
    ...hospital,
    id: hospital._id,
    doctors: doctors.map((d) => ({ ...d, id: d._id })),
  });
});

hospitalsRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = hospitalSchema.safeParse({
    ...req.body,
    bedCount: req.body?.bedCount != null ? Number(req.body.bedCount) : 0,
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  try {
    const hospital = await Hospital.create(parsed.data);
    await writeAudit(req.auth, "create", "hospital", hospital._id.toString());
    return res.status(201).json({ ...hospital.toObject(), id: hospital._id });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 11000) {
      return res.status(409).json({ message: "Hospital already exists" });
    }
    throw error;
  }
});
