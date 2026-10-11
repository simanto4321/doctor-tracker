import { Router } from "express";
import { z } from "zod";
import { Visit } from "../models/Visit.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Notification } from "../models/Notification.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

const visitSchema = z.object({
  doctor: z.string().min(1),
  patient: z.string().min(1),
  visitedAt: z.string().min(1),
  diagnosis: z.string().min(2).max(240),
  treatment: z.string().max(500).optional(),
  followUpAt: z.string().optional().nullable(),
  notes: z.string().max(800).optional(),
});

export const visitsRouter = Router();
visitsRouter.use(requireAuth);

visitsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof req.query.patient === "string" && req.query.patient) filter.patient = req.query.patient;
  if (typeof req.query.doctor === "string" && req.query.doctor) filter.doctor = req.query.doctor;

  const [items, total] = await Promise.all([
    Visit.find(filter)
      .populate("doctor", "name")
      .populate("patient", "name")
      .sort({ visitedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Visit.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

visitsRouter.post("/", requireRole("admin", "receptionist", "doctor"), async (req, res) => {
  const parsed = visitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const [doctor, patient] = await Promise.all([
    Doctor.findOne({ _id: parsed.data.doctor, deletedAt: null }),
    Patient.findOne({ _id: parsed.data.patient, deletedAt: null }),
  ]);
  if (!doctor || !patient) return res.status(400).json({ message: "Doctor or patient not found" });

  const visit = await Visit.create({
    ...parsed.data,
    visitedAt: new Date(parsed.data.visitedAt),
    followUpAt: parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null,
  });

  if (visit.followUpAt) {
    await Notification.create({
      title: "Follow-up scheduled",
      body: `${patient.name} follow-up on ${visit.followUpAt.toLocaleDateString()}`,
      type: "follow_up",
      href: `/patients/${patient._id}`,
    });
  }

  await writeAudit(req.auth, "create", "visit", visit._id.toString());
  return res.status(201).json({ ...visit.toObject(), id: visit._id });
});

visitsRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  const visit = await Visit.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );
  if (!visit) return res.status(404).json({ message: "Visit not found" });
  await writeAudit(req.auth, "soft_delete", "visit", visit._id.toString());
  return res.json({ message: "Visit archived" });
});
