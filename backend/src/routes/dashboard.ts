import { Router } from "express";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/stats", async (_req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    totalDoctors,
    totalPatients,
    patientsPerDoctor,
    conditionBreakdown,
    specializationBreakdown,
    recentPatients,
    dailyPatients,
  ] = await Promise.all([
    Doctor.countDocuments(),
    Patient.countDocuments(),
    Patient.aggregate<{
      _id: unknown;
      count: number;
      doctorName: string;
      specialization: string;
    }>([
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
      { $group: { _id: "$condition", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    Doctor.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$specialization", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Patient.find()
      .populate("doctor", "name")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const dayMap = new Map(dailyPatients.map((d) => [d._id, d.count]));
  const trend = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(thirtyDaysAgo);
    date.setDate(thirtyDaysAgo.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      patients: dayMap.get(key) || 0,
    };
  });

  return res.json({
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      avgPatientsPerDoctor:
        totalDoctors === 0 ? 0 : Math.round((totalPatients / totalDoctors) * 10) / 10,
      conditionsTracked: conditionBreakdown.length,
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
    patientTrend: trend,
    recentPatients: recentPatients.map((patient) => ({
      id: patient._id,
      name: patient.name,
      condition: patient.condition,
      createdAt: patient.createdAt,
      doctor:
        patient.doctor && typeof patient.doctor === "object" && "name" in patient.doctor
          ? (patient.doctor as { name: string }).name
          : "Unassigned",
    })),
  });
});
