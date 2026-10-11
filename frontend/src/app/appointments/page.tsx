"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import type { Appointment, Pagination } from "@/lib/types";

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    doctor: "",
    patient: "",
    startsAt: "",
    endsAt: "",
    reason: "Consultation",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Appointment[]; pagination: Pagination }>(
        `/appointments${toQuery({ from, status, limit: 50 })}`
      );
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [from, status]);

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

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    items.forEach((item) => {
      const key = new Date(item.startsAt).toLocaleDateString();
      map.set(key, [...(map.get(key) || []), item]);
    });
    return Array.from(map.entries());
  }, [items]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      const startsAt = new Date(form.startsAt);
      const endsAt = form.endsAt
        ? new Date(form.endsAt)
        : new Date(startsAt.getTime() + 30 * 60 * 1000);
      await apiRequest("/appointments", {
        method: "POST",
        body: {
          ...form,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      });
      toast.success("Appointment scheduled");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to schedule");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Appointments"
        subtitle="Schedule and track clinic visits by day."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Book appointment
          </Button>
        }
      >
        <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              From date
            </span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Status
            </span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="checked_in">Checked in</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </label>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            title="No appointments found"
            description="Book the first visit to populate the schedule."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Book appointment
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {byDay.map(([day, list]) => (
              <div key={day} className="panel p-5">
                <h2 className="font-display text-xl">{day}</h2>
                <div className="mt-3 space-y-2">
                  {list.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-3"
                    >
                      <div>
                        <p className="font-semibold">
                          {typeof item.patient === "object" ? item.patient?.name : "Patient"} ·{" "}
                          {typeof item.doctor === "object" ? item.doctor?.name : "Doctor"}
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          {new Date(item.startsAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          — {item.reason || "Visit"}
                        </p>
                      </div>
                      <Badge tone="accent">{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Book appointment"
          description="Assign doctor, patient, and time slot."
        >
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
              <span className="text-sm font-semibold">Starts at</span>
              <Input
                type="datetime-local"
                required
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Ends at (optional)</span>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Reason</span>
              <Input
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button>Schedule</Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
