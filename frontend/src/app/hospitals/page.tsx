"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { EntityHover } from "@/components/entity-hover";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

type Hospital = {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  departments?: string[];
  bedCount?: number;
  doctorCount?: number;
  patientCount?: number;
};

export default function HospitalsPage() {
  const [items, setItems] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Hospital | null>(null);
  const [doctors, setDoctors] = useState<
    Array<{ id: string; name: string; specialization: string; department?: string; workingHours?: string }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest<{ items: Hospital[] }>("/hospitals");
        setItems(data.items);
        if (data.items[0]) {
          setSelected(data.items[0]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load hospitals");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    apiRequest<{ doctors: typeof doctors }>(`/hospitals/${selected.id}`)
      .then((data) => setDoctors(data.doctors || []))
      .catch(() => setDoctors([]));
  }, [selected]);

  return (
    <AuthGuard>
      <AppShell
        feature="hospitals"
        title="Hospitals"
        subtitle="Multi-hospital network with departments, staffing, and availability."
      >
        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              {items.map((hospital) => (
                <button
                  key={hospital.id}
                  onClick={() => setSelected(hospital)}
                  className={`panel w-full p-4 text-left transition ${
                    selected?.id === hospital.id ? "ring-2 ring-[var(--accent)]" : ""
                  }`}
                >
                  <EntityHover
                    title={hospital.name}
                    badge={hospital.city}
                    lines={[
                      { label: "Doctors", value: String(hospital.doctorCount || 0) },
                      { label: "Patients", value: String(hospital.patientCount || 0) },
                      { label: "Beds", value: String(hospital.bedCount || 0) },
                      {
                        label: "Departments",
                        value: (hospital.departments || []).slice(0, 3).join(", ") || "—",
                      },
                    ]}
                  >
                    <div>
                      <p className="font-semibold underline decoration-dotted">{hospital.name}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {hospital.city} · {hospital.phone || "No phone"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="accent">{hospital.doctorCount || 0} doctors</Badge>
                        <Badge tone="neutral">{hospital.patientCount || 0} patients</Badge>
                      </div>
                    </div>
                  </EntityHover>
                </button>
              ))}
            </div>

            <div className="panel p-5">
              {selected ? (
                <>
                  <h2 className="font-display text-2xl">{selected.name}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {selected.address || selected.city}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selected.departments || []).map((dept) => (
                      <Badge key={dept} tone="info">
                        {dept}
                      </Badge>
                    ))}
                  </div>
                  <h3 className="mt-6 font-semibold">Staff & availability</h3>
                  <div className="mt-3 space-y-2">
                    {doctors.map((doctor) => (
                      <EntityHover
                        key={doctor.id}
                        href={`/doctors/${doctor.id}`}
                        title={doctor.name}
                        badge={doctor.specialization}
                        lines={[
                          { label: "Department", value: doctor.department || "—" },
                          { label: "Hours", value: doctor.workingHours || "—" },
                          { label: "Specialty", value: doctor.specialization },
                        ]}
                      >
                        <div className="rounded-xl border border-[var(--border)] px-3 py-2">
                          <p className="font-semibold underline decoration-dotted">{doctor.name}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {doctor.specialization}
                            {doctor.department ? ` · ${doctor.department}` : ""}
                          </p>
                          <p className="text-xs text-[var(--accent-strong)]">
                            {doctor.workingHours || "Hours not set"}
                          </p>
                        </div>
                      </EntityHover>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[var(--muted)]">Select a hospital</p>
              )}
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
