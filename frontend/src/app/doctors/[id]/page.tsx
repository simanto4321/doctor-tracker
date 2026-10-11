"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { DoctorPhoto } from "@/components/doctor-photo";
import { EntityHover } from "@/components/entity-hover";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { FeatureTitle } from "@/components/ui/hover-info";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import type { Appointment, Doctor, Patient, Visit } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type DoctorDetail = Doctor & {
  patients: Patient[];
  visits: Visit[];
  upcomingAppointments: Appointment[];
  caseloadTrend?: Array<{ month: string; patients: number }>;
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
        feature="doctors"
        title={doctor?.name || "Doctor"}
        subtitle="Profile, caseload trend, patient history, and schedule."
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
                <div className="flex flex-wrap items-start gap-4">
                  <DoctorPhoto name={doctor.name} photoUrl={doctor.photoUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{doctor.specialization}</Badge>
                      {doctor.department ? <Badge tone="neutral">{doctor.department}</Badge> : null}
                    </div>
                    {doctor.title ? (
                      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{doctor.title}</p>
                    ) : null}
                    {doctor.degrees ? (
                      <p className="text-sm text-[var(--muted)]">{doctor.degrees}</p>
                    ) : null}
                    <p className="mt-3 text-[var(--muted)]">{doctor.bio || "No bio added yet."}</p>
                  </div>
                </div>
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
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Working hours: {doctor.workingHours || "Not set"}
                </p>
              </div>
            </div>

            <div className="panel p-5">
              <FeatureTitle
                feature="doctors"
                title="Caseload chart"
                subtitle="Patients assigned by intake month."
              />
              <div className="mt-4 h-64">
                {(doctor.caseloadTrend || []).length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No caseload trend yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={doctor.caseloadTrend}>
                      <defs>
                        <linearGradient id="caseloadFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#d7e5df" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5d746d" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5d746d" }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="patients"
                        stroke="#0f766e"
                        fill="url(#caseloadFill)"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="panel p-5">
                <FeatureTitle feature="patients" title="Patients" subtitle="Hover a name for chart basics." />
                <div className="mt-4 space-y-2">
                  {(doctor.patients || []).map((patient) => (
                    <EntityHover
                      key={patient.id}
                      href={`/patients/${patient.id}`}
                      title={patient.name}
                      badge={patient.riskFlag || "none"}
                      lines={[
                        { label: "Condition", value: patient.condition },
                        { label: "Age", value: `${patient.age} yrs` },
                        { label: "Gender", value: patient.gender },
                        { label: "Phone", value: patient.phone },
                      ]}
                    >
                      <div className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-soft)]">
                        <span className="font-semibold underline decoration-dotted">{patient.name}</span>
                        <Badge tone="info">{patient.condition}</Badge>
                      </div>
                    </EntityHover>
                  ))}
                </div>
              </div>
              <div className="panel p-5">
                <FeatureTitle
                  feature="appointments"
                  title="Upcoming appointments"
                  subtitle="Next scheduled visits for this clinician."
                />
                <div className="mt-4 space-y-2">
                  {(doctor.upcomingAppointments || []).length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No upcoming appointments.</p>
                  ) : (
                    doctor.upcomingAppointments.map((item) => (
                      <EntityHover
                        key={item.id}
                        title={
                          typeof item.patient === "object"
                            ? item.patient?.name || "Patient"
                            : "Patient"
                        }
                        badge={item.status}
                        lines={[
                          { label: "When", value: new Date(item.startsAt).toLocaleString() },
                          { label: "Reason", value: item.reason || "Visit" },
                          { label: "Status", value: item.status },
                        ]}
                      >
                        <div className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                          <p className="font-semibold underline decoration-dotted">
                            {typeof item.patient === "object" ? item.patient?.name : "Patient"}
                          </p>
                          <p className="text-[var(--muted)]">
                            {new Date(item.startsAt).toLocaleString()} · {item.status}
                          </p>
                        </div>
                      </EntityHover>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="panel p-5">
              <FeatureTitle feature="appointments" title="Recent visits" subtitle="Encounter records with diagnosis and follow-up." />
              <div className="mt-4 space-y-2">
                {(doctor.visits || []).map((visit) => (
                  <EntityHover
                    key={visit.id}
                    title={visit.diagnosis}
                    badge={visit.followUpAt ? "Follow-up" : "Visit"}
                    lines={[
                      { label: "Date", value: formatDate(visit.visitedAt) },
                      {
                        label: "Patient",
                        value: typeof visit.patient === "object" ? visit.patient?.name || "—" : "—",
                      },
                      { label: "Treatment", value: visit.treatment || "—" },
                      {
                        label: "Follow-up",
                        value: visit.followUpAt ? formatDate(visit.followUpAt) : "None",
                      },
                    ]}
                  >
                    <div className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold underline decoration-dotted">{visit.diagnosis}</p>
                        <span className="text-[var(--muted)]">{formatDate(visit.visitedAt)}</span>
                      </div>
                      <p className="text-[var(--muted)]">
                        {typeof visit.patient === "object" ? visit.patient?.name : "Patient"} ·{" "}
                        {visit.treatment || "No treatment notes"}
                      </p>
                    </div>
                  </EntityHover>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    </AuthGuard>
  );
}
