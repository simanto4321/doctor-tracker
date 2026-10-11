import { Patient } from "../models/Patient.js";
import { Visit } from "../models/Visit.js";
import { Vital } from "../models/Vital.js";

export type RiskAlert = {
  code: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  source: "vitals" | "visit" | "condition" | "lab";
};

function overallFromAlerts(alerts: RiskAlert[]): "none" | "low" | "medium" | "high" {
  if (alerts.some((a) => a.severity === "high")) return "high";
  if (alerts.some((a) => a.severity === "medium")) return "medium";
  if (alerts.some((a) => a.severity === "low")) return "low";
  return "none";
}

export async function computePatientRiskFlags(patientId: string) {
  const patient = await Patient.findOne({ _id: patientId, deletedAt: null }).lean();
  if (!patient) return null;

  const [latestVital, visits] = await Promise.all([
    Vital.findOne({ patient: patientId, deletedAt: null }).sort({ recordedAt: -1 }).lean(),
    Visit.find({ patient: patientId, deletedAt: null }).sort({ visitedAt: -1 }).limit(20).lean(),
  ]);

  const alerts: RiskAlert[] = [];
  const now = Date.now();

  if (latestVital) {
    if (latestVital.bloodPressureSys >= 140 || latestVital.bloodPressureDia >= 90) {
      alerts.push({
        code: "high_bp",
        severity: latestVital.bloodPressureSys >= 160 || latestVital.bloodPressureDia >= 100 ? "high" : "medium",
        title: "High blood pressure",
        detail: `Latest BP ${latestVital.bloodPressureSys}/${latestVital.bloodPressureDia} mmHg on ${new Date(latestVital.recordedAt).toLocaleDateString()}.`,
        source: "vitals",
      });
    }
    if (latestVital.spo2 < 94) {
      alerts.push({
        code: "low_spo2",
        severity: latestVital.spo2 < 90 ? "high" : "medium",
        title: "Low oxygen saturation",
        detail: `SpO₂ ${latestVital.spo2}% — review respiratory status.`,
        source: "vitals",
      });
    }
  }

  const diabetesRelated = /diabetes|hba1c|glucose/i.test(patient.condition || "");
  const overdueFollowUp = visits.find(
    (v) => v.followUpAt && new Date(v.followUpAt).getTime() < now
  );
  if (diabetesRelated && overdueFollowUp) {
    alerts.push({
      code: "diabetes_followup_due",
      severity: "high",
      title: "Diabetes follow-up due",
      detail: `Follow-up from ${new Date(overdueFollowUp.visitedAt).toLocaleDateString()} was due ${new Date(overdueFollowUp.followUpAt!).toLocaleDateString()}.`,
      source: "visit",
    });
  } else if (overdueFollowUp) {
    alerts.push({
      code: "followup_due",
      severity: "medium",
      title: "Follow-up overdue",
      detail: `Visit follow-up was due ${new Date(overdueFollowUp.followUpAt!).toLocaleDateString()}.`,
      source: "visit",
    });
  } else if (diabetesRelated) {
    const upcoming = visits.find(
      (v) => v.followUpAt && new Date(v.followUpAt).getTime() >= now
    );
    if (!upcoming) {
      alerts.push({
        code: "diabetes_followup_plan",
        severity: "low",
        title: "Diabetes follow-up not scheduled",
        detail: "No upcoming follow-up on file for this diabetes-related condition.",
        source: "condition",
      });
    }
  }

  if (/hypertension/i.test(patient.condition || "") && !alerts.some((a) => a.code === "high_bp")) {
    alerts.push({
      code: "hypertension_monitor",
      severity: "low",
      title: "Hypertension monitoring",
      detail: "Known hypertension — confirm recent BP trend on next visit.",
      source: "condition",
    });
  }

  const overall = overallFromAlerts(alerts);
  if (patient.riskFlag !== overall) {
    await Patient.updateOne({ _id: patientId }, { riskFlag: overall });
  }

  return {
    patientId,
    overall,
    storedRiskFlag: overall,
    alerts,
    checkedAt: new Date().toISOString(),
  };
}
