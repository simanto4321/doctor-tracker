"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, Video } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Session = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  joinUrl: string;
  status: string;
  reason?: string;
  patient?: { name: string; condition?: string };
  doctor?: { name: string; specialization?: string };
};

const statuses = ["scheduled", "in_progress", "completed", "cancelled", "no_show"] as const;

export default function TelemedicinePage() {
  const [items, setItems] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    patient: "",
    doctor: "",
    scheduledAt: "",
    durationMinutes: 30,
    reason: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Session[] }>(
        `/telemedicine${toQuery({ status, limit: 40 })}`
      );
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const [p, d] = await Promise.all([
        apiRequest<{ items: Array<{ id: string; name: string }> }>("/patients?limit=50"),
        apiRequest<{ items: Array<{ id: string; name: string }> }>("/doctors?limit=50"),
      ]);
      setPatients(p.items);
      setDoctors(d.items);
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
      soon.setMinutes(0, 0, 0);
      setForm((f) => ({
        ...f,
        patient: p.items[0]?.id || "",
        doctor: d.items[0]?.id || "",
        scheduledAt: soon.toISOString().slice(0, 16),
      }));
    })().catch(() => undefined);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/telemedicine", {
        method: "POST",
        body: {
          ...form,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          durationMinutes: Number(form.durationMinutes),
        },
      });
      toast.success("Telemedicine session scheduled");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to schedule");
    }
  }

  async function setSessionStatus(id: string, next: string) {
    try {
      await apiRequest(`/telemedicine/${id}/status`, { method: "PATCH", body: { status: next } });
      toast.success(`Status → ${next}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  function tone(s: string) {
    if (s === "in_progress") return "info" as const;
    if (s === "completed") return "success" as const;
    if (s === "cancelled" || s === "no_show") return "danger" as const;
    return "neutral" as const;
  }

  return (
    <AuthGuard>
      <AppShell
        feature="telemedicine"
        title="Telemedicine"
        subtitle="Placeholder video sessions with join links and live status."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Schedule session
          </Button>
        }
      >
        <div className="panel mb-5 max-w-xs p-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : items.length === 0 ? (
          <div className="panel p-8 text-sm text-[var(--muted)]">No telemedicine sessions yet.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((session) => (
              <div key={session.id} className="panel flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{session.patient?.name || "Patient"}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {session.doctor?.name || "Doctor"} · {session.durationMinutes} min
                    </p>
                  </div>
                  <Badge tone={tone(session.status)}>{session.status}</Badge>
                </div>
                <p className="text-sm">{formatDate(session.scheduledAt)}</p>
                {session.reason ? (
                  <p className="text-sm text-[var(--muted)]">{session.reason}</p>
                ) : null}
                <a
                  href={session.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]"
                >
                  <Video className="h-4 w-4" />
                  Open join link
                </a>
                <Select
                  value={session.status}
                  onChange={(e) => setSessionStatus(session.id, e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Schedule telemedicine">
          <form className="space-y-3" onSubmit={onCreate}>
            <Select
              required
              value={form.patient}
              onChange={(e) => setForm((f) => ({ ...f, patient: e.target.value }))}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              required
              value={form.doctor}
              onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Input
              type="datetime-local"
              required
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />
            <Input
              type="number"
              min={5}
              max={180}
              value={form.durationMinutes}
              onChange={(e) =>
                setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) || 30 }))
              }
            />
            <Input
              placeholder="Reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
            <Textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <Button type="submit" className="w-full">
              Create session
            </Button>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
