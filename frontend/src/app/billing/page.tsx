"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Invoice = {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt?: string | null;
  paidAt?: string | null;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
  patient?: { name: string };
  doctor?: { name: string };
  visit?: { visitedAt: string; diagnosis: string };
};

type VisitOption = {
  id: string;
  visitedAt: string;
  diagnosis: string;
  patient?: { name: string } | string;
};

export default function BillingPage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [visits, setVisits] = useState<VisitOption[]>([]);
  const [form, setForm] = useState({
    visit: "",
    description: "Office visit",
    unitPrice: 150,
    quantity: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Invoice[] }>(
        `/invoices${toQuery({ status, limit: 40 })}`
      );
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiRequest<{ items: VisitOption[] }>("/visits?limit=40")
      .then((data) => {
        setVisits(data.items);
        setForm((f) => ({ ...f, visit: data.items[0]?.id || "" }));
      })
      .catch(() => undefined);
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/invoices", {
        method: "POST",
        body: {
          visit: form.visit,
          status: "issued",
          lineItems: [
            {
              description: form.description,
              quantity: Number(form.quantity),
              unitPrice: Number(form.unitPrice),
            },
          ],
        },
      });
      toast.success("Invoice created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create invoice");
    }
  }

  async function setInvoiceStatus(id: string, next: string) {
    try {
      await apiRequest(`/invoices/${id}/status`, { method: "PATCH", body: { status: next } });
      toast.success(`Invoice ${next}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  function tone(s: string) {
    if (s === "paid") return "success" as const;
    if (s === "void") return "danger" as const;
    if (s === "issued") return "info" as const;
    return "neutral" as const;
  }

  return (
    <AuthGuard>
      <AppShell
        feature="billing"
        title="Billing"
        subtitle="Invoices tied to clinical visits — draft, issue, and mark paid."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New invoice
          </Button>
        }
      >
        <div className="panel mb-5 max-w-xs p-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </Select>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : items.length === 0 ? (
          <div className="panel p-8 text-sm text-[var(--muted)]">No invoices yet.</div>
        ) : (
          <div className="overflow-x-auto panel">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Patient / visit</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{inv.number}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {inv.issuedAt ? formatDate(inv.issuedAt) : "Not issued"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{inv.patient?.name || "Patient"}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {inv.visit?.diagnosis || "Visit"} ·{" "}
                        {inv.visit?.visitedAt ? formatDate(inv.visit.visitedAt) : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {inv.currency} {inv.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={tone(inv.status)}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={inv.status}
                        onChange={(e) => setInvoiceStatus(inv.id, e.target.value)}
                      >
                        <option value="draft">draft</option>
                        <option value="issued">issued</option>
                        <option value="paid">paid</option>
                        <option value="void">void</option>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Invoice from visit">
          <form className="space-y-3" onSubmit={onCreate}>
            <Select
              required
              value={form.visit}
              onChange={(e) => setForm((f) => ({ ...f, visit: e.target.value }))}
            >
              {visits.map((v) => {
                const patientName =
                  v.patient && typeof v.patient === "object" ? v.patient.name : "Patient";
                return (
                  <option key={v.id} value={v.id}>
                    {patientName} · {v.diagnosis} · {formatDate(v.visitedAt)}
                  </option>
                );
              })}
            </Select>
            <Input
              required
              placeholder="Line item"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 1 }))}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.unitPrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitPrice: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <Button type="submit" className="w-full">
              Create invoice
            </Button>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
