import { Router } from "express";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { requireAuth } from "../middleware/auth.js";

export const fhirRouter = Router();
fhirRouter.use(requireAuth);

function practitionerResource(doctor: {
  _id: unknown;
  name: string;
  specialization?: string;
  hospital?: string;
  phone?: string;
  email?: string;
}) {
  return {
    resourceType: "Practitioner",
    id: String(doctor._id),
    active: true,
    name: [{ text: doctor.name }],
    telecom: [
      doctor.phone ? { system: "phone", value: doctor.phone } : null,
      doctor.email ? { system: "email", value: doctor.email } : null,
    ].filter(Boolean),
    qualification: doctor.specialization
      ? [{ code: { text: doctor.specialization } }]
      : [],
    extension: doctor.hospital
      ? [{ url: "http://doctortracker.local/fhir/StructureDefinition/hospital", valueString: doctor.hospital }]
      : [],
  };
}

function patientResource(patient: {
  _id: unknown;
  name: string;
  age?: number;
  gender?: string;
  phone?: string;
  email?: string;
  condition?: string;
  doctor?: unknown;
}) {
  const birthYear =
    typeof patient.age === "number" ? new Date().getFullYear() - patient.age : undefined;
  return {
    resourceType: "Patient",
    id: String(patient._id),
    active: true,
    name: [{ text: patient.name }],
    gender: patient.gender === "other" ? "other" : patient.gender || "unknown",
    birthDate: birthYear ? `${birthYear}-01-01` : undefined,
    telecom: [
      patient.phone ? { system: "phone", value: patient.phone } : null,
      patient.email ? { system: "email", value: patient.email } : null,
    ].filter(Boolean),
    generalPractitioner: patient.doctor
      ? [{ reference: `Practitioner/${String(patient.doctor)}` }]
      : [],
    extension: patient.condition
      ? [
          {
            url: "http://doctortracker.local/fhir/StructureDefinition/condition-summary",
            valueString: patient.condition,
          },
        ]
      : [],
  };
}

fhirRouter.get("/Practitioner", async (_req, res) => {
  const doctors = await Doctor.find({ deletedAt: null }).limit(100).lean();
  return res.json({
    resourceType: "Bundle",
    type: "searchset",
    total: doctors.length,
    entry: doctors.map((doctor) => ({ fullUrl: `Practitioner/${doctor._id}`, resource: practitionerResource(doctor) })),
  });
});

fhirRouter.get("/Patient", async (_req, res) => {
  const patients = await Patient.find({ deletedAt: null }).limit(100).lean();
  return res.json({
    resourceType: "Bundle",
    type: "searchset",
    total: patients.length,
    entry: patients.map((patient) => ({
      fullUrl: `Patient/${patient._id}`,
      resource: patientResource(patient),
    })),
  });
});

fhirRouter.get("/Bundle/$export", async (_req, res) => {
  const [doctors, patients] = await Promise.all([
    Doctor.find({ deletedAt: null }).limit(100).lean(),
    Patient.find({ deletedAt: null }).limit(200).lean(),
  ]);

  return res.json({
    resourceType: "Bundle",
    type: "collection",
    id: `doctor-tracker-export-${Date.now()}`,
    timestamp: new Date().toISOString(),
    meta: {
      tag: [{ system: "http://doctortracker.local/fhir", code: "fhir-lite" }],
    },
    total: doctors.length + patients.length,
    entry: [
      ...doctors.map((doctor) => ({
        fullUrl: `urn:uuid:practitioner-${doctor._id}`,
        resource: practitionerResource(doctor),
      })),
      ...patients.map((patient) => ({
        fullUrl: `urn:uuid:patient-${patient._id}`,
        resource: patientResource(patient),
      })),
    ],
  });
});
