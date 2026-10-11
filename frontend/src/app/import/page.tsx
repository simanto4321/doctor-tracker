"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { HoverInfo } from "@/components/ui/hover-info";
import { Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

const doctorSample = `name,specialization,hospital,department,phone,email,workingHours,bio
Dr. Sam Lee,Oncology,Harborview Medical Center,Oncology,+1 206-555-0199,sam.lee@harborview.health,Mon-Fri 09:00-15:00,Seed import doctor`;

const patientSample = `name,age,gender,condition,phone,email,doctorEmail,riskFlag,notes
Jordan Blake,41,female,Hypertension,+1 555-0199,jordan.blake@import.test,aisha.rahman@harborview.health,medium,Imported patient`;

export default function ImportPage() {
  const [doctorCsv, setDoctorCsv] = useState(doctorSample);
  const [patientCsv, setPatientCsv] = useState(patientSample);
  const [doctorResult, setDoctorResult] = useState("");
  const [patientResult, setPatientResult] = useState("");

  async function importDoctors(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await apiRequest<{ created: number; failed: number; errors: string[] }>(
        "/import/doctors",
        { method: "POST", body: { csv: doctorCsv } }
      );
      setDoctorResult(`Created ${data.created}, failed ${data.failed}`);
      toast.success(`Imported ${data.created} doctors`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Doctor import failed");
    }
  }

  async function importPatients(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await apiRequest<{ created: number; failed: number; errors: string[] }>(
        "/import/patients",
        { method: "POST", body: { csv: patientCsv } }
      );
      setPatientResult(`Created ${data.created}, failed ${data.failed}`);
      toast.success(`Imported ${data.created} patients`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Patient import failed");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="import"
        title="Bulk import"
        subtitle="Paste CSV to create many doctors or patients in one action."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <form className="panel space-y-3 p-5" onSubmit={importDoctors}>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl">Doctors CSV</h2>
              <HoverInfo
                feature="import"
                label="Doctors CSV"
                fallbackSummary="Required columns: name, specialization, hospital, phone, email."
              />
            </div>
            <Textarea
              className="min-h-56 font-mono text-xs"
              value={doctorCsv}
              onChange={(e) => setDoctorCsv(e.target.value)}
            />
            <Button>Import doctors</Button>
            {doctorResult ? <p className="text-sm text-[var(--muted)]">{doctorResult}</p> : null}
          </form>

          <form className="panel space-y-3 p-5" onSubmit={importPatients}>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl">Patients CSV</h2>
              <HoverInfo
                feature="import"
                label="Patients CSV"
                fallbackSummary="Required columns: name, age, gender, condition, phone, email, doctorEmail."
              />
            </div>
            <Textarea
              className="min-h-56 font-mono text-xs"
              value={patientCsv}
              onChange={(e) => setPatientCsv(e.target.value)}
            />
            <Button>Import patients</Button>
            {patientResult ? <p className="text-sm text-[var(--muted)]">{patientResult}</p> : null}
          </form>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
