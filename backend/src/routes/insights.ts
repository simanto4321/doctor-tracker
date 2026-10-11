import { Router } from "express";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Appointment } from "../models/Appointment.js";
import { Prescription } from "../models/Prescription.js";
import { LabResult } from "../models/LabResult.js";
import { Referral } from "../models/Referral.js";
import { Notification } from "../models/Notification.js";
import { Visit } from "../models/Visit.js";
import { DocumentFile } from "../models/DocumentFile.js";
import { Hospital } from "../models/Hospital.js";
import { requireAuth } from "../middleware/auth.js";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

insightsRouter.get("/hover/:feature", async (req, res) => {
  const feature = req.params.feature;
  const now = new Date();

  const catalog: Record<
    string,
    { title: string; summary: string; build: () => Promise<Array<{ label: string; value: string }>> }
  > = {
    dashboard: {
      title: "Dashboard",
      summary: "Live clinic KPIs, intake trends, and caseload mix.",
      build: async () => {
        const [doctors, patients, appts] = await Promise.all([
          Doctor.countDocuments({ deletedAt: null }),
          Patient.countDocuments({ deletedAt: null }),
          Appointment.countDocuments({
            deletedAt: null,
            status: { $in: ["scheduled", "checked_in"] },
            startsAt: { $gte: now },
          }),
        ]);
        return [
          { label: "Doctors", value: String(doctors) },
          { label: "Patients", value: String(patients) },
          { label: "Upcoming appts", value: String(appts) },
        ];
      },
    },
    doctors: {
      title: "Doctors",
      summary: "Clinician registry with specialties, hospitals, and working hours.",
      build: async () => {
        const [total, latest] = await Promise.all([
          Doctor.countDocuments({ deletedAt: null }),
          Doctor.findOne({ deletedAt: null }).sort({ createdAt: -1 }).select("name specialization"),
        ]);
        return [
          { label: "Active doctors", value: String(total) },
          { label: "Latest added", value: latest ? `${latest.name}` : "—" },
          { label: "Specialty", value: latest?.specialization || "—" },
        ];
      },
    },
    patients: {
      title: "Patients",
      summary: "Patient charts with conditions, risk flags, and assignments.",
      build: async () => {
        const [total, highRisk, latest] = await Promise.all([
          Patient.countDocuments({ deletedAt: null }),
          Patient.countDocuments({ deletedAt: null, riskFlag: "high" }),
          Patient.findOne({ deletedAt: null }).sort({ createdAt: -1 }).select("name condition"),
        ]);
        return [
          { label: "Active patients", value: String(total) },
          { label: "High risk", value: String(highRisk) },
          { label: "Latest", value: latest ? `${latest.name} · ${latest.condition}` : "—" },
        ];
      },
    },
    appointments: {
      title: "Appointments",
      summary: "Book, reschedule, and review day-by-day clinic schedule.",
      build: async () => {
        const [upcoming, checkedIn] = await Promise.all([
          Appointment.countDocuments({
            deletedAt: null,
            status: "scheduled",
            startsAt: { $gte: now },
          }),
          Appointment.countDocuments({ deletedAt: null, status: "checked_in" }),
        ]);
        return [
          { label: "Scheduled ahead", value: String(upcoming) },
          { label: "Checked in", value: String(checkedIn) },
        ];
      },
    },
    prescriptions: {
      title: "Prescriptions",
      summary: "Medication orders with dosage, frequency, and refill status.",
      build: async () => {
        const [active, refill] = await Promise.all([
          Prescription.countDocuments({ deletedAt: null, status: "active" }),
          Prescription.countDocuments({ deletedAt: null, status: "refill_due" }),
        ]);
        return [
          { label: "Active Rx", value: String(active) },
          { label: "Refill due", value: String(refill) },
        ];
      },
    },
    labs: {
      title: "Lab results",
      summary: "Test values with reference ranges, abnormal flags, and trends.",
      build: async () => {
        const [total, abnormal] = await Promise.all([
          LabResult.countDocuments({ deletedAt: null }),
          LabResult.countDocuments({ deletedAt: null, abnormal: true }),
        ]);
        return [
          { label: "Results", value: String(total) },
          { label: "Abnormal", value: String(abnormal) },
        ];
      },
    },
    referrals: {
      title: "Referrals",
      summary: "Track handoffs between doctors with priority and status.",
      build: async () => {
        const [pending, urgent] = await Promise.all([
          Referral.countDocuments({ deletedAt: null, status: "pending" }),
          Referral.countDocuments({ deletedAt: null, priority: { $in: ["urgent", "stat"] } }),
        ]);
        return [
          { label: "Pending", value: String(pending) },
          { label: "Urgent/STAT", value: String(urgent) },
        ];
      },
    },
    hospitals: {
      title: "Hospitals",
      summary: "Multi-hospital network with departments and staffing counts.",
      build: async () => {
        const total = await Hospital.countDocuments({ deletedAt: null });
        return [{ label: "Facilities", value: String(total) }];
      },
    },
    documents: {
      title: "Documents",
      summary: "Reports, ID, and consent files stored for clinical records.",
      build: async () => {
        const total = await DocumentFile.countDocuments({ deletedAt: null });
        return [{ label: "Files", value: String(total) }];
      },
    },
    import: {
      title: "Bulk import",
      summary: "Upload CSV to create many doctors or patients at once.",
      build: async () => [
        { label: "Formats", value: "doctors.csv · patients.csv" },
        { label: "Access", value: "Admin / receptionist" },
      ],
    },
    trash: {
      title: "Trash / restore",
      summary: "Soft-deleted records can be reviewed and restored by admins.",
      build: async () => {
        const [doctors, patients] = await Promise.all([
          Doctor.countDocuments({ deletedAt: { $ne: null } }),
          Patient.countDocuments({ deletedAt: { $ne: null } }),
        ]);
        return [
          { label: "Deleted doctors", value: String(doctors) },
          { label: "Deleted patients", value: String(patients) },
        ];
      },
    },
    notifications: {
      title: "Notifications",
      summary: "Follow-ups, assignments, imports, and refill alerts.",
      build: async () => {
        const unread = await Notification.countDocuments({ read: false });
        const overdue = await Visit.countDocuments({
          deletedAt: null,
          followUpAt: { $lte: now },
        });
        return [
          { label: "Unread", value: String(unread) },
          { label: "Follow-ups due", value: String(overdue) },
        ];
      },
    },
    search: {
      title: "Global search",
      summary: "Press ⌘K / Ctrl+K to jump to doctors, patients, or appointments.",
      build: async () => [
        { label: "Shortcut", value: "⌘K / Ctrl+K" },
        { label: "Scopes", value: "Doctors · Patients · Appts" },
      ],
    },
    audit: {
      title: "Audit log",
      summary: "Admin trail of create, update, delete, login, and import actions.",
      build: async () => [{ label: "Access", value: "Admin only" }],
    },
    team: {
      title: "Team",
      summary: "Register receptionist or doctor accounts (admin only).",
      build: async () => [{ label: "Roles", value: "admin · receptionist · doctor" }],
    },
  };

  const entry = catalog[feature];
  if (!entry) {
    return res.status(404).json({ message: "Unknown feature insight" });
  }

  const stats = await entry.build();
  return res.json({
    feature,
    title: entry.title,
    summary: entry.summary,
    stats,
    updatedAt: new Date().toISOString(),
  });
});
