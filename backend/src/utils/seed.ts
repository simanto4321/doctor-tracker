import bcrypt from "bcryptjs";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";
import { Appointment } from "../models/Appointment.js";
import { Visit } from "../models/Visit.js";
import { Prescription } from "../models/Prescription.js";
import { Notification } from "../models/Notification.js";
import { Hospital } from "../models/Hospital.js";
import { LabResult } from "../models/LabResult.js";
import { Vital } from "../models/Vital.js";
import { Referral } from "../models/Referral.js";
import { DocumentFile } from "../models/DocumentFile.js";
import { ConditionEvent } from "../models/ConditionEvent.js";

const doctorsSeed = [
  {
    name: "Dr. Aisha Rahman",
    specialization: "Cardiology",
    hospital: "Harborview Medical Center",
    department: "Heart & Vascular",
    phone: "+1 206-555-0142",
    email: "aisha.rahman@harborview.health",
    workingHours: "Mon–Thu 08:00–16:00",
    bio: "Interventional cardiologist focused on preventive heart care.",
  },
  {
    name: "Dr. Noah Keller",
    specialization: "Neurology",
    hospital: "Summit General Hospital",
    department: "Neurosciences",
    phone: "+1 415-555-0198",
    email: "noah.keller@summit.health",
    workingHours: "Tue–Fri 09:00–17:00",
    bio: "Neurologist specializing in migraine and seizure clinics.",
  },
  {
    name: "Dr. Priya Mehta",
    specialization: "Pediatrics",
    hospital: "Lakeside Children's Hospital",
    department: "General Pediatrics",
    phone: "+1 312-555-0117",
    email: "priya.mehta@lakeside.health",
    workingHours: "Mon–Fri 08:30–15:30",
    bio: "Pediatrician with a focus on asthma and wellness visits.",
  },
  {
    name: "Dr. Marcus Chen",
    specialization: "Orthopedics",
    hospital: "Summit General Hospital",
    department: "Sports Medicine",
    phone: "+1 415-555-0164",
    email: "marcus.chen@summit.health",
    workingHours: "Mon–Wed 10:00–18:00",
    bio: "Orthopedic surgeon for fracture recovery and sports injuries.",
  },
  {
    name: "Dr. Elena Vasquez",
    specialization: "Dermatology",
    hospital: "Coastal Clinic Network",
    department: "Skin Health",
    phone: "+1 858-555-0133",
    email: "elena.vasquez@coastal.health",
    workingHours: "Wed–Sat 09:00–14:00",
    bio: "Dermatologist treating eczema, acne, and chronic skin conditions.",
  },
  {
    name: "Dr. Jamal Okonkwo",
    specialization: "Internal Medicine",
    hospital: "Harborview Medical Center",
    department: "Primary Care",
    phone: "+1 206-555-0175",
    email: "jamal.okonkwo@harborview.health",
    workingHours: "Mon–Fri 09:00–17:00",
    bio: "Internist managing diabetes, hypertension, and complex care.",
  },
];

const conditions = [
  "Hypertension",
  "Type 2 Diabetes",
  "Migraine",
  "Asthma",
  "Fracture Recovery",
  "Eczema",
  "Anxiety Disorder",
  "Post-op Follow-up",
];

const firstNames = [
  "Liam",
  "Olivia",
  "Ethan",
  "Sophia",
  "Noah",
  "Ava",
  "Mason",
  "Isabella",
  "Lucas",
  "Mia",
  "Amir",
  "Zara",
  "Henry",
  "Chloe",
  "Owen",
];

const lastNames = [
  "Brooks",
  "Patel",
  "Nguyen",
  "Garcia",
  "Kim",
  "Andersen",
  "Singh",
  "Torres",
  "Murphy",
  "Ali",
];

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9 + (days % 8), (days * 7) % 60, 0, 0);
  return date;
}

function hoursFromNow(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() + hours, 0, 0, 0);
  return date;
}

