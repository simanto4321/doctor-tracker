"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

type BedRow = {
  id: string;
  ward: string;
  bedNumber: string;
  status: "available" | "occupied" | "cleaning" | "reserved";
  patient?: { name: string; condition?: string } | null;
  hospitalName?: string;
};

type WardBlock = {
  hospitalId: string;
  hospitalName: string;
  ward: string;
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
  reserved: number;
  beds: BedRow[];
};

type Occupancy = {
  totals: {
    total: number;
    available: number;
    occupied: number;
    cleaning: number;
    reserved: number;
    occupancyRate: number;
  };
  wards: WardBlock[];
};

export default function WardsPage() {
  const [data, setData] = useState<Occupancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const occupancy = await apiRequest<Occupancy>("/beds/occupancy");
      setData(occupancy);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load occupancy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    apiRequest<{ items: Array<{ id: string; name: string }> }>("/patients?limit=50")
      .then((d) => setPatients(d.items))
      .catch(() => undefined);
  }, [load]);

  async function assign(bedId: string, patientId: string) {
    try {
      await apiRequest(`/beds/${bedId}`, {
        method: "PATCH",
        body: patientId
          ? { patient: patientId, status: "occupied" }
          : { patient: null, status: "cleaning" },
      });
      toast.success(patientId ? "Patient assigned" : "Bed cleared");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function setStatus(bedId: string, status: string) {
    try {
      await apiRequest(`/beds/${bedId}`, { method: "PATCH", body: { status } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  function tone(status: string) {
    if (status === "occupied") return "danger" as const;
    if (status === "available") return "success" as const;
    if (status === "cleaning") return "warning" as const;
    return "info" as const;
  }

  return (
    <AuthGuard>
      <AppShell
        feature="wards"
        title="Wards & beds"
        subtitle="Hospital bed occupancy by ward — admit, clear, and track availability."
      >
        {loading || !data ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Beds", data.totals.total],
                ["Occupied", data.totals.occupied],
                ["Available", data.totals.available],
                ["Cleaning", data.totals.cleaning],
                ["Occupancy", `${data.totals.occupancyRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="panel p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
                  <p className="mt-1 font-display text-2xl">{value}</p>
                </div>
              ))}
            </div>

            {data.wards.map((ward) => (
              <section key={`${ward.hospitalId}-${ward.ward}`} className="panel p-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl">{ward.ward}</h2>
                    <p className="text-sm text-[var(--muted)]">{ward.hospitalName}</p>
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    {ward.occupied}/{ward.total} occupied · {ward.available} free
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {ward.beds.map((bed) => (
                    <div key={bed.id} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{bed.bedNumber}</p>
                        <Badge tone={tone(bed.status)}>{bed.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {bed.patient?.name || "Empty"}
                        {bed.patient?.condition ? ` · ${bed.patient.condition}` : ""}
                      </p>
                      <Select
                        className="mt-2"
                        value={bed.status}
                        onChange={(e) => setStatus(bed.id, e.target.value)}
                      >
                        <option value="available">available</option>
                        <option value="occupied">occupied</option>
                        <option value="cleaning">cleaning</option>
                        <option value="reserved">reserved</option>
                      </Select>
                      <Select
                        className="mt-2"
                        defaultValue=""
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!value) return;
                          void assign(bed.id, value === "__clear__" ? "" : value);
                          e.target.value = "";
                        }}
                      >
                        <option value="">Assign / clear…</option>
                        <option value="__clear__">Clear bed</option>
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
