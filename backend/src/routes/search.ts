import { Router } from "express";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Appointment } from "../models/Appointment.js";
import { requireAuth } from "../middleware/auth.js";
import { escapeRegex } from "../utils/parseQuery.js";

export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json({ doctors: [], patients: [], appointments: [] });

  const rx = new RegExp(escapeRegex(q), "i");
  const [doctors, patients, appointments] = await Promise.all([
    Doctor.find({
      deletedAt: null,
      $or: [{ name: rx }, { specialization: rx }, { hospital: rx }, { email: rx }],
    })
      .limit(6)
      .select("name specialization hospital")
      .lean(),
    Patient.find({
      deletedAt: null,
      $or: [{ name: rx }, { condition: rx }, { email: rx }, { phone: rx }],
    })
      .limit(6)
      .select("name condition email")
      .lean(),
    Appointment.find({ deletedAt: null, reason: rx })
      .populate("doctor", "name")
      .populate("patient", "name")
      .limit(4)
      .lean(),
  ]);

  return res.json({
    doctors: doctors.map((d) => ({
      id: d._id,
      label: d.name,
      hint: `${d.specialization} · ${d.hospital}`,
      href: `/doctors/${d._id}`,
    })),
    patients: patients.map((p) => ({
      id: p._id,
      label: p.name,
      hint: p.condition,
      href: `/patients/${p._id}`,
    })),
    appointments: appointments.map((a) => ({
      id: a._id,
      label:
        a.patient && typeof a.patient === "object" && "name" in a.patient
          ? String((a.patient as { name: string }).name)
          : "Appointment",
      hint: a.reason || "Scheduled visit",
      href: "/appointments",
    })),
  });
});
