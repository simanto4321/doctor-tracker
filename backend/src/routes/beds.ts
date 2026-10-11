import { Router } from "express";
import { z } from "zod";
import { Bed } from "../models/Bed.js";
import { Hospital } from "../models/Hospital.js";
import { Patient } from "../models/Patient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { writeAudit } from "../utils/audit.js";

export const bedsRouter = Router();
bedsRouter.use(requireAuth);

bedsRouter.get("/occupancy", async (_req, res) => {
  const beds = await Bed.find({ deletedAt: null })
    .populate("hospital", "name city")
    .populate("patient", "name condition")
    .lean();

  const byWard = new Map<
    string,
    {
      hospitalId: string;
      hospitalName: string;
      ward: string;
      total: number;
      available: number;
      occupied: number;
      cleaning: number;
      reserved: number;
      beds: unknown[];
    }
  >();

  for (const bed of beds) {
    const hospital =
      bed.hospital && typeof bed.hospital === "object" && "name" in bed.hospital
        ? (bed.hospital as { _id: unknown; name: string })
        : null;
    const hospitalId = hospital ? String(hospital._id) : String(bed.hospital);
    const hospitalName = hospital?.name || "Hospital";
    const key = `${hospitalId}::${bed.ward}`;
    const row =
      byWard.get(key) ||
      {
        hospitalId,
        hospitalName,
        ward: bed.ward,
        total: 0,
        available: 0,
        occupied: 0,
        cleaning: 0,
        reserved: 0,
        beds: [] as unknown[],
      };
    row.total += 1;
    row[bed.status] += 1;
    row.beds.push({
      ...bed,
      id: bed._id,
      hospitalName,
    });
    byWard.set(key, row);
  }

  const wards = Array.from(byWard.values()).sort((a, b) =>
    `${a.hospitalName}${a.ward}`.localeCompare(`${b.hospitalName}${b.ward}`)
  );
  const totals = wards.reduce(
    (acc, w) => {
      acc.total += w.total;
      acc.available += w.available;
      acc.occupied += w.occupied;
      acc.cleaning += w.cleaning;
      acc.reserved += w.reserved;
      return acc;
    },
    { total: 0, available: 0, occupied: 0, cleaning: 0, reserved: 0 }
  );

  return res.json({
    totals: {
      ...totals,
      occupancyRate: totals.total === 0 ? 0 : Math.round((totals.occupied / totals.total) * 1000) / 10,
    },
    wards,
  });
});

bedsRouter.get("/", async (req, res) => {
  const hospital = typeof req.query.hospital === "string" ? req.query.hospital : "";
  const ward = typeof req.query.ward === "string" ? req.query.ward : "";
  const filter: Record<string, unknown> = { deletedAt: null };
  if (hospital) filter.hospital = hospital;
  if (ward) filter.ward = ward;

  const items = await Bed.find(filter)
    .populate("hospital", "name city")
    .populate("patient", "name condition")
    .sort({ ward: 1, bedNumber: 1 })
    .lean();

  return res.json({ items: items.map((b) => ({ ...b, id: b._id })) });
});

bedsRouter.post("/", requireRole("admin", "receptionist"), async (req, res) => {
  const schema = z.object({
    hospital: z.string().min(1),
    ward: z.string().min(1).max(80),
    bedNumber: z.string().min(1).max(40),
    status: z.enum(["available", "occupied", "cleaning", "reserved"]).optional(),
    notes: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const hospital = await Hospital.findOne({ _id: parsed.data.hospital, deletedAt: null });
  if (!hospital) return res.status(400).json({ message: "Hospital not found" });

  try {
    const bed = await Bed.create({
      hospital: hospital._id,
      ward: parsed.data.ward,
      bedNumber: parsed.data.bedNumber,
      status: parsed.data.status || "available",
      notes: parsed.data.notes || "",
    });
    await writeAudit(req.auth, "create", "bed", bed._id.toString());
    return res.status(201).json({ ...bed.toObject(), id: bed._id });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 11000) {
      return res.status(409).json({ message: "Bed already exists in this ward" });
    }
    throw error;
  }
});

bedsRouter.patch("/:id", requireRole("admin", "receptionist"), async (req, res) => {
  const schema = z.object({
    status: z.enum(["available", "occupied", "cleaning", "reserved"]).optional(),
    patient: z.string().nullable().optional(),
    notes: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const bed = await Bed.findOne({ _id: req.params.id, deletedAt: null });
  if (!bed) return res.status(404).json({ message: "Bed not found" });

  if (parsed.data.status) bed.status = parsed.data.status;
  if (parsed.data.notes !== undefined) bed.notes = parsed.data.notes;

  if (parsed.data.patient !== undefined) {
    if (parsed.data.patient === null || parsed.data.patient === "") {
      bed.patient = null;
      bed.admittedAt = null;
      if (bed.status === "occupied") bed.status = "cleaning";
    } else {
      const patient = await Patient.findOne({ _id: parsed.data.patient, deletedAt: null });
      if (!patient) return res.status(400).json({ message: "Patient not found" });
      bed.patient = patient._id;
      bed.admittedAt = new Date();
      bed.status = "occupied";
    }
  }

  await bed.save();
  await writeAudit(req.auth, "update", "bed", bed._id.toString(), {
    status: bed.status,
    patient: bed.patient,
  });

  const populated = await Bed.findById(bed._id)
    .populate("hospital", "name city")
    .populate("patient", "name condition")
    .lean();
  return res.json({ ...populated, id: bed._id });
});
