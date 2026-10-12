import { Router } from "express";
import { z } from "zod";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Appointment } from "../models/Appointment.js";
import { Visit } from "../models/Visit.js";
import { FilterPreset } from "../models/FilterPreset.js";
import { requireAuth } from "../middleware/auth.js";
import { cachedJson } from "../utils/cache.js";
import { config } from "../config.js";
import { boundForDateInput, formatInClinic } from "../utils/datetime.js";
import { escapeRegex } from "../utils/parseQuery.js";

function clinicTz() {
  return process.env.CLINIC_TIMEZONE || config.clinicTimeZone || "UTC";
}

function clinicDayKey(date: Date) {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: clinicTz(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

function parseRange(query: Record<string, unknown>) {
  const now = new Date();
  const fromRaw = typeof query.from === "string" ? query.from : "";
  const toRaw = typeof query.to === "string" ? query.to : "";

  let rangeStart = fromRaw
    ? boundForDateInput(fromRaw, "start")
    : boundForDateInput(
        new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        "start"
      );
  let rangeEnd = toRaw ? boundForDateInput(toRaw, "end") : now;

  if (Number.isNaN(rangeStart.getTime())) {
    rangeStart = boundForDateInput(
      new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      "start"
    );
  }
  if (Number.isNaN(rangeEnd.getTime())) {
    rangeEnd = now;
  }

  if (rangeEnd < rangeStart) {
    const swapStart = rangeStart;
    rangeStart = boundForDateInput(toRaw || rangeEnd.toISOString().slice(0, 10), "start");
    rangeEnd = boundForDateInput(fromRaw || swapStart.toISOString().slice(0, 10), "end");
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const rawDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / dayMs) + 1;
  const dayCount = Math.max(1, Math.min(366, rawDays));

  return { now, rangeStart, rangeEnd, dayCount };
}

dashboardRouter.get("/stats", async (req, res) => {
  const { now, rangeStart, rangeEnd, dayCount } = parseRange(req.query as Record<string, unknown>);
  const hospital =
    typeof req.query.hospital === "string" ? req.query.hospital.trim() : "";
  const specialization =
    typeof req.query.specialization === "string" ? req.query.specialization.trim() : "";

  const cacheKey = `dashboard:stats:${rangeStart.toISOString().slice(0, 10)}:${rangeEnd.toISOString().slice(0, 10)}:${hospital}:${specialization}`;
  const { config } = await import("../config.js");
  const ttl = config.dashboardCacheTtl;

  const payload = await cachedJson(cacheKey, ttl, async () => {
  const doctorFilter: Record<string, unknown> = { deletedAt: null };
  if (hospital) doctorFilter.hospital = new RegExp(escapeRegex(hospital), "i");
  if (specialization) {
    doctorFilter.specialization = new RegExp(`^${escapeRegex(specialization)}$`, "i");
  }

  const scopedDoctors = await Doctor.find(doctorFilter).select("_id name specialization hospital").lean();
  const doctorIds = scopedDoctors.map((d) => d._id);
  const patientFilter: Record<string, unknown> = { deletedAt: null };
  if (hospital || specialization) {
    patientFilter.doctor = { $in: doctorIds };
  }

  const rangePatientFilter = {
    ...patientFilter,
    createdAt: { $gte: rangeStart, $lte: rangeEnd },
  };

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
    hospitalComparison,
    specializationByHospital,
    utilizationRaw,
  ] = await Promise.all([
    Doctor.countDocuments(doctorFilter),
    Patient.countDocuments(patientFilter),
    Appointment.countDocuments({
      deletedAt: null,
      status: { $in: ["scheduled", "checked_in"] },
      startsAt: { $gte: now },
      ...(doctorIds.length && (hospital || specialization) ? { doctor: { $in: doctorIds } } : {}),
    }),
    Visit.countDocuments({
      deletedAt: null,
      followUpAt: { $gte: now },
      ...(doctorIds.length && (hospital || specialization) ? { doctor: { $in: doctorIds } } : {}),
    }),
    Patient.aggregate<{
      _id: unknown;
      count: number;
      doctorName: string;
      specialization: string;
      hospital: string;
    }>([
      { $match: patientFilter },
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
          hospital: { $first: "$doctorInfo.hospital" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: patientFilter },
      { $group: { _id: "$condition", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Doctor.aggregate<{ _id: string; count: number }>([
      { $match: doctorFilter },
      { $group: { _id: "$specialization", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: patientFilter },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
    ]),
    Patient.aggregate<{ _id: number | string; count: number }>([
      { $match: patientFilter },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [0, 18, 35, 50, 65, 130],
          default: "Unknown",
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Patient.find(patientFilter)
      .populate("doctor", "name")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: rangePatientFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: clinicTz(),
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Patient.aggregate<{
      _id: string;
      patients: number;
      doctors: number;
    }>([
      { $match: patientFilter },
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
          _id: "$doctorInfo.hospital",
          patients: { $sum: 1 },
          doctors: { $addToSet: "$doctor" },
        },
      },
      {
        $project: {
          patients: 1,
          doctors: { $size: "$doctors" },
        },
      },
      { $sort: { patients: -1 } },
    ]),
    Patient.aggregate<{
      _id: { hospital: string; specialization: string };
      patients: number;
    }>([
      { $match: patientFilter },
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
          _id: {
            hospital: "$doctorInfo.hospital",
            specialization: "$doctorInfo.specialization",
          },
          patients: { $sum: 1 },
        },
      },
      { $sort: { patients: -1 } },
    ]),
    Patient.aggregate<{
      _id: { day: string; doctorId: unknown; doctorName: string };
      count: number;
    }>([
      { $match: rangePatientFilter },
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
          _id: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: clinicTz(),
              },
            },
            doctorId: "$doctor",
            doctorName: "$doctorInfo.name",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]),
  ]);

  const dayMap = new Map(dailyPatients.map((d) => [d._id, d.count]));
  const patientTrend = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(rangeStart.getTime() + index * 24 * 60 * 60 * 1000);
    if (date > rangeEnd) return null;
    const key = clinicDayKey(date);
    return {
      date: key,
      label: formatInClinic(date, { month: "short", day: "numeric" }),
      patients: dayMap.get(key) || 0,
    };
  }).filter(Boolean);

  const hospitals = Array.from(
    new Set(specializationByHospital.map((row) => row._id.hospital))
  ).sort();
  const specializations = Array.from(
    new Set(specializationByHospital.map((row) => row._id.specialization))
  ).sort();
  const heatMapLookup = new Map(
    specializationByHospital.map((row) => [
      `${row._id.hospital}::${row._id.specialization}`,
      row.patients,
    ])
  );
  const specializationHeatmap = {
    hospitals,
    specializations,
    cells: hospitals.flatMap((h) =>
      specializations.map((s) => ({
        hospital: h,
        specialization: s,
        patients: heatMapLookup.get(`${h}::${s}`) || 0,
      }))
    ),
  };

  // Top doctors by volume in range for utilization series
  const doctorTotals = new Map<string, { name: string; total: number }>();
  utilizationRaw.forEach((row) => {
    const id = String(row._id.doctorId);
    const prev = doctorTotals.get(id) || { name: row._id.doctorName, total: 0 };
    prev.total += row.count;
    doctorTotals.set(id, prev);
  });
  const topDoctorIds = Array.from(doctorTotals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([id]) => id);

  const utilLookup = new Map<string, number>();
  utilizationRaw.forEach((row) => {
    utilLookup.set(`${row._id.day}::${String(row._id.doctorId)}`, row.count);
  });

  const doctorUtilization = {
    doctors: topDoctorIds.map((id) => ({
      doctorId: id,
      name: doctorTotals.get(id)?.name || "Doctor",
    })),
    series: Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(rangeStart.getTime() + index * 24 * 60 * 60 * 1000);
      if (date > rangeEnd) return null;
      const key = clinicDayKey(date);
      const point: Record<string, string | number> = {
        date: key,
        label: formatInClinic(date, { month: "short", day: "numeric" }),
      };
      topDoctorIds.forEach((id) => {
        const short = doctorTotals.get(id)?.name.replace(/^Dr\.\s*/, "").split(" ")[0] || id.slice(-4);
        point[short] = utilLookup.get(`${key}::${id}`) || 0;
      });
      return point;
    }).filter(Boolean),
  };

  const filtersMeta = {
    hospitals: await Doctor.distinct("hospital", { deletedAt: null }),
    specializations: await Doctor.distinct("specialization", { deletedAt: null }),
  };

  return {
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      avgPatientsPerDoctor:
        totalDoctors === 0 ? 0 : Math.round((totalPatients / totalDoctors) * 10) / 10,
      conditionsTracked: conditionBreakdown.length,
      upcomingAppointments,
      openFollowUps,
      patientsInRange: dailyPatients.reduce((sum, d) => sum + d.count, 0),
    },
    range: {
      from: clinicDayKey(rangeStart),
      to: clinicDayKey(rangeEnd),
    },
    appliedFilters: { hospital, specialization },
    filtersMeta: {
      hospitals: filtersMeta.hospitals.filter(Boolean).sort(),
      specializations: filtersMeta.specializations.filter(Boolean).sort(),
    },
    patientsPerDoctor: patientsPerDoctor.map((row) => ({
      doctorId: row._id,
      name: row.doctorName,
      specialization: row.specialization,
      hospital: row.hospital,
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
    hospitalComparison: hospitalComparison.map((row) => ({
      hospital: row._id,
      patients: row.patients,
      doctors: row.doctors,
      avgPerDoctor: row.doctors === 0 ? 0 : Math.round((row.patients / row.doctors) * 10) / 10,
    })),
    specializationHeatmap,
    doctorUtilization,
    patientTrend,
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
  };
  });

  return res.json(payload);
});

