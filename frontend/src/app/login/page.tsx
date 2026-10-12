"use client";

import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { appConfig, type DemoAccount, type DemoAccountsResponse } from "@/lib/app-config";
import { useAuthStore } from "@/lib/auth-store";
import type { User } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState(appConfig.defaultLoginEmail);
  const [password, setPassword] = useState(appConfig.defaultLoginPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [brandName, setBrandName] = useState(appConfig.appName);

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  useEffect(() => {
    let active = true;
    apiRequest<DemoAccountsResponse>("/auth/demo-accounts", { auth: false })
      .then((data) => {
        if (!active) return;
        setDemoEnabled(Boolean(data.enabled && data.accounts?.length));
        setDemoAccounts(data.accounts || []);
        if (data.appName) setBrandName(data.appName);
      })
      .catch(() => {
        if (!active) return;
        setDemoEnabled(false);
        setDemoAccounts([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function applyDemo(account: DemoAccount) {
    setEmail(account.email);
    if (account.password) setPassword(account.password);
    setShowDemo(false);
  }

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
    <div className="login-shell relative min-h-screen overflow-hidden">
      <div className="login-atmosphere" aria-hidden />
      <div className="login-orb login-orb-a animate-pulse-soft" aria-hidden />
      <div className="login-orb login-orb-b animate-pulse-soft" aria-hidden />

      <div className="relative mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative flex flex-col justify-start px-5 pt-6 pb-2 sm:px-10 sm:pt-10 lg:justify-between lg:px-14 lg:py-14">
          <div className="animate-rise flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-sm sm:h-11 sm:w-11">
              <Stethoscope className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-display text-lg tracking-tight text-[var(--foreground)] sm:text-xl">
              {brandName}
            </span>
          </div>

          <div className="animate-rise-delay-1 relative z-[1] mt-5 mb-4 max-w-xl lg:my-0 lg:mt-0">
            <h1 className="hidden font-display text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.92] tracking-[-0.03em] text-[var(--foreground)] lg:block">
              {brandName.split(" ").map((word, i) => (
                <span key={`${word}-${i}`}>
                  {i > 0 ? <br /> : null}
                  {word}
                </span>
              ))}
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-[var(--muted)] sm:text-base lg:mt-6 lg:text-lg">
              {appConfig.appTagline}
            </p>

            <svg
              className="login-pulse-line mt-10 hidden w-full max-w-md text-[var(--accent)] lg:block"
              viewBox="0 0 420 64"
              fill="none"
              aria-hidden
            >
              <path
                className="login-pulse-path"
                d="M0 32 H70 L88 32 L102 8 L120 56 L138 32 H210 L228 32 L242 14 L260 50 L278 32 H420"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="animate-rise-delay-2 hidden text-sm text-[var(--muted)] lg:block">
            Role-based access for admin, receptionist, and doctor staff.
          </p>
        </section>

        <section className="relative flex items-start justify-center px-4 pb-10 sm:px-8 lg:items-center lg:px-10 lg:py-14">
          <div className="login-form-panel animate-rise-delay-2 w-full max-w-[420px] p-5 sm:p-8">
            <div className="mb-6 sm:mb-7">
              <p className="font-display text-2xl tracking-tight text-[var(--foreground)] sm:text-3xl">
                Sign in
              </p>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                Use your clinic account to enter the portal.
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Email</span>
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@clinic.health"
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Password</span>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-1.5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
                >
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                <LockKeyhole className="h-4 w-4" />
                {loading ? "Signing in…" : "Enter portal"}
              </Button>
            </form>

            <div className="mt-5 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <Link
                href="/forgot-password"
                className="inline-flex min-h-11 items-center font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
              {demoEnabled ? (
                <button
                  type="button"
                  onClick={() => setShowDemo((v) => !v)}
                  className="inline-flex min-h-11 items-center text-left text-[var(--muted)] transition hover:text-[var(--foreground)] sm:justify-end sm:text-right"
                >
                  {showDemo ? "Hide demo logins" : "Demo logins"}
                </button>
              ) : null}
            </div>

            {showDemo && demoAccounts.length ? (
              <div className="animate-rise mt-4 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-xs leading-relaxed text-[var(--muted)]">
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Loaded from server config
                </p>
                {demoAccounts.map((account) => (
                  <button
                    key={`${account.role}-${account.email}`}
                    type="button"
                    onClick={() => applyDemo(account)}
                    className="flex w-full flex-col rounded-lg px-2 py-2 text-left transition hover:bg-[var(--surface)]"
                  >
                    <span className="font-semibold text-[var(--foreground)]">{account.label}</span>
                    <span>
                      {account.email}
                      {account.password ? ` / ${account.password}` : ""}
                    </span>
                    <span className="mt-0.5 text-[10px] text-[var(--accent-strong)]">
                      Tap to fill form
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
