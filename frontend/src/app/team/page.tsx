"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "receptionist",
  });
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (user?.role !== "admin") {
      toast.error("Only admins can register team members");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/auth/register", { method: "POST", body: form });
      toast.success("Team member registered");
      setForm({ name: "", email: "", password: "", role: "receptionist" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Team"
        subtitle="Admin-only registration for receptionists and doctor accounts."
      >
        {user?.role !== "admin" ? (
          <div className="panel p-6 text-[var(--muted)]">
            You need an admin role to manage team accounts.
          </div>
        ) : (
          <form className="panel mx-auto max-w-lg space-y-3 p-6" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Name</span>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Email</span>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Temporary password</span>
              <Input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Role</span>
              <Select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="receptionist">Receptionist</option>
                <option value="doctor">Doctor</option>
              </Select>
            </label>
            <Button disabled={saving}>{saving ? "Creating…" : "Register user"}</Button>
            <p className="text-xs text-[var(--muted)]">
              Demo receptionist already seeded: front.desk@doctortracker.com / Desk@123
            </p>
          </form>
        )}
      </AppShell>
    </AuthGuard>
  );
}
