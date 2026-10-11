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
import { Bed } from "../models/Bed.js";
import { Message } from "../models/Message.js";
import { TeleSession } from "../models/TeleSession.js";
import { Invoice } from "../models/Invoice.js";

function doctorPhoto(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

const doctorsSeed = [
  {
    name: "Dr. Aisha Rahman",
    specialization: "Cardiology",
    hospital: "Harborview Medical Center",
    department: "Heart & Vascular",
    title: "Consultant Cardiologist",
    degrees: "MD, FACC",
    phone: "+1 206-555-0142",
    email: "aisha.rahman@harborview.health",
    workingHours: "Mon–Thu 08:00–16:00",
    bio: "Interventional cardiologist focused on preventive heart care.",
    photoUrl: doctorPhoto("AishaRahman"),
  },
  {
    name: "Dr. Noah Keller",
    specialization: "Neurology",
    hospital: "Summit General Hospital",
    department: "Neurosciences",
    title: "Attending Neurologist",
    degrees: "MD, PhD",
    phone: "+1 415-555-0198",
    email: "noah.keller@summit.health",
    workingHours: "Tue–Fri 09:00–17:00",
    bio: "Neurologist specializing in migraine and seizure clinics.",
    photoUrl: doctorPhoto("NoahKeller"),
  },
  {
    name: "Dr. Priya Mehta",
    specialization: "Pediatrics",
    hospital: "Lakeside Children's Hospital",
    department: "General Pediatrics",
    title: "Pediatric Consultant",
    degrees: "MBBS, DCH",
    phone: "+1 312-555-0117",
    email: "priya.mehta@lakeside.health",
    workingHours: "Mon–Fri 08:30–15:30",
    bio: "Pediatrician with a focus on asthma and wellness visits.",
    photoUrl: doctorPhoto("PriyaMehta"),
  },
  {
    name: "Dr. Marcus Chen",
    specialization: "Orthopedics",
    hospital: "Summit General Hospital",
    department: "Sports Medicine",
    title: "Orthopedic Surgeon",
    degrees: "MD, FAAOS",
    phone: "+1 415-555-0164",
    email: "marcus.chen@summit.health",
    workingHours: "Mon–Wed 10:00–18:00",
    bio: "Orthopedic surgeon for fracture recovery and sports injuries.",
    photoUrl: doctorPhoto("MarcusChen"),
  },
  {
    name: "Dr. Elena Vasquez",
    specialization: "Dermatology",
    hospital: "Coastal Clinic Network",
    department: "Skin Health",
    title: "Dermatologist",
    degrees: "MD, FAAD",
    phone: "+1 858-555-0133",
    email: "elena.vasquez@coastal.health",
    workingHours: "Wed–Sat 09:00–14:00",
    bio: "Dermatologist treating eczema, acne, and chronic skin conditions.",
    photoUrl: doctorPhoto("ElenaVasquez"),
  },
  {
    name: "Dr. Jamal Okonkwo",
    specialization: "Internal Medicine",
    hospital: "Harborview Medical Center",
    department: "Primary Care",
    title: "Internist",
    degrees: "MD, FACP",
    phone: "+1 206-555-0175",
    email: "jamal.okonkwo@harborview.health",
    workingHours: "Mon–Fri 09:00–17:00",
    bio: "Internist managing diabetes, hypertension, and complex care.",
    photoUrl: doctorPhoto("JamalOkonkwo"),
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
      emailVerified: true,
      digestEnabled: true,
    });
  } else if (!existingAdmin.emailVerified) {
    existingAdmin.emailVerified = true;
    existingAdmin.digestEnabled = true;
    await existingAdmin.save();
  }

  const receptionistEmail = "front.desk@doctortracker.com";
  const existingDesk = await User.findOne({ email: receptionistEmail });
  if (!existingDesk) {
    await User.create({
      name: "Front Desk",
      email: receptionistEmail,
      passwordHash: await bcrypt.hash("Desk@123", 10),
      role: "receptionist",
      emailVerified: true,
      digestEnabled: true,
    });
  } else if (!existingDesk.emailVerified) {
    existingDesk.emailVerified = true;
    existingDesk.digestEnabled = true;
    await existingDesk.save();
  }

  const doctorCount = await Doctor.countDocuments();
  if (doctorCount > 0) {
    console.log("[seed] Data already present — skipping sample clinical data");
    await backfillDoctorProfiles();
    await seedSmartAddons(email);
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

  const visits = createdPatients.slice(0, 18).map((patient, index) => {
    const diabetes = /diabetes/i.test(patient.condition);
    let followUpAt: Date | null = null;
    if (diabetes || index % 4 === 0) {
      // Overdue follow-ups for diabetes / every 4th patient — drives risk flags
      followUpAt = daysAgo(2 + (index % 5));
    } else if (index % 3 === 0) {
      followUpAt = hoursFromNow(48 + index * 8);
    }
    return {
      doctor: doctors[index % doctors.length]._id,
      patient: patient._id,
      visitedAt: daysAgo(index + 2),
      diagnosis: patient.condition,
      treatment: "Continuing care plan",
      followUpAt,
      notes: diabetes
        ? "Diabetes visit — review glucose log and meds adherence."
        : "Seeded clinical visit",
    };
  });
  const createdVisits = await Visit.insertMany(visits);

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

  const vitals = createdPatients.slice(0, 16).map((patient, index) => {
    const highBp = index % 3 === 0 || /hypertension/i.test(patient.condition);
    return {
      patient: patient._id,
      recordedAt: daysAgo(index % 10),
      heartRate: 62 + (index % 28),
      bloodPressureSys: highBp ? 142 + (index % 20) : 110 + (index % 20),
      bloodPressureDia: highBp ? 92 + (index % 10) : 70 + (index % 12),
      temperatureC: 36.4 + (index % 10) / 10,
      spo2: index % 7 === 0 ? 92 : 96 + (index % 4),
      weightKg: 55 + (index % 35),
      notes: highBp ? "Elevated BP reading — recheck" : "Seeded vitals check",
    };
  });
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

  await seedSmartAddons(email, {
    doctors,
    patients: createdPatients,
    visits: createdVisits,
  });

  console.log(
    `[seed] Created ${doctors.length} doctors, ${createdPatients.length} patients, labs/vitals/referrals/docs + smart add-ons`
  );
  return {
    adminEmail: email,
    adminPassword: password,
    seededFresh: true,
  };
}