const presetSchema = z.object({
  name: z.string().min(2).max(80),
  filters: z.object({
    from: z.string().optional().default(""),
    to: z.string().optional().default(""),
    hospital: z.string().optional().default(""),
    specialization: z.string().optional().default(""),
  }),
});

dashboardRouter.get("/presets", async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const items = await FilterPreset.find({ userId, deletedAt: null, scope: "dashboard" })
    .sort({ updatedAt: -1 })
    .lean();
  return res.json({
    items: items.map((item) => ({
      ...item,
      id: item._id,
    })),
  });
});

dashboardRouter.post("/presets", async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const parsed = presetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const existing = await FilterPreset.findOne({
      userId,
      name: parsed.data.name,
    });
    if (existing) {
      existing.deletedAt = null;
      existing.filters = parsed.data.filters;
      await existing.save();
      return res.json({ ...existing.toObject(), id: existing._id });
    }
    const created = await FilterPreset.create({
      userId,
      name: parsed.data.name,
      scope: "dashboard",
      filters: parsed.data.filters,
    });
    return res.status(201).json({ ...created.toObject(), id: created._id });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 11000) {
      return res.status(409).json({ message: "A preset with this name already exists" });
    }
    throw error;
  }
});

dashboardRouter.delete("/presets/:id", async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const preset = await FilterPreset.findOne({ _id: req.params.id, userId, deletedAt: null });
  if (!preset) return res.status(404).json({ message: "Preset not found" });
  preset.deletedAt = new Date();
  await preset.save();
  return res.json({ message: "Preset deleted" });
});
