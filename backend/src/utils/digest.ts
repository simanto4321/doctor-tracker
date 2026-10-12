import { User } from "../models/User.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Appointment } from "../models/Appointment.js";
import { sendEmail } from "./email.js";

export async function sendActivityDigests() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [doctors, patients, appointments, users] = await Promise.all([
    Doctor.countDocuments({ deletedAt: null, createdAt: { $gte: since } }),
    Patient.countDocuments({ deletedAt: null, createdAt: { $gte: since } }),
    Appointment.countDocuments({ deletedAt: null, createdAt: { $gte: since } }),
    User.find({ digestEnabled: true, emailVerified: true }).select("email name"),
  ]);

  const subject = "Doctor Tracker — daily activity digest";
  const body = [
    "Clinic activity in the last 24 hours:",
    `• New doctors: ${doctors}`,
    `• New patients: ${patients}`,
    `• New appointments: ${appointments}`,
    "",
    "Open the dashboard for full analytics.",
  ].join("\n");

  const results = [];
  for (const user of users) {
    const sent = await sendEmail({
      to: user.email,
      subject,
      body: `Hi ${user.name},\n\n${body}`,
      kind: "digest",
      meta: { doctors, patients, appointments },
    });
    results.push({ email: user.email, id: sent.id });
  }

  // Always include admin demo recipient if no verified users
  if (results.length === 0) {
    const { config } = await import("../config.js");
    const adminEmail = config.admin.email;
    const sent = await sendEmail({
      to: adminEmail,
      subject,
      body,
      kind: "digest",
      meta: { doctors, patients, appointments, fallback: true },
    });
    results.push({ email: adminEmail, id: sent.id });
  }

  return { since: since.toISOString(), counts: { doctors, patients, appointments }, sent: results };
}
