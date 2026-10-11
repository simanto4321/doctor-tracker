"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { EntityHover } from "@/components/entity-hover";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FeatureTitle } from "@/components/ui/hover-info";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import type { Appointment, Pagination } from "@/lib/types";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day" | "list">("day");
  const [day, setDay] = useState(toDateInput(new Date()));
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [reschedule, setReschedule] = useState<Appointment | null>(null);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    doctor: "",
    patient: "",
    startsAt: "",
    endsAt: "",
    reason: "Consultation",
  });
  const [rescheduleForm, setRescheduleForm] = useState({
    startsAt: "",
    endsAt: "",
    status: "scheduled",
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query =
        view === "day"
          ? { from: day, to: day, status: status || undefined, limit: 100 }
          : { from: day, status: status || undefined, limit: 50 };
      const data = await apiRequest<{ items: Appointment[]; pagination: Pagination }>(
        `/appointments${toQuery(query)}`
      );
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [day, status, view]);

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

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 8), []);

  const byHour = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    hours.forEach((h) => map.set(h, []));
    items.forEach((item) => {
      const h = new Date(item.startsAt).getHours();
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(item);
    });
    return map;
  }, [items, hours]);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    items.forEach((item) => {
      const key = new Date(item.startsAt).toLocaleDateString();
      map.set(key, [...(map.get(key) || []), item]);
    });
    return Array.from(map.entries());
  }, [items]);

  function shiftDay(delta: number) {
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDay(toDateInput(d));
  }

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

  function openReschedule(item: Appointment) {
    setReschedule(item);
    setRescheduleForm({
      startsAt: toLocalInput(item.startsAt),
      endsAt: toLocalInput(item.endsAt),
      status: item.status,
      reason: item.reason || "",
    });
  }

  async function onReschedule(event: FormEvent) {
    event.preventDefault();
    if (!reschedule) return;
    try {
      await apiRequest(`/appointments/${reschedule.id}`, {
        method: "PUT",
        body: {
          startsAt: new Date(rescheduleForm.startsAt).toISOString(),
          endsAt: new Date(rescheduleForm.endsAt).toISOString(),
          status: rescheduleForm.status,
          reason: rescheduleForm.reason,
        },
      });
      toast.success("Appointment updated");
      setReschedule(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reschedule");
    }
  }

  async function cancelAppointment(id: string) {
    try {
      await apiRequest(`/appointments/${id}`, { method: "DELETE" });
      toast.success("Appointment cancelled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to cancel");
    }
  }

  function appointmentCard(item: Appointment) {
    const patientName = typeof item.patient === "object" ? item.patient?.name : "Patient";
    const doctorName = typeof item.doctor === "object" ? item.doctor?.name : "Doctor";
    const condition =
      typeof item.patient === "object" ? item.patient?.condition || "—" : "—";
    return (
      <div
        key={item.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-3"
      >
        <EntityHover
          title={`${patientName} · ${doctorName}`}
          badge={item.status}
          lines={[
            {
              label: "Time",
              value: `${new Date(item.startsAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })} – ${new Date(item.endsAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`,
            },
            { label: "Reason", value: item.reason || "Visit" },
            { label: "Condition", value: condition },
            { label: "Status", value: item.status },
          ]}
        >
          <div className="cursor-help">
            <p className="font-semibold underline decoration-dotted">
              {patientName} · {doctorName}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {new Date(item.startsAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              — {item.reason || "Visit"}
            </p>
          </div>
        </EntityHover>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{item.status}</Badge>
          {item.status !== "cancelled" ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => openReschedule(item)}>
                Reschedule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => cancelAppointment(item.id)}>
                Cancel
              </Button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <AppShell
        feature="appointments"
        title="Appointments"
        subtitle="Book, reschedule, and review the clinic day calendar."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Book appointment
          </Button>
        }
      >
        <div className="panel mb-5 grid gap-3 p-4 lg:grid-cols-[1fr_1fr_auto_auto]">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Date
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="secondary" onClick={() => shiftDay(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              <Button type="button" size="icon" variant="secondary" onClick={() => shiftDay(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant={view === "day" ? "primary" : "secondary"}
              onClick={() => setView("day")}
            >
              <CalendarDays className="h-4 w-4" />
              Day view
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "primary" : "secondary"}
              onClick={() => setView("list")}
            >
              List
            </Button>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="secondary" onClick={() => setDay(toDateInput(new Date()))}>
              Today
            </Button>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            title="No appointments for this range"
            description="Book a visit or jump to another day."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Book appointment
              </Button>
            }
          />
        ) : view === "day" ? (
          <div className="panel p-5">
            <FeatureTitle
              feature="appointments"
              title={new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              subtitle={`${items.length} appointment${items.length === 1 ? "" : "s"} · hover a slot for details`}
            />
            <div className="mt-4 space-y-3">
              {hours.map((hour) => {
                const slot = byHour.get(hour) || [];
                return (
                  <div key={hour} className="grid grid-cols-[4.5rem_1fr] gap-3">
                    <p className="pt-3 text-sm font-semibold text-[var(--muted)]">
                      {String(hour).padStart(2, "0")}:00
                    </p>
                    <div className="min-h-14 space-y-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)]/60 p-2">
                      {slot.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-[var(--muted)]">Open</p>
                      ) : (
                        slot.map(appointmentCard)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {byDay.map(([label, list]) => (
              <div key={label} className="panel p-5">
                <h2 className="font-display text-xl">{label}</h2>
                <div className="mt-3 space-y-2">{list.map(appointmentCard)}</div>
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

        <Modal
          open={Boolean(reschedule)}
          onClose={() => setReschedule(null)}
          title="Reschedule appointment"
          description="Update time, status, or reason."
        >
          <form className="grid gap-3" onSubmit={onReschedule}>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Starts at</span>
              <Input
                type="datetime-local"
                required
                value={rescheduleForm.startsAt}
                onChange={(e) => setRescheduleForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Ends at</span>
              <Input
                type="datetime-local"
                required
                value={rescheduleForm.endsAt}
                onChange={(e) => setRescheduleForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Status</span>
              <Select
                value={rescheduleForm.status}
                onChange={(e) => setRescheduleForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="scheduled">Scheduled</option>
                <option value="checked_in">Checked in</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No show</option>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Reason</span>
              <Input
                value={rescheduleForm.reason}
                onChange={(e) => setRescheduleForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setReschedule(null)}>
                Close
              </Button>
              <Button>Save changes</Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
