import bcrypt from "bcryptjs";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { User } from "../models/User.js";

const doctorsSeed = [
  {
    name: "Dr. Aisha Rahman",
    specialization: "Cardiology",
    hospital: "Harborview Medical Center",
    phone: "+1 206-555-0142",
    email: "aisha.rahman@harborview.health",
  },
  {
    name: "Dr. Noah Keller",
    specialization: "Neurology",
    hospital: "Summit General Hospital",
    phone: "+1 415-555-0198",
    email: "noah.keller@summit.health",
  },
  {
    name: "Dr. Priya Mehta",
    specialization: "Pediatrics",
    hospital: "Lakeside Children's Hospital",
    phone: "+1 312-555-0117",
    email: "priya.mehta@lakeside.health",
  },
  {
    name: "Dr. Marcus Chen",
    specialization: "Orthopedics",
    hospital: "Summit General Hospital",
    phone: "+1 415-555-0164",
    email: "marcus.chen@summit.health",
  },
  {
    name: "Dr. Elena Vasquez",
    specialization: "Dermatology",
    hospital: "Coastal Clinic Network",
    phone: "+1 858-555-0133",
    email: "elena.vasquez@coastal.health",
  },
  {
    name: "Dr. Jamal Okonkwo",
    specialization: "Internal Medicine",
    hospital: "Harborview Medical Center",
    phone: "+1 206-555-0175",
    email: "jamal.okonkwo@harborview.health",
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

  const doctorCount = await Doctor.countDocuments();
  if (doctorCount > 0) {
    console.log("[seed] Data already present — skipping sample doctors/patients");
    return {
      adminEmail: email,
      adminPassword: password,
      seededFresh: false,
    };
  }

  const doctors = await Doctor.insertMany(doctorsSeed);

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
      createdAt: daysAgo(index % 28),
      updatedAt: daysAgo(index % 28),
    };
  });

  await Patient.insertMany(patients);

  console.log(`[seed] Created ${doctors.length} doctors and ${patients.length} patients`);
  return {
    adminEmail: email,
    adminPassword: password,
    seededFresh: true,
  };
}

// Allow `npm run seed` once the server DB is already connected elsewhere.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Run seed through the API server start (SEED_ON_START=true).");
}
