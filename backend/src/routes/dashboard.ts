import { Router } from "express";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Appointment } from "../models/Appointment.js";
import { Visit } from "../models/Visit.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/stats", async (req, res) => {
  const now = new Date();
  const fromParam = typeof req.query.from === "string" ? new Date(req.query.from) : null;
  const toParam = typeof req.query.to === "string" ? new Date(req.query.to) : null;

  const rangeStart =
    fromParam && !Number.isNaN(fromParam.getTime())
      ? fromParam
      : new Date(new Date(now).setDate(now.getDate() - 29));
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = toParam && !Number.isNaN(toParam.getTime()) ? toParam : now;
  rangeEnd.setHours(23, 59, 59, 999);

  const dayMs = 24 * 60 * 60 * 1000;
  const dayCount = Math.max(1, Math.min(90, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / dayMs) + 1));

  const [
    totalDoctors,
    totalPatients,
    upcomingAppointments,
    openFollowUps,
    patientsPerDoctor,
    conditionBreakdown,
    specializationBreakdown,
    genderBreakdown,
    ageBuckets,
    recentPatients,
    dailyPatients,
  ] = await Promise.all([
    Doctor.countDocuments({ deletedAt: null }),
    Patient.countDocuments({ deletedAt: null }),
    Appointment.countDocuments({
      deletedAt: null,
      status: { $in: ["scheduled", "checked_in"] },
      startsAt: { $gte: now },
    }),
    Visit.countDocuments({ deletedAt: null, followUpAt: { $gte: now } }),
    Patient.aggregate<{
      _id: unknown;
      count: number;
      doctorName: string;
      specialization: string;
    }>([
      { $match: { deletedAt: null } },
      {
        $lookup: {
          from: "doctors",
          localField: "doctor",
          foreignField: "_id",
          as: "doctorInfo",
        },
      },
      { $unwind: "$doctorInfo" },
      {
        $group: {
          _id: "$doctor",
          count: { $sum: 1 },
          doctorName: { $first: "$doctorInfo.name" },
          specialization: { $first: "$doctorInfo.specialization" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: "$condition", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    Doctor.aggregate<{ _id: string; count: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: "$specialization", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
    ]),
    Patient.aggregate<{ _id: number | string; count: number }>([
      { $match: { deletedAt: null } },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [0, 18, 35, 50, 65, 130],
          default: "Unknown",
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Patient.find({ deletedAt: null })
      .populate("doctor", "name")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { deletedAt: null, createdAt: { $gte: rangeStart, $lte: rangeEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const dayMap = new Map(dailyPatients.map((d) => [d._id, d.count]));
  const trend = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(rangeStart);
    date.setDate(rangeStart.getDate() + index);
    if (date > rangeEnd) return null;
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      patients: dayMap.get(key) || 0,
    };
  }).filter(Boolean);

  return res.json({
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      avgPatientsPerDoctor:
        totalDoctors === 0 ? 0 : Math.round((totalPatients / totalDoctors) * 10) / 10,
      conditionsTracked: conditionBreakdown.length,
      upcomingAppointments,
      openFollowUps,
    },
    range: {
      from: rangeStart.toISOString().slice(0, 10),
      to: rangeEnd.toISOString().slice(0, 10),
    },
    patientsPerDoctor: patientsPerDoctor.map((row) => ({
      doctorId: row._id,
      name: row.doctorName,
      specialization: row.specialization,
      patients: row.count,
    })),
    conditionBreakdown: conditionBreakdown.map((row) => ({
      condition: row._id,
      count: row.count,
    })),
    specializationBreakdown: specializationBreakdown.map((row) => ({
      specialization: row._id,
      count: row.count,
    })),
    genderBreakdown: genderBreakdown.map((row) => ({
      gender: row._id,
      count: row.count,
    })),
    ageBreakdown: ageBuckets.map((row) => {
      const labels: Record<string, string> = {
        "0": "0-17",
        "18": "18-34",
        "35": "35-49",
        "50": "50-64",
        "65": "65+",
      };
      return {
        bucket: labels[String(row._id)] || String(row._id),
        count: row.count,
      };
    }),
    patientTrend: trend,
    recentPatients: recentPatients.map((patient) => ({
      id: patient._id,
      name: patient.name,
      condition: patient.condition,
      createdAt: patient.createdAt,
      riskFlag: patient.riskFlag || "none",
      doctor:
        patient.doctor && typeof patient.doctor === "object" && "name" in patient.doctor
          ? (patient.doctor as { name: string }).name
          : "Unassigned",
    })),
  });
});
