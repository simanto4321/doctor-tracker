"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  ScrollText,
  Search,
  Stethoscope,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { useAuthStore } from "@/lib/auth-store";
import { apiRequest } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/prescriptions", label: "Prescriptions", icon: Pill },
  { href: "/audit", label: "Audit log", icon: ScrollText, adminOnly: true },
  { href: "/team", label: "Team", icon: UserPlus, adminOnly: true },
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  function logout() {
    clearSession();
    toast.success("Signed out");
    router.replace("/login");
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiRequest<{ items: NotificationItem[]; unreadCount: number }>(
          "/notifications"
        );
        if (!active) return;
        setNotifications(data.items);
        setUnread(data.unreadCount);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [pathname]);

  const visibleNav = nav.filter((item) => !item.adminOnly || user?.role === "admin");

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-4 py-5">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-sm">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-xl leading-none text-[var(--foreground)]">Doctor Tracker</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Clinical operations desk</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-auto">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        <p className="mt-1 text-xs capitalize text-[var(--accent-strong)]">{user?.role}</p>
        <Button variant="secondary" className="mt-4 w-full" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <CommandPalette />
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
                  <h1 className="font-display text-2xl md:text-3xl">{title}</h1>
                  {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.dispatchEvent(new Event("doctor-tracker:open-search"))}
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="hidden rounded border border-[var(--border)] px-1.5 text-[10px] md:inline">
                    ⌘K
                  </kbd>
                </Button>
                <div className="relative">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setBellOpen((v) => !v)}
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unread > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] text-white">
                        {unread}
                      </span>
                    ) : null}
                  </Button>
                  {bellOpen ? (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[var(--border)] bg-white p-2 shadow-xl">
                      <div className="mb-2 flex items-center justify-between px-2">
                        <p className="text-sm font-semibold">Notifications</p>
                        <button
                          className="text-xs text-[var(--accent-strong)]"
                          onClick={async () => {
                            await apiRequest("/notifications/read-all", { method: "POST" });
                            setUnread(0);
                            setNotifications((items) => items.map((n) => ({ ...n, read: true })));
                          }}
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="max-h-72 space-y-1 overflow-auto">
                        {notifications.length === 0 ? (
                          <p className="px-2 py-6 text-center text-sm text-[var(--muted)]">
                            No notifications
                          </p>
                        ) : (
                          notifications.map((item) => (
                            <button
                              key={item.id}
                              className={cn(
                                "w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-soft)]",
                                !item.read && "bg-[var(--accent-soft)]/50"
                              )}
                              onClick={async () => {
                                await apiRequest(`/notifications/${item.id}/read`, { method: "POST" });
                                setBellOpen(false);
                                if (item.href) router.push(item.href);
                              }}
                            >
                              <p className="text-sm font-semibold">{item.title}</p>
                              <p className="text-xs text-[var(--muted)]">{item.body}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                {action}
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