export async function seedDatabase() {
  const email = process.env.ADMIN_EMAIL || "admin@doctortracker.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@123";

  const existingAdmin = await User.findOne({ email });
  if (!existingAdmin) {
    await User.create({
      name: "Clinic Admin",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "admin",
    });
  }

  const receptionistEmail = "front.desk@doctortracker.com";
  if (!(await User.findOne({ email: receptionistEmail }))) {
    await User.create({
      name: "Front Desk",
      email: receptionistEmail,
      passwordHash: await bcrypt.hash("Desk@123", 10),
      role: "receptionist",
    });
  }

  const doctorCount = await Doctor.countDocuments();
  if (doctorCount > 0) {
    console.log("[seed] Data already present — skipping sample clinical data");
    return {
      adminEmail: email,
      adminPassword: password,
      seededFresh: false,
    };
  }

  const doctors = await Doctor.insertMany(doctorsSeed);
  const risks = ["none", "low", "medium", "high"] as const;

  const patients = Array.from({ length: 36 }, (_, index) => {
    const doctor = doctors[index % doctors.length];
    const first = firstNames[index % firstNames.length];
    const last = lastNames[index % lastNames.length];
    const gender = index % 3 === 0 ? "female" : index % 3 === 1 ? "male" : "other";

    return {
      name: `${first} ${last}`,
      age: 8 + ((index * 7) % 70),
      gender,
      condition: conditions[index % conditions.length],
      phone: `+1 555-01${String(10 + index).padStart(2, "0")}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${index}@mail.test`,
      doctor: doctor._id,
      notes: "Seeded patient record for demo analytics.",
      riskFlag: risks[index % risks.length],
      createdAt: daysAgo(index % 28),
      updatedAt: daysAgo(index % 28),
    };
  });

  const createdPatients = await Patient.insertMany(patients);

  const appointments = createdPatients.slice(0, 12).map((patient, index) => {
    const startsAt = hoursFromNow(6 + index * 5);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    return {
      doctor: doctors[index % doctors.length]._id,
      patient: patient._id,
      startsAt,
      endsAt,
      status: index % 5 === 0 ? "checked_in" : "scheduled",
      reason: "Follow-up consultation",
      notes: "Seeded appointment",
    };
  });
  await Appointment.insertMany(appointments);

  const visits = createdPatients.slice(0, 18).map((patient, index) => ({
    doctor: doctors[index % doctors.length]._id,
    patient: patient._id,
    visitedAt: daysAgo(index + 2),
    diagnosis: patient.condition,
    treatment: "Continuing care plan",
    followUpAt: index % 3 === 0 ? hoursFromNow(48 + index * 8) : null,
    notes: "Seeded clinical visit",
  }));
  await Visit.insertMany(visits);

  const prescriptions = createdPatients.slice(0, 14).map((patient, index) => ({
    doctor: doctors[index % doctors.length]._id,
    patient: patient._id,
    medication: ["Metformin", "Lisinopril", "Sumatriptan", "Albuterol", "Hydrocortisone"][
      index % 5
    ],
    dosage: ["500mg", "10mg", "50mg", "2 puffs", "1% cream"][index % 5],
    frequency: ["Twice daily", "Once daily", "As needed", "Every 6 hours", "Twice daily"][
      index % 5
    ],
    status: index % 4 === 0 ? "refill_due" : "active",
    startDate: daysAgo(14 + index),
    endDate: null,
    notes: "Seeded prescription",
  }));
  await Prescription.insertMany(prescriptions);

  await Hospital.insertMany([
    {
      name: "Harborview Medical Center",
      city: "Seattle",
      address: "325 9th Ave",
      phone: "+1 206-555-0100",
      departments: ["Heart & Vascular", "Primary Care", "Emergency"],
      bedCount: 420,
    },
    {
      name: "Summit General Hospital",
      city: "San Francisco",
      address: "1100 California St",
      phone: "+1 415-555-0100",
      departments: ["Neurosciences", "Sports Medicine", "Surgery"],
      bedCount: 310,
    },
    {
      name: "Lakeside Children's Hospital",
      city: "Chicago",
      address: "225 E Chicago Ave",
      phone: "+1 312-555-0100",
      departments: ["General Pediatrics", "Pulmonary"],
      bedCount: 180,
    },
    {
      name: "Coastal Clinic Network",
      city: "San Diego",
      address: "880 Harbor Dr",
      phone: "+1 858-555-0100",
      departments: ["Skin Health", "Dermatology"],
      bedCount: 64,
    },
  ]);

  const labs = createdPatients.slice(0, 20).flatMap((patient, index) => {
    const doctor = doctors[index % doctors.length];
    return [0, 1, 2].map((offset) => {
      const value = 90 + ((index * 3 + offset * 7) % 40);
      const refLow = 70;
      const refHigh = 110;
      return {
        patient: patient._id,
        doctor: doctor._id,
        testName: ["Glucose", "LDL", "HbA1c", "CRP"][index % 4],
        value,
        unit: ["mg/dL", "mg/dL", "%", "mg/L"][index % 4],
        refLow,
        refHigh,
        abnormal: value < refLow || value > refHigh,
        collectedAt: daysAgo(offset * 10 + (index % 5)),
        notes: "Seeded lab panel",
      };
    });
  });
  await LabResult.insertMany(labs);

  const vitals = createdPatients.slice(0, 16).map((patient, index) => ({
    patient: patient._id,
    recordedAt: daysAgo(index % 10),
    heartRate: 62 + (index % 28),
    bloodPressureSys: 110 + (index % 30),
    bloodPressureDia: 70 + (index % 15),
    temperatureC: 36.4 + (index % 10) / 10,
    spo2: 96 + (index % 4),
    weightKg: 55 + (index % 35),
    notes: "Seeded vitals check",
  }));
  await Vital.insertMany(vitals);

  const conditionEvents = createdPatients.slice(0, 18).map((patient, index) => ({
    patient: patient._id,
    condition: patient.condition,
    status: ["onset", "stable", "improving", "worsening"][index % 4],
    note: "Condition timeline event",
    recordedAt: daysAgo(index + 1),
  }));
  await ConditionEvent.insertMany(conditionEvents);

  const referrals = createdPatients.slice(0, 8).map((patient, index) => ({
    patient: patient._id,
    fromDoctor: doctors[index % doctors.length]._id,
    toDoctor: doctors[(index + 1) % doctors.length]._id,
    reason: "Specialty consult requested",
    status: index % 3 === 0 ? "accepted" : "pending",
    priority: index % 4 === 0 ? "urgent" : "routine",
    notes: "Seeded referral",
  }));
  await Referral.insertMany(referrals);

  await DocumentFile.insertMany(
    createdPatients.slice(0, 6).map((patient, index) => ({
      title: `${["Consent form", "ID scan", "Clinic report"][index % 3]} — ${patient.name}`,
      category: (["consent", "id", "report"] as const)[index % 3],
      patient: patient._id,
      doctor: doctors[index % doctors.length]._id,
      fileName: `seed-${index + 1}.txt`,
      mimeType: "text/plain",
      sizeBytes: 120,
      content: `Seeded ${["consent", "id", "report"][index % 3]} document for ${patient.name}.`,
      uploadedBy: email,
    }))
  );

  await Notification.insertMany([
    {
      title: "Clinic ready",
      body: "Seed data loaded with doctors, patients, visits, and appointments.",
      type: "success",
      href: "/dashboard",
    },
    {
      title: "Refills due",
      body: "Several prescriptions are marked refill_due.",
      type: "warning",
      href: "/prescriptions",
    },
    {
      title: "Upcoming appointments",
      body: "Review today's scheduled visits in Appointments.",
      type: "appointment",
      href: "/appointments",
    },
    {
      title: "Abnormal labs",
      body: "New lab results include abnormal flags — review Labs.",
      type: "warning",
      href: "/labs",
    },
    {
      title: "Follow-ups overdue",
      body: "Some visit follow-up dates are due. Check patient charts.",
      type: "follow_up",
      href: "/patients",
    },
  ]);

  console.log(
    `[seed] Created ${doctors.length} doctors, ${createdPatients.length} patients, labs/vitals/referrals/docs`
  );
  return {
    adminEmail: email,
    adminPassword: password,
    seededFresh: true,
  };
}
