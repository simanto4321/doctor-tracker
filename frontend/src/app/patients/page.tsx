"use client";

import Link from "next/link";
import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { EntityHover } from "@/components/entity-hover";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiRequest, toQuery } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { canManageRecords } from "@/lib/roles";
import { useAuthStore } from "@/lib/auth-store";
import type { Pagination, Patient } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type PatientForm = {
  name: string;
  age: string;
  gender: "male" | "female" | "other";
  condition: string;
  phone: string;
  email: string;
  doctor: string;
  notes: string;
};

const emptyForm: PatientForm = {
  name: "",
  age: "",
  gender: "female",
  condition: "",
  phone: "",
  email: "",
  doctor: "",
  notes: "",
};

function doctorName(patient: Patient) {
  if (patient.doctor && typeof patient.doctor === "object") return patient.doctor.name;
  return "Unassigned";
}

function doctorIdOf(patient: Patient) {
  if (patient.doctorId) return patient.doctorId;
  if (patient.doctor && typeof patient.doctor === "object") {
    return String(patient.doctor.id || patient.doctor._id || "");
  }
  if (typeof patient.doctor === "string") return patient.doctor;
  return "";
}

export default function PatientsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageRecords(user);
  const [items, setItems] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState("");
  const [gender, setGender] = useState("");
  const [doctor, setDoctor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string; specialization: string }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ items: Patient[]; pagination: Pagination }>(
        `/patients${toQuery({
          page: pagination.page,
          limit: pagination.limit,
          search,
          condition,
          gender,
          doctor,
          from,
          to,
        })}`
      );
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, condition, gender, doctor, from, to]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    (async () => {
      try {
        const meta = await apiRequest<{
          conditions: string[];
          doctors: Array<{ id: string; name: string; specialization: string }>;
        }>("/patients/meta/filters");
        setConditions(meta.conditions);
        setDoctors(meta.doctors);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, doctor: doctors[0]?.id || "" });
    setOpen(true);
  }

  function openEdit(patient: Patient) {
    setEditing(patient);
    setForm({
      name: patient.name,
      age: String(patient.age),
      gender: patient.gender,
      condition: patient.condition,
      phone: patient.phone,
      email: patient.email,
      doctor: doctorIdOf(patient),
      notes: patient.notes || "",
    });
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        age: Number(form.age),
      };
      if (editing) {
        await apiRequest(`/patients/${editing.id}`, { method: "PUT", body: payload });
        toast.success("Patient updated");
      } else {
        await apiRequest("/patients", { method: "POST", body: payload });
        toast.success("Patient created");
      }
      setOpen(false);
      await loadPatients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(patient: Patient) {
    const confirmed = window.confirm(
      `Move ${patient.name} to trash? You can restore later from Trash.`
    );
    if (!confirmed) return;
    try {
      await apiRequest(`/patients/${patient.id}`, { method: "DELETE" });
      toast.success("Patient moved to trash");
      await loadPatients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="patients"
        title="Patients"
        subtitle="Search, filter, edit, and soft-delete patient charts across the clinic."
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await downloadCsv("/patients/export.csv", "patients.csv");
                  toast.success("Patients CSV downloaded");
                } catch {
                  toast.error("Export failed");
                }
              }}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            {canManage ? (
              <Button onClick={openCreate} disabled={doctors.length === 0}>
                <Plus className="h-4 w-4" />
                Add patient
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="space-y-1.5 sm:col-span-2 xl:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                className="pl-9"
                placeholder="Name, condition, email, phone…"
                value={search}
                onChange={(e) => {
                  setPagination((p) => ({ ...p, page: 1 }));
                  setSearch(e.target.value);
                }}
              />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Condition
            </span>
            <Select
              value={condition}
              onChange={(e) => {
                setPagination((p) => ({ ...p, page: 1 }));
                setCondition(e.target.value);
              }}
            >
              <option value="">All conditions</option>
              {conditions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Gender
            </span>
            <Select
              value={gender}
              onChange={(e) => {
                setPagination((p) => ({ ...p, page: 1 }));
                setGender(e.target.value);
              }}
            >
              <option value="">All</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Doctor
            </span>
            <Select
              value={doctor}
              onChange={(e) => {
                setPagination((p) => ({ ...p, page: 1 }));
                setDoctor(e.target.value);
              }}
            >
              <option value="">All doctors</option>
              {doctors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.specialization}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              From
            </span>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setPagination((p) => ({ ...p, page: 1 }));
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              To
            </span>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setPagination((p) => ({ ...p, page: 1 }));
                setTo(e.target.value);
              }}
            />
          </label>
        </div>

        {loading ? (
          <div className="panel p-10 text-[var(--muted)]">Loading patients…</div>
        ) : error ? (
          <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-[var(--danger)]">
            {error}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No patients found"
            description="Adjust filters or add a patient assigned to an existing doctor."
            action={
              <Button onClick={openCreate} disabled={doctors.length === 0}>
                <Plus className="h-4 w-4" />
                Add patient
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Condition</th>
                    <th>Doctor</th>
                    <th>Demographics</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <EntityHover
                          href={`/patients/${patient.id}`}
                          title={patient.name}
                          badge={patient.riskFlag || "none"}
                          lines={[
                            { label: "Condition", value: patient.condition },
                            { label: "Doctor", value: doctorName(patient) },
                            { label: "Age / gender", value: `${patient.age} · ${patient.gender}` },
                            { label: "Phone", value: patient.phone },
                            { label: "Risk", value: patient.riskFlag || "none" },
                          ]}
                        >
                          <span className="font-semibold text-[var(--accent-strong)] underline decoration-dotted">
                            {patient.name}
                          </span>
                        </EntityHover>
                        <p className="text-xs text-[var(--muted)]">{patient.email}</p>
                      </td>
                      <td>
                        <Badge tone="info">{patient.condition}</Badge>
                      </td>
                      <td>{doctorName(patient)}</td>
                      <td className="text-sm text-[var(--muted)]">
                        {patient.age} yrs · {patient.gender}
                      </td>
                      <td>{formatDate(patient.createdAt)}</td>
                      <td>
                        {canManage ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(patient)}
                              aria-label="Edit patient"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDelete(patient)}
                              aria-label="Delete patient"
                            >
                              <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                            </Button>
                          </div>
                        ) : (
                          <Link
                            href={`/patients/${patient.id}`}
                            className="text-sm font-semibold text-[var(--accent-strong)]"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} patients
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={editing ? "Edit patient" : "Add patient"}
          description="Keep demographics, condition, and doctor assignment current."
        >
          <form className="grid gap-3" onSubmit={onSubmit}>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Name</span>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Age</span>
                <Input
                  type="number"
                  min={0}
                  required
                  value={form.age}
                  onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Gender</span>
                <Select
                  value={form.gender}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, gender: e.target.value as PatientForm["gender"] }))
                  }
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </Select>
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Condition</span>
              <Input
                required
                value={form.condition}
                onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Doctor</span>
              <Select
                required
                value={form.doctor}
                onChange={(e) => setForm((p) => ({ ...p, doctor: e.target.value }))}
              >
                <option value="" disabled>
                  Select doctor
                </option>
                {doctors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.specialization}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Phone</span>
              <Input
                required
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Email</span>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Notes</span>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create"}</Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
