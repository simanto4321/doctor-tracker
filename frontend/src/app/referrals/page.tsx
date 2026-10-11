"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { EntityHover } from "@/components/entity-hover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";

type Referral = {
  id: string;
  reason: string;
  status: string;
  priority: string;
  notes?: string;
  patient?: { name: string; condition?: string };
  fromDoctor?: { name: string; specialization?: string };
  toDoctor?: { name: string; specialization?: string };
};

export default function ReferralsPage() {
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    patient: "",
    fromDoctor: "",
    toDoctor: "",
    reason: "",
    priority: "routine",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Referral[] }>(
        `/referrals${toQuery({ status, limit: 40 })}`
      );
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load referrals");
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
      setForm((f) => ({
        ...f,
        patient: p.items[0]?.id || "",
        fromDoctor: d.items[0]?.id || "",
        toDoctor: d.items[1]?.id || d.items[0]?.id || "",
      }));
    })().catch(() => undefined);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/referrals", { method: "POST", body: form });
      toast.success("Referral created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create referral");
    }
  }

  async function updateStatus(id: string, next: string) {
    try {
      await apiRequest(`/referrals/${id}`, { method: "PUT", body: { status: next } });
      toast.success(`Marked ${next}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="referrals"
        title="Referrals"
        subtitle="Track handoffs between doctors with priority and status."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New referral
          </Button>
        }
      >
        <div className="panel mb-5 max-w-xs p-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
          </Select>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                <EntityHover
                  title={item.patient?.name || "Patient"}
                  badge={item.priority}
                  lines={[
                    { label: "From", value: item.fromDoctor?.name || "—" },
                    { label: "To", value: item.toDoctor?.name || "—" },
                    { label: "Reason", value: item.reason },
                    { label: "Status", value: item.status },
                  ]}
                >
                  <div>
                    <p className="font-semibold underline decoration-dotted">
                      {item.patient?.name || "Patient"}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {item.fromDoctor?.name} → {item.toDoctor?.name}
                    </p>
                    <p className="mt-1 text-sm">{item.reason}</p>
                  </div>
                </EntityHover>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.priority === "urgent" || item.priority === "stat" ? "warning" : "neutral"}>
                    {item.priority}
                  </Badge>
                  <Badge tone="accent">{item.status}</Badge>
                  {item.status === "pending" ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => updateStatus(item.id, "accepted")}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(item.id, "declined")}>
                        Decline
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Create referral">
          <form className="grid gap-3" onSubmit={onCreate}>
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
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">From doctor</span>
                <Select
                  value={form.fromDoctor}
                  onChange={(e) => setForm((f) => ({ ...f, fromDoctor: e.target.value }))}
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">To doctor</span>
                <Select
                  value={form.toDoctor}
                  onChange={(e) => setForm((f) => ({ ...f, toDoctor: e.target.value }))}
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Priority</span>
              <Select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Reason</span>
              <Input
                required
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Notes</span>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button>Create</Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
