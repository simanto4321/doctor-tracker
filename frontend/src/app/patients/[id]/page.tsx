"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { EntityHover } from "@/components/entity-hover";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeatureTitle } from "@/components/ui/hover-info";
import { Input, Textarea } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import type {
  Appointment,
  ConditionEvent,
  DocumentMeta,
  LabResult,
  Patient,
  Prescription,
  Referral,
  TimelineNote,
  Visit,
  Vital,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

type PatientDetail = Patient & {
  visits: Visit[];
  prescriptions: Prescription[];
  appointments: Appointment[];
  labs?: LabResult[];
  vitals?: Vital[];
  conditionHistory?: ConditionEvent[];
  documents?: DocumentMeta[];
  referrals?: Referral[];
  notesTimeline?: TimelineNote[];
};

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visitForm, setVisitForm] = useState({
    diagnosis: "",
    treatment: "",
    notes: "",
    followUpAt: "",
  });

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<PatientDetail>(`/patients/${params.id}`);
      setPatient(data);
      setVisitForm((f) => ({ ...f, diagnosis: data.condition }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patient");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function addVisit(event: FormEvent) {
    event.preventDefault();
    if (!patient) return;
    const doctorId =
      patient.doctor && typeof patient.doctor === "object"
        ? String(patient.doctor.id || patient.doctor._id)
        : patient.doctorId || "";
    try {
      await apiRequest("/visits", {
        method: "POST",
        body: {
          doctor: doctorId,
          patient: patient.id,
          visitedAt: new Date().toISOString(),
          ...visitForm,
          followUpAt: visitForm.followUpAt || null,
        },
      });
      toast.success("Visit recorded");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save visit");
    }
  }

  const doctorName =
    patient?.doctor && typeof patient.doctor === "object" ? patient.doctor.name : "Unassigned";

  const vitalTrend = useMemo(
    () =>
      [...(patient?.vitals || [])]
        .reverse()
        .map((v) => ({
          label: formatDate(v.recordedAt),
          hr: v.heartRate,
          sys: v.bloodPressureSys,
          dia: v.bloodPressureDia,
        })),
    [patient?.vitals]
  );

  return (
    <AuthGuard>
      <AppShell
        feature="patients"
        title={patient?.name || "Patient"}
        subtitle="Chart with notes timeline, conditions, vitals, labs, and visits."
        action={
          <Link href="/patients" className="text-sm font-semibold text-[var(--accent-strong)]">
            ← Back to patients
          </Link>
        }
      >
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-[var(--danger)]">
            {error}
          </div>
        ) : patient ? (
          <div className="space-y-6">
            <div className="panel grid gap-4 p-5 md:grid-cols-3">
              <div className="md:col-span-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info">{patient.condition}</Badge>
                  <Badge
                    tone={
                      patient.riskFlag === "high"
                        ? "danger"
                        : patient.riskFlag === "medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    Risk: {patient.riskFlag || "none"}
                  </Badge>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {patient.age} yrs · {patient.gender} · Doctor: {doctorName}
                </p>
                <p className="text-sm">{patient.notes || "No clinical notes yet."}</p>
                <p className="text-sm text-[var(--muted)]">
                  {patient.email} · {patient.phone}
                </p>
              </div>
              <form className="space-y-2 rounded-2xl bg-[var(--surface-soft)] p-4" onSubmit={addVisit}>
                <p className="font-semibold">Log visit / encounter</p>
                <Input
                  required
                  placeholder="Diagnosis"
                  value={visitForm.diagnosis}
                  onChange={(e) => setVisitForm((f) => ({ ...f, diagnosis: e.target.value }))}
                />
                <Input
                  placeholder="Treatment"
                  value={visitForm.treatment}
                  onChange={(e) => setVisitForm((f) => ({ ...f, treatment: e.target.value }))}
                />
                <Input
                  type="date"
                  value={visitForm.followUpAt}
                  onChange={(e) => setVisitForm((f) => ({ ...f, followUpAt: e.target.value }))}
                />
                <Textarea
                  placeholder="Notes"
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <Button className="w-full" size="sm">
                  Save visit
                </Button>
              </form>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div className="panel p-5">
                <FeatureTitle
                  feature="patients"
                  title="Notes timeline"
                  subtitle="Visits, condition changes, and labs in one stream."
                />
                <div className="mt-4 space-y-3">
                  {(patient.notesTimeline || []).length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No timeline events yet.</p>
                  ) : (
                    patient.notesTimeline!.map((note) => (
                      <EntityHover
                        key={`${note.type}-${note.id}`}
                        title={note.title}
                        badge={note.type}
                        lines={[
                          { label: "When", value: formatDate(note.at) },
                          { label: "Type", value: note.type },
                          { label: "Detail", value: note.detail || "—" },
                        ]}
                      >
                        <div className="relative rounded-xl border border-[var(--border)] px-3 py-3 pl-4">
                          <span className="absolute left-0 top-3 h-8 w-1 rounded-full bg-[var(--accent)]" />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold underline decoration-dotted">{note.title}</p>
                            <Badge tone="neutral">{note.type}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(note.at)}</p>
                          {note.detail ? (
                            <p className="mt-1 text-sm text-[var(--muted)]">{note.detail}</p>
                          ) : null}
                        </div>
                      </EntityHover>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="panel p-5">
                  <FeatureTitle feature="patients" title="Vitals trend" subtitle="Heart rate and blood pressure." />
                  <div className="mt-4 h-56">
                    {vitalTrend.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">No vitals recorded.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={vitalTrend}>
                          <CartesianGrid stroke="#d7e5df" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5d746d" }} />
                          <YAxis tick={{ fontSize: 10, fill: "#5d746d" }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="hr" name="HR" stroke="#0f766e" strokeWidth={2} />
                          <Line type="monotone" dataKey="sys" name="Systolic" stroke="#1d4f78" strokeWidth={2} />
                          <Line type="monotone" dataKey="dia" name="Diastolic" stroke="#64748b" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {(patient.vitals || []).slice(0, 4).map((vital) => (
                      <EntityHover
                        key={vital.id}
                        title={`Vitals · ${formatDate(vital.recordedAt)}`}
                        lines={[
                          {
                            label: "BP",
                            value: `${vital.bloodPressureSys}/${vital.bloodPressureDia}`,
                          },
                          { label: "HR", value: `${vital.heartRate} bpm` },
                          { label: "Temp", value: `${vital.temperatureC}°C` },
                          { label: "SpO₂", value: `${vital.spo2}%` },
                          {
                            label: "Weight",
                            value: vital.weightKg != null ? `${vital.weightKg} kg` : "—",
                          },
                        ]}
                      >
                        <div className="flex justify-between rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs">
                          <span className="underline decoration-dotted">{formatDate(vital.recordedAt)}</span>
                          <span>
                            {vital.bloodPressureSys}/{vital.bloodPressureDia} · {vital.heartRate}{" "}
                            bpm
                          </span>
                        </div>
                      </EntityHover>
                    ))}
                  </div>
                </div>

                <div className="panel p-5">
                  <FeatureTitle feature="labs" title="Lab results" subtitle="Abnormal flags highlighted." />
                  <div className="mt-3 space-y-2">
                    {(patient.labs || []).length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">No labs on file.</p>
                    ) : (
                      patient.labs!.map((lab) => (
                        <EntityHover
                          key={lab.id}
                          title={lab.testName}
                          badge={lab.abnormal ? "Abnormal" : "OK"}
                          lines={[
                            { label: "Value", value: `${lab.value} ${lab.unit}` },
                            { label: "Range", value: `${lab.refLow}–${lab.refHigh}` },
                            { label: "Collected", value: formatDate(lab.collectedAt) },
                          ]}
                        >
                          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                            <span className="font-semibold underline decoration-dotted">{lab.testName}</span>
                            <Badge tone={lab.abnormal ? "danger" : "success"}>
                              {lab.value} {lab.unit}
                            </Badge>
                          </div>
                        </EntityHover>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="panel p-5">
                <FeatureTitle feature="patients" title="Condition history" />
                <div className="mt-3 space-y-2">
                  {(patient.conditionHistory || []).map((event) => (
                    <div key={event.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                      <p className="font-semibold">
                        {event.condition} · {event.status}
                      </p>
                      <p className="text-[var(--muted)]">{formatDate(event.recordedAt)}</p>
                      {event.note ? <p className="text-xs text-[var(--muted)]">{event.note}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel p-5">
                <FeatureTitle feature="prescriptions" title="Prescriptions" />
                <div className="mt-3 space-y-2">
                  {(patient.prescriptions || []).map((rx) => (
                    <EntityHover
                      key={rx.id}
                      title={rx.medication}
                      badge={rx.status}
                      lines={[
                        { label: "Dosage", value: rx.dosage },
                        { label: "Frequency", value: rx.frequency },
                        { label: "Status", value: rx.status },
                      ]}
                    >
                      <div className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                        <p className="font-semibold underline decoration-dotted">{rx.medication}</p>
                        <p className="text-[var(--muted)]">
                          {rx.dosage} · {rx.frequency}
                        </p>
                        <Badge tone={rx.status === "refill_due" ? "warning" : "accent"}>{rx.status}</Badge>
                      </div>
                    </EntityHover>
                  ))}
                </div>
              </div>
              <div className="panel p-5">
                <FeatureTitle feature="appointments" title="Visits & appointments" />
                <div className="mt-3 space-y-2">
                  {(patient.visits || []).slice(0, 5).map((visit) => (
                    <div key={visit.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                      <p className="font-semibold">{visit.diagnosis}</p>
                      <p className="text-[var(--muted)]">
                        {formatDate(visit.visitedAt)}
                        {visit.followUpAt ? ` · follow-up ${formatDate(visit.followUpAt)}` : ""}
                      </p>
                    </div>
                  ))}
                  {(patient.appointments || []).slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                      <p className="font-semibold">{new Date(item.startsAt).toLocaleString()}</p>
                      <p className="text-[var(--muted)]">{item.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="panel p-5">
                <FeatureTitle feature="referrals" title="Referrals" />
                <div className="mt-3 space-y-2">
                  {(patient.referrals || []).length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No referrals.</p>
                  ) : (
                    patient.referrals!.map((ref) => (
                      <div key={ref.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                        <p className="font-semibold">{ref.reason}</p>
                        <p className="text-[var(--muted)]">
                          {typeof ref.fromDoctor === "object" ? ref.fromDoctor?.name : "—"} →{" "}
                          {typeof ref.toDoctor === "object" ? ref.toDoctor?.name : "—"} · {ref.status}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="panel p-5">
                <FeatureTitle feature="documents" title="Documents" />
                <div className="mt-3 space-y-2">
                  {(patient.documents || []).length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No documents uploaded.</p>
                  ) : (
                    patient.documents!.map((doc) => (
                      <div key={doc.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                        <p className="font-semibold">{doc.title}</p>
                        <p className="text-[var(--muted)]">
                          {doc.category} · {doc.fileName || "file"} · {formatDate(doc.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    </AuthGuard>
  );
}
