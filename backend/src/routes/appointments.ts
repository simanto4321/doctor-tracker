import { Router } from "express";
import { z } from "zod";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Notification } from "../models/Notification.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { parsePagination } from "../utils/parseQuery.js";
import { writeAudit } from "../utils/audit.js";

const appointmentSchema = z.object({
  doctor: z.string().min(1),
  patient: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  status: z.enum(["scheduled", "checked_in", "completed", "cancelled", "no_show"]).optional(),
  reason: z.string().max(240).optional(),
  notes: z.string().max(500).optional(),
});

export const appointmentsRouter = Router();
appointmentsRouter.use(requireAuth);

appointmentsRouter.get("/", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof req.query.doctor === "string" && req.query.doctor) filter.doctor = req.query.doctor;
  if (typeof req.query.patient === "string" && req.query.patient) filter.patient = req.query.patient;
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;
  if (typeof req.query.from === "string" && req.query.from) {
    filter.startsAt = { ...(filter.startsAt as object), $gte: new Date(req.query.from) };
  }
  if (typeof req.query.to === "string" && req.query.to) {
    const to = new Date(req.query.to);
    to.setHours(23, 59, 59, 999);
    filter.startsAt = { ...(filter.startsAt as object), $lte: to };
  }

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .populate("doctor", "name specialization")
      .populate("patient", "name condition")
      .sort({ startsAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  return res.json({
    items: items.map((item) => ({ ...item, id: item._id })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

appointmentsRouter.post("/", requireRole("admin", "receptionist"), async (req, res) => {
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const [doctor, patient] = await Promise.all([
    Doctor.findOne({ _id: parsed.data.doctor, deletedAt: null }),
    Patient.findOne({ _id: parsed.data.patient, deletedAt: null }),
  ]);
  if (!doctor || !patient) {
    return res.status(400).json({ message: "Doctor or patient not found" });
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return res.status(400).json({ message: "Invalid appointment time range" });
  }

  const appointment = await Appointment.create({
    ...parsed.data,
    startsAt,
    endsAt,
  });
  await writeAudit(req.auth, "create", "appointment", appointment._id.toString());
  await Notification.create({
    title: "Appointment scheduled",
    body: `${patient.name} with ${doctor.name} on ${startsAt.toLocaleString()}`,
    type: "appointment",
    href: "/appointments",
  });

  const populated = await Appointment.findById(appointment._id)
    .populate("doctor", "name specialization")
    .populate("patient", "name condition")
    .lean();

  return res.status(201).json({ ...populated, id: appointment._id });
});

appointmentsRouter.put("/:id", requireRole("admin", "receptionist"), async (req, res) => {
  const parsed = appointmentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startsAt) update.startsAt = new Date(parsed.data.startsAt);
  if (parsed.data.endsAt) update.endsAt = new Date(parsed.data.endsAt);

  const appointment = await Appointment.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    update,
    { new: true }
  )
    .populate("doctor", "name specialization")
    .populate("patient", "name condition")
    .lean();

  if (!appointment) return res.status(404).json({ message: "Appointment not found" });
  await writeAudit(req.auth, "update", "appointment", String(appointment._id));
  return res.json({ ...appointment, id: appointment._id });
});

appointmentsRouter.delete("/:id", requireRole("admin", "receptionist"), async (req, res) => {
  const appointment = await Appointment.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { deletedAt: new Date(), status: "cancelled" },
    { new: true }
  );
  if (!appointment) return res.status(404).json({ message: "Appointment not found" });
  await writeAudit(req.auth, "soft_delete", "appointment", appointment._id.toString());
  return res.json({ message: "Appointment cancelled" });
});
