"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BedDouble,
  Bell,
  Building2,
  CalendarDays,
  FileUp,
  FlaskConical,
  FolderOpen,
  GitBranchPlus,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Pill,
  Receipt,
  ScrollText,
  Search,
  Stethoscope,
  Sun,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { HoverInfo } from "@/components/ui/hover-info";
import { useAuthStore } from "@/lib/auth-store";
import { apiLogout, apiRequest } from "@/lib/api";
import { useI18n, type Locale } from "@/lib/i18n";
import { useThemeStore } from "@/lib/theme-store";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function modKeyHint() {
  if (typeof navigator === "undefined") return "Ctrl+K";
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
    ? "⌘K"
    : "Ctrl+K";
}

const nav = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, feature: "dashboard" },
  { href: "/doctors", labelKey: "nav.doctors", icon: Stethoscope, feature: "doctors" },
  { href: "/patients", labelKey: "nav.patients", icon: Users, feature: "patients" },
  { href: "/appointments", labelKey: "nav.appointments", icon: CalendarDays, feature: "appointments" },
  { href: "/prescriptions", labelKey: "nav.prescriptions", icon: Pill, feature: "prescriptions" },
  { href: "/labs", labelKey: "nav.labs", icon: FlaskConical, feature: "labs" },
  { href: "/referrals", labelKey: "nav.referrals", icon: GitBranchPlus, feature: "referrals" },
  { href: "/hospitals", labelKey: "nav.hospitals", icon: Building2, feature: "hospitals" },
  { href: "/wards", labelKey: "nav.wards", icon: BedDouble, feature: "wards" },
  { href: "/telemedicine", labelKey: "nav.telemedicine", icon: Video, feature: "telemedicine" },
  { href: "/messages", labelKey: "nav.messages", icon: MessageSquare, feature: "messages" },
  { href: "/billing", labelKey: "nav.billing", icon: Receipt, feature: "billing" },
  { href: "/documents", labelKey: "nav.documents", icon: FolderOpen, feature: "documents" },
  { href: "/import", labelKey: "nav.import", icon: FileUp, feature: "import" },
  { href: "/trash", labelKey: "nav.trash", icon: Trash2, feature: "trash", adminOnly: true },
  { href: "/audit", labelKey: "nav.audit", icon: ScrollText, feature: "audit", adminOnly: true },
  { href: "/team", labelKey: "nav.team", icon: UserPlus, feature: "team", adminOnly: true },
];

