"use client";

import Link from "next/link";
import { Download, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { canManageRecords } from "@/lib/roles";
import { useAuthStore } from "@/lib/auth-store";
import type { Doctor, Pagination, Patient } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type DoctorForm = {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  department: string;
  workingHours: string;
  bio: string;
};

type PatientForm = {
  name: string;
  age: string;
  gender: "male" | "female" | "other";
  condition: string;
  phone: string;
  email: string;
  notes: string;
  riskFlag: "none" | "low" | "medium" | "high";
};

const emptyDoctor: DoctorForm = {
  name: "",
  specialization: "",
  hospital: "",
  phone: "",
  email: "",
  department: "",
  workingHours: "Mon–Fri 09:00–17:00",
  bio: "",
};

const emptyPatient: PatientForm = {
  name: "",
  age: "",
  gender: "female",
  condition: "",
  phone: "",
  email: "",
  notes: "",
  riskFlag: "none",
};

export default function DoctorsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageRecords(user);
  const [items, setItems] = useState<Doctor[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [doctorOpen, setDoctorOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [doctorForm, setDoctorForm] = useState<DoctorForm>(emptyDoctor);
  const [savingDoctor, setSavingDoctor] = useState(false);

  const [selected, setSelected] = useState<Doctor | null>(null);
  const [doctorPatients, setDoctorPatients] = useState<Patient[]>([]);
  const [patientOpen, setPatientOpen] = useState(false);
  const [patientForm, setPatientForm] = useState<PatientForm>(emptyPatient);
  const [savingPatient, setSavingPatient] = useState(false);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ items: Doctor[]; pagination: Pagination }>(
        `/doctors${toQuery({
          page: pagination.page,
          limit: pagination.limit,
          search,
          specialization,
          from,
          to,
          sort,
          dir,
        })}`
      );
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load doctors");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, specialization, from, to, sort, dir]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    (async () => {
      try {
        const meta = await apiRequest<{ specializations: string[] }>("/doctors/meta/filters");
        setSpecializations(meta.specializations);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function openCreate() {
    setEditingDoctor(null);
    setDoctorForm(emptyDoctor);
    setDoctorOpen(true);
  }

  function openEdit(doctor: Doctor) {
    setEditingDoctor(doctor);
    setDoctorForm({
      name: doctor.name,
      specialization: doctor.specialization,
      hospital: doctor.hospital,
      phone: doctor.phone,
      email: doctor.email,
      department: doctor.department || "",
      workingHours: doctor.workingHours || "",
      bio: doctor.bio || "",
    });
    setDoctorOpen(true);
  }

  async function openDoctorPatients(doctor: Doctor) {
    setSelected(doctor);
    try {
      const data = await apiRequest<{ items: Patient[] }>(`/doctors/${doctor.id}/patients?limit=50`);
      setDoctorPatients(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load patients");
    }
  }

  async function saveDoctor(event: FormEvent) {
    event.preventDefault();
    setSavingDoctor(true);
    try {
      if (editingDoctor) {
        await apiRequest(`/doctors/${editingDoctor.id}`, { method: "PUT", body: doctorForm });
        toast.success("Doctor updated");
      } else {
        await apiRequest("/doctors", { method: "POST", body: doctorForm });
        toast.success("Doctor created");
      }
      setDoctorOpen(false);
      setDoctorForm(emptyDoctor);
      await loadDoctors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingDoctor(false);
    }
  }

  async function createPatient(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSavingPatient(true);
    try {
      await apiRequest(`/doctors/${selected.id}/patients`, {
        method: "POST",
        body: { ...patientForm, age: Number(patientForm.age) },
      });
      toast.success("Patient added");
      setPatientOpen(false);
      setPatientForm(emptyPatient);
      await openDoctorPatients(selected);
      await loadDoctors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to add patient");
    } finally {
      setSavingPatient(false);
    }
  }

  async function removePatient(patientId: string) {
    if (!selected) return;
    try {
      await apiRequest(`/doctors/${selected.id}/patients/${patientId}`, { method: "DELETE" });
      toast.success("Patient removed");
      await openDoctorPatients(selected);
      await loadDoctors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Doctors"
        subtitle="Create, edit, export, and manage each clinician’s caseload."
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await downloadCsv("/doctors/export.csv", "doctors.csv");
                  toast.success("Doctors CSV downloaded");
                } catch {
                  toast.error("Export failed");
                }
              }}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            {canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add doctor
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="panel mb-5 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1.5 xl:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                className="pl-9"
                placeholder="Name, specialty, hospital, email…"
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
              Specialization
            </span>
            <Select
              value={specialization}
              onChange={(e) => {
                setPagination((p) => ({ ...p, page: 1 }));
                setSpecialization(e.target.value);
              }}
            >
              <option value="">All specialties</option>
              {specializations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Sort
            </span>
            <Select
              value={`${sort}:${dir}`}
              onChange={(e) => {
                const [nextSort, nextDir] = e.target.value.split(":") as [string, "asc" | "desc"];
                setSort(nextSort);
                setDir(nextDir);
              }}
            >
              <option value="createdAt:desc">Newest</option>
              <option value="createdAt:asc">Oldest</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="specialization:asc">Specialty A–Z</option>
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
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-[var(--danger)]">
            {error}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No doctors match these filters"
            description="Try clearing search or date filters, or create the first doctor record."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add doctor
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Specialization</th>
                    <th>Hospital</th>
                    <th>Patients</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((doctor) => (
                    <tr key={doctor.id}>
                      <td>
                        <Link
                          href={`/doctors/${doctor.id}`}
                          className="font-semibold text-[var(--accent-strong)] hover:underline"
                        >
                          {doctor.name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">{doctor.email}</p>
                      </td>
                      <td>
                        <Badge tone="accent">{doctor.specialization}</Badge>
                      </td>
                      <td>{doctor.hospital}</td>
                      <td>
                        <Badge tone="neutral">{doctor.patientCount || 0}</Badge>
                      </td>
                      <td>{formatDate(doctor.createdAt)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {canManage ? (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(doctor)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button variant="secondary" size="sm" onClick={() => openDoctorPatients(doctor)}>
                            <Users className="h-4 w-4" />
                            Patients
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} doctors
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
          open={doctorOpen}
          onClose={() => setDoctorOpen(false)}
          title={editingDoctor ? "Edit doctor" : "Create doctor"}
          description="Keep clinician profile and hospital assignment current."
          wide
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={saveDoctor}>
            {(
              [
                ["name", "Full name"],
                ["specialization", "Specialization"],
                ["hospital", "Hospital"],
                ["department", "Department"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["workingHours", "Working hours"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-sm font-semibold">{label}</span>
                <Input
                  type={key === "email" ? "email" : "text"}
                  required={key !== "department" && key !== "workingHours"}
                  value={doctorForm[key]}
                  onChange={(e) => setDoctorForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-semibold">Bio</span>
              <Textarea
                value={doctorForm.bio}
                onChange={(e) => setDoctorForm((prev) => ({ ...prev, bio: e.target.value }))}
              />
            </label>
            <div className="mt-2 flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setDoctorOpen(false)}>
                Cancel
              </Button>
              <Button disabled={savingDoctor}>
                {savingDoctor ? "Saving…" : editingDoctor ? "Save changes" : "Create doctor"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          title={selected ? `${selected.name}'s patients` : "Patients"}
          description="Add or remove patients assigned to this doctor."
          wide
        >
          <div className="mb-4 flex justify-end">
            <Button
              onClick={() => {
                setPatientForm(emptyPatient);
                setPatientOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              Add patient
            </Button>
          </div>
          {doctorPatients.length === 0 ? (
            <EmptyState
              title="No patients yet"
              description="Assign the first patient to this doctor to start tracking caseload."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Condition</th>
                    <th>Age</th>
                    <th>Contact</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {doctorPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <Link href={`/patients/${patient.id}`} className="font-semibold hover:underline">
                          {patient.name}
                        </Link>
                      </td>
                      <td>
                        <Badge tone="info">{patient.condition}</Badge>
                      </td>
                      <td>{patient.age}</td>
                      <td className="text-sm text-[var(--muted)]">{patient.phone}</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePatient(patient.id)}
                          aria-label="Delete patient"
                        >
                          <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>

        <Modal
          open={patientOpen}
          onClose={() => setPatientOpen(false)}
          title="Add patient"
          description={selected ? `Assign under ${selected.name}` : undefined}
        >
          <form className="grid gap-3" onSubmit={createPatient}>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Name</span>
              <Input
                required
                value={patientForm.name}
                onChange={(e) => setPatientForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Age</span>
                <Input
                  type="number"
                  required
                  min={0}
                  value={patientForm.age}
                  onChange={(e) => setPatientForm((p) => ({ ...p, age: e.target.value }))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold">Gender</span>
                <Select
                  value={patientForm.gender}
                  onChange={(e) =>
                    setPatientForm((p) => ({
                      ...p,
                      gender: e.target.value as PatientForm["gender"],
                    }))
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
                value={patientForm.condition}
                onChange={(e) => setPatientForm((p) => ({ ...p, condition: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Risk flag</span>
              <Select
                value={patientForm.riskFlag}
                onChange={(e) =>
                  setPatientForm((p) => ({
                    ...p,
                    riskFlag: e.target.value as PatientForm["riskFlag"],
                  }))
                }
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Phone</span>
              <Input
                required
                value={patientForm.phone}
                onChange={(e) => setPatientForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Email</span>
              <Input
                type="email"
                required
                value={patientForm.email}
                onChange={(e) => setPatientForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Notes</span>
              <Textarea
                value={patientForm.notes}
                onChange={(e) => setPatientForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPatientOpen(false)}>
                Cancel
              </Button>
              <Button disabled={savingPatient}>{savingPatient ? "Saving…" : "Add patient"}</Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </AuthGuard>
  );
}
