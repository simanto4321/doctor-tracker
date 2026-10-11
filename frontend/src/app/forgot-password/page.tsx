"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("admin@doctortracker.com");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [issuedToken, setIssuedToken] = useState("");

  async function requestToken(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await apiRequest<{ message: string; resetToken: string | null }>(
        "/auth/forgot-password",
        { method: "POST", body: { email }, auth: false }
      );
      setIssuedToken(data.resetToken || "");
      if (data.resetToken) setToken(data.resetToken);
      toast.success(data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await apiRequest<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: { token, password },
        auth: false,
      });
      toast.success(data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
      <div className="panel w-full space-y-6 p-6">
        <div>
          <h1 className="font-display text-3xl">Reset password</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Demo flow returns a reset token in the API response.
          </p>
        </div>

        <form className="space-y-3" onSubmit={requestToken}>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Account email</span>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <Button className="w-full">Send reset token</Button>
          {issuedToken ? (
            <p className="break-all rounded-xl bg-[var(--surface-soft)] p-3 text-xs">
              Token: {issuedToken}
            </p>
          ) : null}
        </form>

        <form className="space-y-3 border-t border-[var(--border)] pt-4" onSubmit={resetPassword}>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Reset token</span>
            <Input required value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">New password</span>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button className="w-full" variant="secondary">
            Update password
          </Button>
        </form>

        <Link href="/login" className="block text-sm font-semibold text-[var(--accent-strong)]">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
