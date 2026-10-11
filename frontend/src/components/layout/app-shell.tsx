"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Menu,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/patients", label: "Patients", icon: Users },
];

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [open, setOpen] = useState(false);

  function logout() {
    clearSession();
    toast.success("Signed out");
    router.replace("/login");
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-4 py-5">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-sm">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-xl leading-none text-[var(--foreground)]">
            Doctor Tracker
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Clinical operations desk</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">{user?.name || "Admin"}</p>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{user?.email}</p>
        <Button variant="secondary" className="mt-4 w-full" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <div className="hidden lg:block">{sidebar}</div>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              className="absolute inset-0 bg-slate-950/40"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            />
            <div className="relative z-10 h-full w-[min(100%,20rem)] shadow-2xl">{sidebar}</div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Button
                  variant="secondary"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setOpen(true)}
                  aria-label="Open menu"
                >
                  {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                <div>
                  <h1 className="font-display text-2xl md:text-3xl">
                    {title}
                  </h1>
                  {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
                </div>
              </div>
              {action}
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
