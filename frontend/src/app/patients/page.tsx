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
import { SortableTh } from "@/components/ui/sortable-th";
import { TableSkeleton } from "@/components/ui/skeleton";
import { WizardSteps } from "@/components/ui/wizard";
import { apiRequest, toQuery } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { useI18n } from "@/lib/i18n";
import { canManageRecords } from "@/lib/roles";
import { useAuthStore } from "@/lib/auth-store";
import { softDeleteWithUndo } from "@/lib/undo-toast";
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
  const { t } = useI18n();
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
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
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
  const [wizardStep, setWizardStep] = useState(0);

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
          sort,
          dir,
        })}`
      );
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, condition, gender, doctor, from, to, sort, dir]);

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
    setWizardStep(0);
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
    setWizardStep(0);
    setOpen(true);
  }

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        age: Number(form.age),
      };
      if (editing) {
        await apiRequest(`/patients/${editing.id}`, { method: "PUT", body: payload });
        toast.success(t("toast.patientUpdated"));
      } else {
        await apiRequest("/patients", { method: "POST", body: payload });
        toast.success(t("toast.patientCreated"));
      }
      setOpen(false);
      setWizardStep(0);
      await loadPatients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(patient: Patient) {
    try {
      await softDeleteWithUndo({
        label: `${patient.name} · ${t("toast.movedTrash")}`,
        deletePath: `/patients/${patient.id}`,
        restorePath: `/patients/${patient.id}/restore`,
        onDone: loadPatients,
        undoLabel: t("action.undo"),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function toggleSort(column: string) {
    if (sort === column) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(column);
      setDir(column === "name" ? "asc" : "desc");
    }
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function validatePatientStep(step: number) {
    if (step === 0) return Boolean(form.name && form.email && form.phone && form.age);
    if (step === 1) return Boolean(form.condition && form.gender);
    if (step === 2) return Boolean(form.doctor);
    return true;
  }

  const patientSteps = [
    t("wizard.patient.step1"),
    t("wizard.patient.step2"),
    t("wizard.patient.step3"),
  ];

  return (
    <AuthGuard>
      <AppShell
        feature="patients"
        title={t("patients.title")}
        subtitle={t("patients.subtitle")}
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
              {t("action.csv")}
            </Button>
            {canManage ? (
              <Button
                onClick={() => {
                  setWizardStep(0);
                  openCreate();
                }}
                disabled={doctors.length === 0}
              >
                <Plus className="h-4 w-4" />
                {t("action.addPatient")}
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
          <TableSkeleton />
        ) : error ? (
          <div
            className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-[var(--danger)]"
            role="alert"
          >
            {error}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            kind="patients"
            title={t("patients.emptyTitle")}
            description={t("patients.emptyDesc")}
            action={
              canManage ? (
                <Button onClick={openCreate} disabled={doctors.length === 0}>
                  <Plus className="h-4 w-4" />
                  {t("action.addPatient")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data" aria-label={t("patients.title")}>
                <thead>
                  <tr>
                    <SortableTh
                      label={t("patients.col.name")}
                      column="name"
                      sort={sort}
                      dir={dir}
                      onSort={toggleSort}
                    />
                    <th scope="col">{t("patients.col.condition")}</th>
                    <th scope="col">{t("patients.col.doctor")}</th>
                    <th scope="col">{t("patients.col.demo")}</th>
                    <SortableTh
                      label={t("patients.col.registered")}
                      column="createdAt"
                      sort={sort}
                      dir={dir}
                      onSort={toggleSort}
                    />
                    <th scope="col">{t("patients.col.actions")}</th>
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
                  {t("action.previous")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  {t("action.next")}
                </Button>
              </div>
            </div>
          </>
        )}

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={editing ? "Edit patient" : t("action.addPatient")}
          description="Step through identity, clinical details, and doctor assignment."
        >
          <WizardSteps steps={patientSteps} current={wizardStep} />
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (wizardStep < 2) {
                if (!validatePatientStep(wizardStep)) {
                  toast.error("Please complete required fields");
                  return;
                }
                setWizardStep((s) => s + 1);
                return;
              }
              void onSubmit();
            }}
          >
            {wizardStep === 0 ? (
              <>
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
                    <span className="text-sm font-semibold">Phone</span>
                    <Input
                      required
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Email</span>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </label>
              </>
            ) : null}
            {wizardStep === 1 ? (
              <>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Condition</span>
                  <Input
                    required
                    value={form.condition}
                    onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))}
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
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Notes</span>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </label>
              </>
            ) : null}
            {wizardStep === 2 ? (
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
            ) : null}
            <div className="mt-2 flex justify-between gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => (wizardStep === 0 ? setOpen(false) : setWizardStep((s) => s - 1))}
              >
                {wizardStep === 0 ? t("action.cancel") : t("action.back")}
              </Button>
              <Button disabled={saving}>
                {wizardStep < 2
                  ? t("action.continue")
                  : saving
                    ? "Saving…"
                    : editing
                      ? t("action.save")
                      : t("action.create")}
              </Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
