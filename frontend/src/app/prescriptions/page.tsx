"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { EntityHover } from "@/components/entity-hover";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import { toLocalDateInput } from "@/lib/datetime";
import type { Pagination, Prescription } from "@/lib/types";

export default function PrescriptionsPage() {
  const [items, setItems] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    doctor: "",
    patient: "",
    medication: "",
    dosage: "",
    frequency: "Once daily",
    startDate: toLocalDateInput(new Date()),
    status: "active",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Prescription[]; pagination: Pagination }>(
        `/prescriptions${toQuery({ status, limit: 40 })}`
      );
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const [doctorMeta, patientMeta] = await Promise.all([
        apiRequest<{ items: Array<{ id: string; name: string }> }>("/doctors?limit=50"),
        apiRequest<{ items: Array<{ id: string; name: string }> }>("/patients?limit=50"),
      ]);
      setDoctors(doctorMeta.items);
      setPatients(patientMeta.items);
      setForm((f) => ({
        ...f,
        doctor: doctorMeta.items[0]?.id || "",
        patient: patientMeta.items[0]?.id || "",
      }));
    })().catch(() => undefined);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/prescriptions", { method: "POST", body: form });
      toast.success("Prescription added");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save prescription");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="prescriptions"
        title="Prescriptions"
        subtitle="Track active meds and refill-due alerts."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add prescription
          </Button>
        }
      >
        <div className="panel mb-5 max-w-sm p-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Status
            </span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="refill_due">Refill due</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </label>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            title="No prescriptions"
            description="Add a medication order for a patient to begin tracking."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Dose</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((rx) => (
                  <tr key={rx.id}>
                    <td>
                      <EntityHover
                        title={rx.medication}
                        badge={rx.status}
                        lines={[
                          {
                            label: "Patient",
                            value: typeof rx.patient === "object" ? rx.patient?.name || "—" : "—",
                          },
                          {
                            label: "Doctor",
                            value: typeof rx.doctor === "object" ? rx.doctor?.name || "—" : "—",
                          },
                          { label: "Dosage", value: rx.dosage },
                          { label: "Frequency", value: rx.frequency },
                          { label: "Status", value: rx.status },
                        ]}
                      >
                        <span className="font-semibold underline decoration-dotted">
                          {rx.medication}
                        </span>
                      </EntityHover>
                    </td>
                    <td>{typeof rx.patient === "object" ? rx.patient?.name : "—"}</td>
                    <td>{typeof rx.doctor === "object" ? rx.doctor?.name : "—"}</td>
                    <td className="text-sm text-[var(--muted)]">
                      {rx.dosage} · {rx.frequency}
                    </td>
                    <td>
                      <Badge tone={rx.status === "refill_due" ? "warning" : "accent"}>{rx.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Add prescription">
          <form className="grid gap-3" onSubmit={onCreate}>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Doctor</span>
              <Select
                value={form.doctor}
                onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))}
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Patient</span>
              <Select
                value={form.patient}
                onChange={(e) => setForm((f) => ({ ...f, patient: e.target.value }))}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Medication</span>
              <Input
                required
                value={form.medication}
                onChange={(e) => setForm((f) => ({ ...f, medication: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Dosage</span>
                <Input
                  required
                  value={form.dosage}
                  onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Frequency</span>
                <Input
                  required
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                />
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Start date</span>
              <Input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button>Save</Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
