"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import type { Appointment, Patient, Prescription, Visit } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type PatientDetail = Patient & {
  visits: Visit[];
  prescriptions: Prescription[];
  appointments: Appointment[];
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

  return (
    <AuthGuard>
      <AppShell
        title={patient?.name || "Patient"}
        subtitle="Chart overview with visits, prescriptions, and appointments."
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
                <p className="font-semibold">Log visit</p>
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

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="panel p-5">
                <h2 className="font-display text-xl">Visit history</h2>
                <div className="mt-3 space-y-2">
                  {(patient.visits || []).map((visit) => (
                    <div key={visit.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                      <p className="font-semibold">{visit.diagnosis}</p>
                      <p className="text-[var(--muted)]">{formatDate(visit.visitedAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel p-5">
                <h2 className="font-display text-xl">Prescriptions</h2>
                <div className="mt-3 space-y-2">
                  {(patient.prescriptions || []).map((rx) => (
                    <div key={rx.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                      <p className="font-semibold">{rx.medication}</p>
                      <p className="text-[var(--muted)]">
                        {rx.dosage} · {rx.frequency}
                      </p>
                      <Badge tone={rx.status === "refill_due" ? "warning" : "accent"}>{rx.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel p-5">
                <h2 className="font-display text-xl">Appointments</h2>
                <div className="mt-3 space-y-2">
                  {(patient.appointments || []).map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                      <p className="font-semibold">{new Date(item.startsAt).toLocaleString()}</p>
                      <p className="text-[var(--muted)]">{item.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    </AuthGuard>
  );
}
