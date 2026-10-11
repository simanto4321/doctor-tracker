import { Patient } from "../models/Patient.js";
import { Visit } from "../models/Visit.js";
import { Vital } from "../models/Vital.js";
import { LabResult } from "../models/LabResult.js";

export async function summarizePatientNotes(patientId: string) {
  const patient = await Patient.findOne({ _id: patientId, deletedAt: null })
    .populate("doctor", "name specialization")
    .lean();
  if (!patient) return null;

  const [visits, vitals, labs] = await Promise.all([
    Visit.find({ patient: patientId, deletedAt: null }).sort({ visitedAt: -1 }).limit(8).lean(),
    Vital.find({ patient: patientId, deletedAt: null }).sort({ recordedAt: -1 }).limit(5).lean(),
    LabResult.find({ patient: patientId, deletedAt: null }).sort({ collectedAt: -1 }).limit(5).lean(),
  ]);

  const doctorName =
    patient.doctor && typeof patient.doctor === "object" && "name" in patient.doctor
      ? String((patient.doctor as { name: string }).name)
      : "Unassigned";

  const visitLines = visits.map((v, i) => {
    const follow = v.followUpAt ? `; follow-up ${new Date(v.followUpAt).toLocaleDateString()}` : "";
    return `${i + 1}. ${new Date(v.visitedAt).toLocaleDateString()} — ${v.diagnosis}. ${v.treatment || "No treatment noted."}${v.notes ? ` Notes: ${v.notes}` : ""}${follow}`;
  });

  const latestVital = vitals[0];
  const vitalLine = latestVital
    ? `Latest vitals (${new Date(latestVital.recordedAt).toLocaleDateString()}): BP ${latestVital.bloodPressureSys}/${latestVital.bloodPressureDia}, HR ${latestVital.heartRate}, SpO₂ ${latestVital.spo2}%, temp ${latestVital.temperatureC}°C.`
    : "No recent vitals on file.";

  const abnormalLabs = labs.filter((l) => l.abnormal);
  const labLine =
    labs.length === 0
      ? "No recent labs."
      : abnormalLabs.length
        ? `Recent labs include ${abnormalLabs.length} abnormal result(s): ${abnormalLabs
            .map((l) => `${l.testName} ${l.value}${l.unit}`)
            .join(", ")}.`
        : `Recent labs (${labs.length}) are within reference ranges.`;

  const chartNote = patient.notes?.trim() ? `Chart note: ${patient.notes.trim()}` : "";

  const bullets = [
    `${patient.name} (${patient.age}y, ${patient.gender}) under ${doctorName} for ${patient.condition}.`,
    vitalLine,
    labLine,
    visits.length
      ? `Last ${visits.length} encounter(s) summarized below.`
      : "No visit encounters recorded yet.",
  ];

  if (chartNote) bullets.splice(1, 0, chartNote);

  const summary = [
    "Clinical summary (AI-assisted, local heuristic — not a medical diagnosis):",
    ...bullets.map((b) => `• ${b}`),
    "",
    "Recent notes / encounters:",
    ...(visitLines.length ? visitLines : ["• None"]),
    "",
    "Suggested focus: confirm open follow-ups, review abnormal labs/vitals, and align care plan with the assigned clinician.",
  ].join("\n");

  // Optional remote model — only if configured
  if (process.env.OPENAI_API_KEY && process.env.AI_SUMMARY_REMOTE === "true") {
    try {
      const remote = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Summarize clinical notes for a care-team handoff in 5-8 bullets. Do not invent facts.",
            },
            { role: "user", content: summary },
          ],
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (remote.ok) {
        const data = (await remote.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          return {
            patientId,
            mode: "remote" as const,
            summary: text,
            sources: {
              visits: visits.length,
              vitals: vitals.length,
              labs: labs.length,
            },
            generatedAt: new Date().toISOString(),
          };
        }
      }
    } catch {
      // fall through to local
    }
  }

  return {
    patientId,
    mode: "local" as const,
    summary,
    sources: {
      visits: visits.length,
      vitals: vitals.length,
      labs: labs.length,
      chartNotes: Boolean(patient.notes?.trim()),
    },
    generatedAt: new Date().toISOString(),
  };
}
