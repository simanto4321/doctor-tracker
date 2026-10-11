"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

function VerifyEmailForm() {
  const search = useSearchParams();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fromQuery = search.get("token");
    if (fromQuery) setToken(fromQuery);
  }, [search]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await apiRequest("/auth/verify-email", {
        method: "POST",
        body: { token },
        auth: false,
      });
      setDone(true);
      toast.success("Email verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {done ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-[var(--ink)]">Your email is verified. You can sign in.</p>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            Go to login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Verification token"
            required
          />
          <Button type="submit" disabled={loading || !token} className="w-full">
            {loading ? "Verifying…" : "Verify email"}
          </Button>
        </form>
      )}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-3xl text-[var(--ink)]">Verify email</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Enter the verification token from your inbox (demo mode also shows it in the Team
        registration response).
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-[var(--muted)]">Loading…</p>}>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}