export function AppShell({
  title,
  subtitle,
  feature,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  feature?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { t, locale, setLocale, locales } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const [shortcutHint, setShortcutHint] = useState("Ctrl+K");

  async function logout() {
    await apiLogout();
    toast.success(t("toast.signedOut"));
    router.replace("/login");
  }

  useEffect(() => {
    setShortcutHint(modKeyHint());
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (bellOpen) setBellOpen(false);
      if (open) {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (!bellOpen || !bellRef.current) return;
      if (!bellRef.current.contains(event.target as Node)) setBellOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [bellOpen, open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = drawerRef.current;
    const focusable = root?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), select, textarea, input, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();
    function onTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onTab);
    return () => {
      document.removeEventListener("keydown", onTab);
      previouslyFocused?.focus?.();
    };
  }, [open]);

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
    <aside
      id="mobile-nav"
      className="flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-4 py-5"
      aria-label="Primary"
    >
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-sm">
          <Activity className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-display text-xl leading-none text-[var(--foreground)]">{t("app.name")}</p>
            <HoverInfo feature="dashboard" label={t("app.name")} side="right" />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{t("app.tagline")}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-auto pr-1" aria-label="Main">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const label = t(item.labelKey);
          return (
            <div key={item.href} className="flex items-center gap-1">
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
              <HoverInfo feature={item.feature} label={label} side="right" />
            </div>
          );
        })}
      </nav>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">{user?.name || "Admin"}</p>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{user?.email}</p>
        <p className="mt-1 text-xs capitalize text-[var(--accent-strong)]">{user?.role}</p>
        <Button variant="secondary" className="mt-4 w-full" onClick={logout}>
          <LogOut className="h-4 w-4" aria-hidden />
          {t("action.signOut")}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <a href="#main-content" className="skip-link">
        {t("a11y.skip")}
      </a>
      <CommandPalette />
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <div className="hidden lg:block">{sidebar}</div>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
            <button
              className="absolute inset-0 bg-slate-950/40"
              onClick={() => setOpen(false)}
              aria-label={t("action.closeMenu") !== "action.closeMenu" ? t("action.closeMenu") : "Close menu"}
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="relative z-10 h-full w-[min(100%,20rem)] shadow-2xl"
            >
              {sidebar}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 px-3 py-3 backdrop-blur sm:px-4 sm:py-4 md:px-8">
            <div className="flex flex-col gap-3">
              <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                <Button
                  ref={menuButtonRef}
                  variant="secondary"
                  size="icon"
                  className="shrink-0 lg:hidden"
                  onClick={() => setOpen(true)}
                  aria-label="Open menu"
                  aria-expanded={open}
                  aria-controls="mobile-nav"
                >
                  {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="font-display min-w-0 truncate text-xl sm:text-2xl md:text-3xl">
                      {title}
                    </h1>
                    {feature ? (
                      <span className="hidden shrink-0 sm:inline-flex">
                        <HoverInfo feature={feature} label={title} />
                      </span>
                    ) : null}
                  </div>
                  {subtitle ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)] sm:text-sm">{subtitle}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end sm:gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label={t("action.theme")}
                  title={`${t("theme.light")} / ${t("theme.dark")}`}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" aria-hidden />
                  ) : (
                    <Moon className="h-4 w-4" aria-hidden />
                  )}
                </Button>
                <label className="inline-flex min-w-0 items-center gap-1">
                  <span className="sr-only">{t("action.language")}</span>
                  <Languages className="hidden h-4 w-4 shrink-0 text-[var(--muted)] sm:block" aria-hidden />
                  <select
                    className="h-10 w-[4.75rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-1.5 text-xs font-semibold text-[var(--foreground)] sm:w-auto sm:max-w-[9.5rem] sm:px-2 sm:text-sm"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as Locale)}
                    aria-label={t("action.language")}
                  >
                    {locales.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <HoverInfo feature="search" label={t("action.search")} side="bottom">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="sm:hidden"
                    onClick={() => window.dispatchEvent(new Event("doctor-tracker:open-search"))}
                    aria-label={t("action.search")}
                  >
                    <Search className="h-4 w-4" aria-hidden />
                  </Button>
                </HoverInfo>
                <HoverInfo feature="search" label={t("action.search")} side="bottom">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="hidden sm:inline-flex"
                    onClick={() => window.dispatchEvent(new Event("doctor-tracker:open-search"))}
                  >
                    <Search className="h-4 w-4" aria-hidden />
                    <span>{t("action.search")}</span>
                    <kbd className="hidden rounded border border-[var(--border)] px-1.5 text-[10px] md:inline">
                      {shortcutHint}
                    </kbd>
                  </Button>
                </HoverInfo>
                <div className="relative" ref={bellRef}>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setBellOpen((v) => !v)}
                    aria-label={
                      unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
                    }
                    aria-expanded={bellOpen}
                    aria-haspopup="dialog"
                  >
                    <Bell className="h-4 w-4" aria-hidden />
                    {unread > 0 ? (
                      <span
                        className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] text-white"
                        aria-hidden
                      >
                        {unread}
                      </span>
                    ) : null}
                  </Button>
                  {bellOpen ? (
                    <div
                      className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl"
                      role="dialog"
                      aria-label="Notifications"
                    >
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
                              type="button"
                              className={cn(
                                "w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-soft)]",
                                !item.read && "bg-[var(--accent-soft)]/50"
                              )}
                              onClick={async () => {
                                await apiRequest(`/notifications/${item.id}/read`, {
                                  method: "POST",
                                });
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
                {action ? <div className="flex min-w-0 flex-wrap items-center gap-1.5">{action}</div> : null}
              </div>
            </div>
          </header>
          <main id="main-content" className="flex-1 px-4 py-6 md:px-8 md:py-8" tabIndex={-1} aria-label={t("a11y.main")}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
