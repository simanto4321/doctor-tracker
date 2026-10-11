"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { FeatureTitle } from "@/components/ui/hover-info";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";

type SoftItem = {
  id: string;
  name: string;
  deletedAt?: string;
  specialization?: string;
  condition?: string;
};

export default function TrashPage() {
  const user = useAuthStore((s) => s.user);
  const [doctors, setDoctors] = useState<SoftItem[]>([]);
  const [patients, setPatients] = useState<SoftItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (user?.role !== "admin") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [doctorData, patientData] = await Promise.all([
        apiRequest<{ items: SoftItem[] }>("/doctors?includeDeleted=true&trashed=true&limit=50"),
        apiRequest<{ items: SoftItem[] }>("/patients?includeDeleted=true&trashed=true&limit=50"),
      ]);
      setDoctors(doctorData.items);
      setPatients(patientData.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load trash");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  async function restoreDoctor(id: string) {
    try {
      await apiRequest(`/doctors/${id}/restore`, { method: "POST" });
      toast.success("Doctor restored");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    }
  }

  async function restorePatient(id: string) {
    try {
      await apiRequest(`/patients/${id}/restore`, { method: "POST" });
      toast.success("Patient restored");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="trash"
        title="Trash"
        subtitle="Soft-deleted records. Admins can restore instead of permanent wipe."
      >
        {user?.role !== "admin" ? (
          <div className="panel p-6 text-[var(--muted)]">Admin access required.</div>
        ) : loading ? (
          <PageSkeleton />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="panel p-5">
              <FeatureTitle
                feature="trash"
                title="Deleted doctors"
                subtitle="Restoring a doctor does not auto-restore cascaded patients."
              />
              <div className="mt-4 space-y-2">
                {doctors.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Trash is empty.</p>
                ) : (
                  doctors.map((doctor) => (
                    <div
                      key={doctor.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold">{doctor.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {doctor.specialization} · deleted {formatDate(doctor.deletedAt)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => restoreDoctor(doctor.id)}>
                        Restore
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="panel p-5">
              <FeatureTitle
                feature="trash"
                title="Deleted patients"
                subtitle="Soft-deleted charts available for restore."
              />
              <div className="mt-4 space-y-2">
                {patients.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No deleted patients.</p>
                ) : (
                  patients.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold">{patient.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {patient.condition} · deleted {formatDate(patient.deletedAt)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => restorePatient(patient.id)}>
                        Restore
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
