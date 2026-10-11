"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { EntityHover } from "@/components/entity-hover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeatureTitle } from "@/components/ui/hover-info";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Lab = {
  id: string;
  testName: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  abnormal: boolean;
  collectedAt: string;
  patient?: { name: string };
  doctor?: { name: string };
};

export default function LabsPage() {
  const [items, setItems] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [trendPatient, setTrendPatient] = useState("");
  const [trend, setTrend] = useState<Array<{ label: string; value: number; abnormal: boolean }>>([]);
  const [form, setForm] = useState({
    patient: "",
    doctor: "",
    testName: "Glucose",
    value: "",
    unit: "mg/dL",
    refLow: "70",
    refHigh: "110",
    collectedAt: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Lab[] }>(
        `/labs${toQuery({ abnormal: abnormalOnly ? "true" : undefined, limit: 40 })}`
      );
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load labs");
    } finally {
      setLoading(false);
    }
  }, [abnormalOnly]);

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
        doctor: d.items[0]?.id || "",
      }));
      setTrendPatient(p.items[0]?.id || "");
    })().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!trendPatient) return;
    apiRequest<{ items: Array<{ collectedAt: string; value: number; abnormal: boolean; testName: string }> }>(
      `/labs/trends/${trendPatient}`
    )
      .then((data) =>
        setTrend(
          data.items.map((item) => ({
            label: formatDate(item.collectedAt),
            value: item.value,
            abnormal: item.abnormal,
          }))
        )
      )
      .catch(() => setTrend([]));
  }, [trendPatient]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/labs", {
        method: "POST",
        body: {
          ...form,
          value: Number(form.value),
          refLow: Number(form.refLow),
          refHigh: Number(form.refHigh),
        },
      });
      toast.success("Lab result saved");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save lab");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="labs"
        title="Lab results"
        subtitle="Values, reference ranges, abnormal flags, and patient trends."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add result
          </Button>
        }
      >
        <div className="mb-5 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="panel p-5">
            <FeatureTitle
              feature="labs"
              title="Results registry"
              subtitle="Hover any row for quick clinical context."
            />
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={abnormalOnly}
                  onChange={(e) => setAbnormalOnly(e.target.checked)}
                />
                Abnormal only
              </label>
            </div>
            {loading ? (
              <PageSkeleton />
            ) : (
              <div className="table-wrap mt-4">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Patient</th>
                      <th>Value</th>
                      <th>Range</th>
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((lab) => (
                      <tr key={lab.id}>
                        <td>
                          <EntityHover
                            title={lab.testName}
                            badge={lab.abnormal ? "Abnormal" : "Normal"}
                            lines={[
                              { label: "Patient", value: lab.patient?.name || "—" },
                              { label: "Doctor", value: lab.doctor?.name || "—" },
                              { label: "Collected", value: formatDate(lab.collectedAt) },
                              {
                                label: "Value",
                                value: `${lab.value} ${lab.unit}`,
                              },
                            ]}
                          >
                            <span className="font-semibold underline decoration-dotted">
                              {lab.testName}
                            </span>
                          </EntityHover>
                        </td>
                        <td>{lab.patient?.name || "—"}</td>
                        <td>
                          {lab.value} {lab.unit}
                        </td>
                        <td className="text-sm text-[var(--muted)]">
                          {lab.refLow}–{lab.refHigh}
                        </td>
                        <td>
                          <Badge tone={lab.abnormal ? "danger" : "success"}>
                            {lab.abnormal ? "Abnormal" : "OK"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel p-5">
            <FeatureTitle feature="labs" title="Trend view" subtitle="Pick a patient to chart recent values." />
            <Select
              className="mt-3"
              value={trendPatient}
              onChange={(e) => setTrendPatient(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="#d7e5df" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5d746d" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#5d746d" }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <Modal open={open} onClose={() => setOpen(false)} title="Add lab result">
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
              <span className="text-sm font-semibold">Test name</span>
              <Input
                required
                value={form.testName}
                onChange={(e) => setForm((f) => ({ ...f, testName: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Value</span>
                <Input
                  required
                  type="number"
                  step="any"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Low</span>
                <Input
                  required
                  type="number"
                  step="any"
                  value={form.refLow}
                  onChange={(e) => setForm((f) => ({ ...f, refLow: e.target.value }))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">High</span>
                <Input
                  required
                  type="number"
                  step="any"
                  value={form.refHigh}
                  onChange={(e) => setForm((f) => ({ ...f, refHigh: e.target.value }))}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Unit</span>
                <Input
                  required
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Collected</span>
                <Input
                  type="date"
                  required
                  value={form.collectedAt}
                  onChange={(e) => setForm((f) => ({ ...f, collectedAt: e.target.value }))}
                />
              </label>
            </div>
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
