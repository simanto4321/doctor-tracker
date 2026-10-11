"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import type { Appointment, Doctor, Patient, Visit } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type DoctorDetail = Doctor & {
  patients: Patient[];
  visits: Visit[];
  upcomingAppointments: Appointment[];
};

export default function DoctorDetailPage() {
  const params = useParams<{ id: string }>();
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiRequest<DoctorDetail>(`/doctors/${params.id}`);
        if (active) setDoctor(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load doctor");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <AuthGuard>
      <AppShell
        title={doctor?.name || "Doctor"}
        subtitle="Profile, caseload, upcoming appointments, and recent visits."
        action={
          <Link href="/doctors" className="text-sm font-semibold text-[var(--accent-strong)]">
            ← Back to doctors
          </Link>
        }
      >
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-[var(--danger)]">
            {error}
          </div>
        ) : doctor ? (
          <div className="space-y-6">
            <div className="panel grid gap-4 p-5 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{doctor.specialization}</Badge>
                  {doctor.department ? <Badge tone="neutral">{doctor.department}</Badge> : null}
                </div>
                <p className="mt-3 text-[var(--muted)]">{doctor.bio || "No bio added yet."}</p>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-[var(--muted)]">Hospital:</span> {doctor.hospital}
                  </p>
                  <p>
                    <span className="text-[var(--muted)]">Hours:</span>{" "}
                    {doctor.workingHours || "—"}
                  </p>
                  <p>
                    <span className="text-[var(--muted)]">Email:</span> {doctor.email}
                  </p>
                  <p>
                    <span className="text-[var(--muted)]">Phone:</span> {doctor.phone}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--accent-soft)] p-4">
                <p className="text-sm text-[var(--muted)]">Active patients</p>
                <p className="font-display text-4xl text-[var(--accent-strong)]">
                  {doctor.patients?.length || 0}
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="panel p-5">
                <h2 className="font-display text-xl">Patients</h2>
                <div className="mt-4 space-y-2">
                  {(doctor.patients || []).map((patient) => (
                    <Link
                      key={patient.id}
                      href={`/patients/${patient.id}`}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-soft)]"
                    >
                      <span className="font-semibold">{patient.name}</span>
                      <Badge tone="info">{patient.condition}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="panel p-5">
                <h2 className="font-display text-xl">Upcoming appointments</h2>
                <div className="mt-4 space-y-2">
                  {(doctor.upcomingAppointments || []).length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No upcoming appointments.</p>
                  ) : (
                    doctor.upcomingAppointments.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                      >
                        <p className="font-semibold">
                          {typeof item.patient === "object" ? item.patient?.name : "Patient"}
                        </p>
                        <p className="text-[var(--muted)]">
                          {new Date(item.startsAt).toLocaleString()} · {item.status}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="font-display text-xl">Recent visits</h2>
              <div className="mt-4 space-y-2">
                {(doctor.visits || []).map((visit) => (
                  <div
                    key={visit.id}
                    className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{visit.diagnosis}</p>
                      <span className="text-[var(--muted)]">{formatDate(visit.visitedAt)}</span>
                    </div>
                    <p className="text-[var(--muted)]">
                      {typeof visit.patient === "object" ? visit.patient?.name : "Patient"} ·{" "}
                      {visit.treatment || "No treatment notes"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    </AuthGuard>
  );
}
