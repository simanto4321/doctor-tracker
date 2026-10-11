"use client";

import Link from "next/link";
import { Activity, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { User } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("admin@doctortracker.com");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      setSession(data.token, data.user);
      toast.success("Welcome back");
      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,118,110,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(29,79,120,0.14),transparent_30%),linear-gradient(135deg,#edf7f4,#f7faf9_45%,#e8f1ee)]" />
      <div className="animate-pulse-soft absolute -left-16 top-24 h-56 w-56 rounded-full bg-teal-300/25 blur-3xl" />
      <div className="animate-pulse-soft absolute bottom-10 right-10 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="animate-rise hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure clinical admin access
          </div>
          <h1 className="mt-6 font-display text-6xl leading-[0.95] text-[var(--foreground)]">
            Doctor Tracker
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[var(--muted)]">
            A calm operations desk for managing doctors, patients, and clinic analytics without the
            noise of a generic dashboard.
          </p>
          <div className="mt-10 grid max-w-md gap-3">
            {[
              "Protected routes with JWT authentication",
              "Searchable doctor and patient registries",
              "Live charts for caseload and conditions",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-3 text-sm text-[var(--foreground)]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="animate-rise-delay-1 panel mx-auto w-full max-w-md p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-2xl">Sign in</p>
              <p className="text-sm text-[var(--muted)]">Admin portal credentials required</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Email</span>
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Password</span>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </div>
            ) : null}

            <Button className="w-full" size="lg" disabled={loading}>
              <LockKeyhole className="h-4 w-4" />
              {loading ? "Signing in…" : "Enter portal"}
            </Button>
          </form>

          <div className="mt-4 flex justify-between text-sm">
            <Link href="/forgot-password" className="font-semibold text-[var(--accent-strong)]">
              Forgot password?
            </Link>
            <span className="text-[var(--muted)]">Roles: admin · receptionist · doctor</span>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-xs text-[var(--muted)]">
            <p>
              Admin: <strong>admin@doctortracker.com</strong> / <strong>Admin@123</strong>
            </p>
            <p>
              Receptionist: <strong>front.desk@doctortracker.com</strong> / <strong>Desk@123</strong>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