async function backfillDoctorProfiles() {
  const existing = await Doctor.find({ deletedAt: null }).lean();
  let updated = 0;
  for (const doctor of existing) {
    const seed = doctorsSeed.find((d) => d.email === doctor.email);
    const patch: Record<string, string> = {};
    if (!doctor.photoUrl) {
      patch.photoUrl = seed?.photoUrl || doctorPhoto(doctor.name);
    }
    if (!doctor.title) {
      patch.title = seed?.title || `${doctor.specialization} Specialist`;
    }
    if (!doctor.degrees) {
      patch.degrees = seed?.degrees || "MD";
    }
    if (Object.keys(patch).length) {
      await Doctor.updateOne({ _id: doctor._id }, { $set: patch });
      updated += 1;
    }
  }
  if (updated) console.log(`[seed] Backfilled photo/title/degrees on ${updated} doctors`);
}

async function seedSmartAddons(
  adminEmail: string,
  preloaded?: {
    doctors: Array<{ _id: unknown }>;
    patients: Array<{ _id: unknown; name?: string; condition?: string }>;
    visits: Array<{ _id: unknown; patient: unknown; doctor: unknown; diagnosis?: string }>;
  }
) {
  const bedCount = await Bed.countDocuments();
  if (bedCount > 0) {
    console.log("[seed] Smart add-ons already present — skipping");
    return;
  }

  const hospitals = await Hospital.find({ deletedAt: null }).lean();
  const doctors = preloaded?.doctors || (await Doctor.find({ deletedAt: null }).limit(6).lean());
  const patients =
    preloaded?.patients || (await Patient.find({ deletedAt: null }).limit(36).lean());
  const visits =
    preloaded?.visits || (await Visit.find({ deletedAt: null }).limit(18).lean());
  const users = await User.find().lean();
  const admin = users.find((u) => u.email === adminEmail) || users[0];
  const desk = users.find((u) => u.role === "receptionist") || users[1] || users[0];

  if (hospitals.length) {
    const bedDocs = hospitals.flatMap((hospital, hIndex) => {
      const wards = ["Med-Surg A", "ICU", "Telemetry"].slice(0, hIndex === 3 ? 2 : 3);
      return wards.flatMap((ward, wIndex) =>
        Array.from({ length: 4 }, (_, bIndex) => {
          const occupy = (hIndex + wIndex + bIndex) % 3 === 0;
          const patient = occupy ? patients[(hIndex * 4 + wIndex + bIndex) % patients.length] : null;
          return {
            hospital: hospital._id,
            ward,
            bedNumber: `${ward.slice(0, 1)}${wIndex + 1}-${String(bIndex + 1).padStart(2, "0")}`,
            status: occupy ? "occupied" : bIndex === 3 ? "cleaning" : "available",
            patient: patient?._id || null,
            admittedAt: occupy ? daysAgo(bIndex + 1) : null,
            notes: occupy ? "Seeded admission" : "",
          };
        })
      );
    });
    await Bed.insertMany(bedDocs);
  }

  if (admin && desk && patients.length) {
    await Message.insertMany([
      {
        from: desk._id,
        to: admin._id,
        subject: "Diabetes follow-ups",
        body: "Several Type 2 Diabetes patients have overdue follow-ups — please review risk flags.",
        patient: patients.find((p) => /diabetes/i.test(String(p.condition || "")))?._id || null,
      },
      {
        from: admin._id,
        to: desk._id,
        subject: "Tele visit tomorrow",
        body: "Confirm telemedicine link is ready for the Harborview cardiology slot.",
        patient: patients[0]?._id || null,
      },
    ]);
  }

  if (doctors.length && patients.length) {
    await TeleSession.insertMany(
      patients.slice(0, 5).map((patient, index) => {
        const idHint = `seed-${index + 1}`;
        return {
          patient: patient._id,
          doctor: doctors[index % doctors.length]._id,
          scheduledAt: hoursFromNow(12 + index * 6),
          durationMinutes: 30,
          joinUrl: `https://meet.doctortracker.local/session/${idHint}`,
          status: index === 0 ? "in_progress" : index === 4 ? "completed" : "scheduled",
          reason: "Virtual follow-up",
          notes: "Seeded telemedicine placeholder",
          createdBy: admin?._id || null,
        };
      })
    );
  }

  if (visits.length) {
    await Invoice.insertMany(
      visits.slice(0, 8).map((visit, index) => {
        const consult = 120 + (index % 4) * 25;
        const labs = index % 2 === 0 ? 45 : 0;
        return {
          visit: visit._id,
          patient: visit.patient,
          doctor: visit.doctor,
          number: `INV-SEED-${String(index + 1).padStart(4, "0")}`,
          lineItems: [
            { description: "Office visit", quantity: 1, unitPrice: consult },
            ...(labs
              ? [{ description: "Lab draw / processing", quantity: 1, unitPrice: labs }]
              : []),
          ],
          amount: consult + labs,
          status: index % 3 === 0 ? "paid" : index % 3 === 1 ? "issued" : "draft",
          issuedAt: index % 3 === 2 ? null : daysAgo(index),
          paidAt: index % 3 === 0 ? daysAgo(index) : null,
          notes: visit.diagnosis || "Visit invoice",
        };
      })
    );
  }

  console.log("[seed] Smart add-ons: beds, messages, telemedicine, invoices");
}
