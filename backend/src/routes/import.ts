import { Router } from "express";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { Notification } from "../models/Notification.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { writeAudit } from "../utils/audit.js";

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return { headers: [] as string[], rows: [] as Array<Record<string, string>> };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });
    return row;
  });
  return { headers, rows };
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export const importRouter = Router();
importRouter.use(requireAuth, requireRole("admin", "receptionist"));

importRouter.post("/doctors", async (req, res) => {
  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  const { rows } = parseCsv(csv);
  if (!rows.length) return res.status(400).json({ message: "CSV must include a header and at least one row" });

  let created = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      const payload = {
        name: row.name || row.fullname || "",
        specialization: row.specialization || row.specialty || "",
        hospital: row.hospital || "",
        department: row.department || "",
        phone: row.phone || "",
        email: (row.email || "").toLowerCase(),
        workingHours: row.workinghours || row.working_hours || "Mon–Fri 09:00–17:00",
        bio: row.bio || "",
      };
      if (!payload.name || !payload.specialization || !payload.hospital || !payload.phone || !payload.email) {
        errors.push(`Row ${index + 2}: missing required fields`);
        continue;
      }
      await Doctor.create(payload);
      created += 1;
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  await writeAudit(req.auth, "import", "doctor", "", { created, errors: errors.length });
  await Notification.create({
    title: "Doctor CSV import",
    body: `Imported ${created} doctors${errors.length ? `, ${errors.length} failed` : ""}.`,
    type: "success",
    href: "/doctors",
  });

  return res.json({ created, failed: errors.length, errors: errors.slice(0, 20) });
});

importRouter.post("/patients", async (req, res) => {
  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  const { rows } = parseCsv(csv);
  if (!rows.length) return res.status(400).json({ message: "CSV must include a header and at least one row" });

  let created = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      const doctorEmail = (row.doctoremail || row.doctor_email || "").toLowerCase();
      const doctorName = row.doctor || row.doctorname || "";
      const doctor = doctorEmail
        ? await Doctor.findOne({ email: doctorEmail, deletedAt: null })
        : await Doctor.findOne({ name: new RegExp(`^${doctorName}$`, "i"), deletedAt: null });

      if (!doctor) {
        errors.push(`Row ${index + 2}: doctor not found`);
        continue;
      }

      const payload = {
        name: row.name || "",
        age: Number(row.age),
        gender: (row.gender || "other").toLowerCase(),
        condition: row.condition || "",
        phone: row.phone || "",
        email: (row.email || "").toLowerCase(),
        notes: row.notes || "Imported via CSV",
        riskFlag: (row.riskflag || row.risk_flag || "none").toLowerCase(),
        doctor: doctor._id,
      };

      if (
        !payload.name ||
        Number.isNaN(payload.age) ||
        !["male", "female", "other"].includes(payload.gender) ||
        !payload.condition ||
        !payload.phone ||
        !payload.email
      ) {
        errors.push(`Row ${index + 2}: invalid patient fields`);
        continue;
      }

      await Patient.create(payload);
      created += 1;
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  await writeAudit(req.auth, "import", "patient", "", { created, errors: errors.length });
  await Notification.create({
    title: "Patient CSV import",
    body: `Imported ${created} patients${errors.length ? `, ${errors.length} failed` : ""}.`,
    type: "info",
    href: "/patients",
  });

  return res.json({ created, failed: errors.length, errors: errors.slice(0, 20) });
});
