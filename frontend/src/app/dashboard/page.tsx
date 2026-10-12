"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BookmarkPlus,
  CalendarRange,
  Download,
  FileImage,
  FileText,
  Stethoscope,
  Trash2,
  Users,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { DoctorPhoto } from "@/components/doctor-photo";
import { EntityHover } from "@/components/entity-hover";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeatureTitle, HoverInfo } from "@/components/ui/hover-info";
import { Input, Select } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { apiRequest, toQuery } from "@/lib/api";
import type { DashboardPreset, DashboardStats, Doctor } from "@/lib/types";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { LiveRegion } from "@/components/ui/live-region";
import { cn, formatDate } from "@/lib/utils";

const PIE_COLORS = ["#0f766e", "#1d4f78", "#0ea5a4", "#64748b", "#14b8a6", "#334155"];
const LINE_COLORS = ["#0f766e", "#1d4f78", "#c2410c", "#7c3aed", "#0369a1"];

/** Local calendar YYYY-MM-DD (avoid UTC drift from toISOString). */
function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDays(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toInputDate(d);
}

function yearStart() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function isCompleteDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delayClass,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  delayClass: string;
}) {
  return (
    <div className={`panel animate-rise ${delayClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">{label}</p>
          <p className="mt-2 font-display text-3xl">{value}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
        </div>
        <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent-strong)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function heatColor(value: number, max: number) {
  if (!max || value <= 0) return "bg-[var(--surface-soft)] text-[var(--muted)]";
  const ratio = value / max;
  if (ratio > 0.75) return "bg-teal-700 text-white";
  if (ratio > 0.5) return "bg-teal-500 text-white";
  if (ratio > 0.25) return "bg-teal-300 text-teal-950";
  return "bg-teal-100 text-teal-900";
}

export default function DashboardPage() {
  const boardRef = useRef<HTMLDivElement>(null);
  const statsReqId = useRef(0);
  const doctorsReqId = useRef(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [from, setFrom] = useState(shiftDays(-29));
  const [to, setTo] = useState(toInputDate(new Date()));
  const [hospital, setHospital] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [presets, setPresets] = useState<DashboardPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeRange, setActiveRange] = useState<"7d" | "30d" | "90d" | "ytd" | null>("30d");

  const reloadDashboard = useCallback(async () => {
    if (!isCompleteDate(from) || !isCompleteDate(to)) return;
    const reqId = ++statsReqId.current;
    setRefreshing(true);
    setError("");
    try {
      const [statsData, doctorData] = await Promise.all([
        apiRequest<DashboardStats>(
          `/dashboard/stats${toQuery({ from, to, hospital, specialization })}`
        ),
        apiRequest<{ items: Doctor[] }>(
          `/doctors${toQuery({ hospital, specialization, limit: 24, sort: "name", dir: "asc" })}`
        ),
      ]);
      if (reqId !== statsReqId.current) return;
      setStats(statsData);
      setDoctors(doctorData.items);
    } catch (err) {
      if (reqId !== statsReqId.current) return;
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      if (reqId === statsReqId.current) setRefreshing(false);
    }
  }, [from, to, hospital, specialization]);

  const pull = usePullToRefresh(reloadDashboard, true);

  const loadPresets = useCallback(async () => {
    try {
      const data = await apiRequest<{ items: DashboardPreset[] }>("/dashboard/presets");
      setPresets(data.items);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // Debounced stats fetch; ignore stale responses; avoid full-page skeleton on filter tweaks.
  useEffect(() => {
    if (!isCompleteDate(from) || !isCompleteDate(to)) return;
    const reqId = ++statsReqId.current;
    const timer = window.setTimeout(async () => {
      const initial = !stats;
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const data = await apiRequest<DashboardStats>(
          `/dashboard/stats${toQuery({ from, to, hospital, specialization })}`
        );
        if (reqId !== statsReqId.current) return;
        setStats(data);
      } catch (err) {
        if (reqId !== statsReqId.current) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (reqId === statsReqId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      statsReqId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stats intentionally omitted to avoid loop
  }, [from, to, hospital, specialization]);

  useEffect(() => {
    const reqId = ++doctorsReqId.current;
    const timer = window.setTimeout(async () => {
      try {
        const data = await apiRequest<{ items: Doctor[] }>(
          `/doctors${toQuery({ hospital, specialization, limit: 24, sort: "name", dir: "asc" })}`
        );
        if (reqId !== doctorsReqId.current) return;
        setDoctors(data.items);
      } catch {
        if (reqId !== doctorsReqId.current) return;
        setDoctors([]);
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      doctorsReqId.current += 1;
    };
  }, [hospital, specialization]);

  const heatMax = useMemo(() => {
    const cells = stats?.specializationHeatmap?.cells || [];
    return cells.reduce((max, cell) => Math.max(max, cell.patients), 0);
  }, [stats]);

  const utilizationKeys = useMemo(() => {
    const series = stats?.doctorUtilization?.series || [];
    if (!series.length) return [] as string[];
    return Object.keys(series[0]).filter((key) => key !== "date" && key !== "label");
  }, [stats]);

  function applyQuickRange(kind: "7d" | "30d" | "90d" | "ytd") {
    setActiveRange(kind);
    setTo(toInputDate(new Date()));
    if (kind === "7d") setFrom(shiftDays(-6));
    if (kind === "30d") setFrom(shiftDays(-29));
    if (kind === "90d") setFrom(shiftDays(-89));
    if (kind === "ytd") setFrom(yearStart());
  }

  async function savePreset() {
    if (!presetName.trim()) {
      toast.error("Name the preset first");
      return;
    }
    try {
      await apiRequest("/dashboard/presets", {
        method: "POST",
        body: {
          name: presetName.trim(),
          filters: { from, to, hospital, specialization },
        },
      });
      toast.success("Preset saved");
      setPresetName("");
      await loadPresets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save preset");
    }
  }

  function applyPreset(preset: DashboardPreset) {
    setFrom(preset.filters.from || shiftDays(-29));
    setTo(preset.filters.to || toInputDate(new Date()));
    setHospital(preset.filters.hospital || "");
    setSpecialization(preset.filters.specialization || "");
    toast.success(`Applied “${preset.name}”`);
  }

  async function deletePreset(id: string) {
    try {
      await apiRequest(`/dashboard/presets/${id}`, { method: "DELETE" });
      toast.success("Preset deleted");
      await loadPresets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete preset");
    }
  }

  async function exportBoard(format: "png" | "pdf") {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(boardRef.current, {
        scale: 2,
        backgroundColor: "#edf7f4",
        useCORS: true,
      });
      if (format === "png") {
        const link = document.createElement("a");
        link.download = `doctor-tracker-dashboard-${from}_to_${to}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("Dashboard PNG downloaded");
      } else {
        const { jsPDF } = await import("jspdf");
        const img = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;
        const ratio = Math.min(usableWidth / canvas.width, usableHeight / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.setFontSize(14);
        pdf.text("Doctor Tracker · Dashboard export", margin, 18);
        pdf.addImage(img, "PNG", margin, 28, w, h);
        pdf.save(`doctor-tracker-dashboard-${from}_to_${to}.pdf`);
        toast.success("Dashboard PDF downloaded");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell
        feature="dashboard"
        title="Dashboard"
        subtitle="Date-range analytics, hospital compare, utilization, and exports."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <HoverInfo feature="dashboard-export" label="Export dashboard">
              <Button
                variant="secondary"
                size="sm"
                disabled={exporting || !stats}
                onClick={() => exportBoard("png")}
              >
                <FileImage className="h-4 w-4" />
                PNG
              </Button>
            </HoverInfo>
            <HoverInfo feature="dashboard-export" label="Export dashboard">
              <Button
                variant="secondary"
                size="sm"
                disabled={exporting || !stats}
                onClick={() => exportBoard("pdf")}
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </HoverInfo>
          </div>
        }
      >
        {(pull.progress > 0.05 || pull.refreshing) && (
          <LiveRegion busy={pull.refreshing}>
            <div className="mb-3 flex justify-center text-xs font-semibold text-[var(--accent-strong)]">
              {pull.refreshing
                ? "Refreshing…"
                : pull.progress >= 1
                  ? "Release to refresh"
                  : "Pull to refresh"}
            </div>
          </LiveRegion>
        )}

        <div className="panel mb-5 space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FeatureTitle
              feature="dashboard-range"
              title="Analytics filters"
              subtitle="Pick a date range, hospital, or specialty — then save as a preset."
            />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["7d", "7 days"],
                  ["30d", "30 days"],
                  ["90d", "90 days"],
                  ["ytd", "YTD"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={activeRange === key ? "primary" : "secondary"}
                  aria-pressed={activeRange === key}
                  onClick={() => applyQuickRange(key)}
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                From
              </span>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setActiveRange(null);
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
                  setActiveRange(null);
                  setTo(e.target.value);
                }}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Hospital
              </span>
              <Select value={hospital} onChange={(e) => setHospital(e.target.value)}>
                <option value="">All hospitals</option>
                {(stats?.filtersMeta?.hospitals || []).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Specialization
              </span>
              <Select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
                <option value="">All specialties</option>
                {(stats?.filtersMeta?.specializations || []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-4">
            <HoverInfo feature="dashboard-presets" label="Saved presets" />
            <label className="min-w-0 w-full flex-1 space-y-1.5 sm:min-w-[12rem]">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Save current filters
              </span>
              <Input
                placeholder="e.g. Harborview 30d"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </label>
            <Button onClick={savePreset}>
              <BookmarkPlus className="h-4 w-4" />
              Save preset
            </Button>
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
              >
                <button
                  type="button"
                  className="px-2 text-sm font-semibold text-[var(--accent-strong)] hover:underline"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.name}
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="touch-target h-10 w-10 sm:h-8 sm:w-8 sm:min-h-8 sm:min-w-8"
                  onClick={() => deletePreset(preset.id)}
                  aria-label={`Delete ${preset.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-[var(--danger)]" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {loading && !stats ? (
          <PageSkeleton />
        ) : error && !stats ? (
          <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-[var(--danger)]">
            {error}
          </div>
        ) : stats ? (
          <div
            ref={boardRef}
            className={cn(
              "space-y-6 bg-[var(--background)] transition-opacity",
              refreshing && "opacity-70"
            )}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              {refreshing ? (
                <span className="text-xs font-semibold text-[var(--accent-strong)]" role="status">
                  Updating…
                </span>
              ) : null}
              <Badge tone="accent">
                {formatDate(stats.range?.from || from)} → {formatDate(stats.range?.to || to)}
              </Badge>
              {stats.appliedFilters?.hospital ? (
                <Badge tone="neutral">{stats.appliedFilters.hospital}</Badge>
              ) : null}
              {stats.appliedFilters?.specialization ? (
                <Badge tone="neutral">{stats.appliedFilters.specialization}</Badge>
              ) : null}
              <span>{stats.totals.patientsInRange ?? 0} new patients in range</span>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total doctors"
                value={stats.totals.doctors}
                hint="Active clinicians in filter"
                icon={Stethoscope}
                delayClass=""
              />
              <StatCard
                label="Total patients"
                value={stats.totals.patients}
                hint="Across filtered caseload"
                icon={Users}
                delayClass="animate-rise-delay-1"
              />
              <StatCard
                label="Avg patients / doctor"
                value={stats.totals.avgPatientsPerDoctor}
                hint="Balanced caseload signal"
                icon={Activity}
                delayClass="animate-rise-delay-2"
              />
              <StatCard
                label="Conditions tracked"
                value={stats.totals.conditionsTracked}
                hint="Top clinical categories"
                icon={Waves}
                delayClass="animate-rise-delay-2"
              />
            </div>

            <section className="panel animate-rise p-3 sm:p-5">
              <h2 className="mb-3 font-display text-xl tracking-tight text-[var(--foreground)] uppercase sm:mb-4 sm:text-2xl">
                Doctors
              </h2>
              {doctors.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No doctors match the current filters.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
                  {doctors.map((doctor) => (
                    <EntityHover
                      key={doctor.id}
                      href={`/doctors/${doctor.id}`}
                      title={doctor.name}
                      badge={doctor.specialization}
                      placement="top"
                      className="w-full"
                      lines={[
                        { label: "Post", value: doctor.title || "Specialist" },
                        { label: "Degrees", value: doctor.degrees || "—" },
                        { label: "Specialty", value: doctor.specialization },
                        { label: "Department", value: doctor.department || "—" },
                        { label: "Hospital", value: doctor.hospital },
                        { label: "Schedule", value: doctor.workingHours || "—" },
                        { label: "Phone", value: doctor.phone },
                        { label: "Email", value: doctor.email },
                        { label: "Patients", value: String(doctor.patientCount ?? 0) },
                      ]}
                    >
                      <div className="flex w-full flex-col items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-3 text-center transition hover:border-[var(--accent)] hover:shadow-sm sm:px-3 sm:py-4">
                        <DoctorPhoto name={doctor.name} photoUrl={doctor.photoUrl} size="lg" />
                        <p className="mt-2 line-clamp-2 text-xs font-semibold text-[var(--foreground)] sm:mt-3 sm:text-sm">
                          {doctor.name}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-[var(--accent-strong)] sm:mt-1 sm:text-xs">
                          {doctor.specialization}
                        </p>
                        <p className="mt-0.5 hidden line-clamp-1 text-[11px] text-[var(--muted)] sm:block">
                          {doctor.title || doctor.department || doctor.hospital}
                        </p>
                      </div>
                    </EntityHover>
                  ))}
                </div>
              )}
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <div className="panel animate-rise p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <FeatureTitle
                    feature="dashboard-range"
                    title="Patient intake trend"
                    subtitle={`Registrations from ${stats.range?.from} to ${stats.range?.to}`}
                  />
                  <Badge tone="accent">Date-based</Badge>
                </div>
                <div className="h-52 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.patientTrend}>
                      <defs>
                        <linearGradient id="patientFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#d7e5df" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#5d746d", fontSize: 11 }} minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fill: "#5d746d", fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="patients"
                        stroke="#0f766e"
                        fill="url(#patientFill)"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="panel animate-rise-delay-1 p-5">
                <FeatureTitle
                  feature="dashboard"
                  title="Condition mix"
                  subtitle="Share of tracked patient conditions"
                />
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.conditionBreakdown}
                        dataKey="count"
                        nameKey="condition"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {stats.conditionBreakdown.map((entry, index) => (
                          <Cell key={entry.condition} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="panel p-5">
                <FeatureTitle
                  feature="dashboard-demographics"
                  title="Gender distribution"
                  subtitle="Active patient panel by gender"
                />
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.genderBreakdown || []}>
                      <CartesianGrid stroke="#d7e5df" vertical={false} />
                      <XAxis dataKey="gender" tick={{ fill: "#5d746d", fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "#5d746d", fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1d4f78" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="panel p-5">
                <FeatureTitle
                  feature="dashboard-demographics"
                  title="Age distribution"
                  subtitle="Age bands across the filtered panel"
                />
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.ageBreakdown || []}>
                      <CartesianGrid stroke="#d7e5df" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fill: "#5d746d", fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "#5d746d", fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0f766e" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
              <div className="panel p-5">
                <FeatureTitle
                  feature="dashboard-heatmap"
                  title="Specialization heatmap"
                  subtitle="Patient volume by hospital × specialty"
                />
                <div className="mt-4 overflow-x-auto">
                  {(stats.specializationHeatmap?.hospitals.length || 0) === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No heatmap data for this filter.</p>
                  ) : (
                    <table className="min-w-full border-separate border-spacing-1 text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-1 text-left font-semibold text-[var(--muted)]">
                            Hospital
                          </th>
                          {stats.specializationHeatmap!.specializations.map((spec) => (
                            <th
                              key={spec}
                              className="px-2 py-1 text-left font-semibold text-[var(--muted)]"
                            >
                              {spec}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stats.specializationHeatmap!.hospitals.map((h) => (
                          <tr key={h}>
                            <td className="whitespace-nowrap px-2 py-1 font-semibold">{h}</td>
                            {stats.specializationHeatmap!.specializations.map((spec) => {
                              const cell = stats.specializationHeatmap!.cells.find(
                                (c) => c.hospital === h && c.specialization === spec
                              );
                              const value = cell?.patients || 0;
                              return (
                                <td key={`${h}-${spec}`}>
                                  <div
                                    className={cn(
                                      "rounded-lg px-2 py-2 text-center font-semibold",
                                      heatColor(value, heatMax)
                                    )}
                                    title={`${h} · ${spec}: ${value}`}
                                  >
                                    {value}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="panel p-5">
                <FeatureTitle
                  feature="dashboard-heatmap"
                  title="Hospital comparison"
                  subtitle="Patients, doctors, and average caseload"
                />
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.hospitalComparison || []}>
                      <CartesianGrid stroke="#d7e5df" vertical={false} />
                      <XAxis dataKey="hospital" tick={{ fill: "#5d746d", fontSize: 10 }} hide />
                      <YAxis allowDecimals={false} tick={{ fill: "#5d746d", fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="patients" fill="#0f766e" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="doctors" fill="#1d4f78" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-2">
                  {(stats.hospitalComparison || []).map((row) => (
                    <div key={row.hospital} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-3">{row.hospital}</span>
                      <Badge tone="neutral">
                        {row.patients} pts · avg {row.avgPerDoctor}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel p-5">
              <FeatureTitle
                feature="dashboard-utilization"
                title="Doctor utilization"
                subtitle="New patients over time for the busiest clinicians in range"
              />
              <div className="mt-4 h-80">
                {(stats.doctorUtilization?.series.length || 0) === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No intake in this date range to chart utilization.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.doctorUtilization!.series}>
                      <CartesianGrid stroke="#d7e5df" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#5d746d", fontSize: 11 }} minTickGap={28} />
                      <YAxis allowDecimals={false} tick={{ fill: "#5d746d", fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {utilizationKeys.map((key, index) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={LINE_COLORS[index % LINE_COLORS.length]}
                          strokeWidth={2.25}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div className="panel animate-rise p-5">
                <FeatureTitle
                  feature="dashboard"
                  title="Patients per doctor"
                  subtitle="Top caseloads in the current filter"
                />
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.patientsPerDoctor}>
                      <CartesianGrid stroke="#d7e5df" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#5d746d", fontSize: 11 }} hide />
                      <YAxis allowDecimals={false} tick={{ fill: "#5d746d", fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="patients" fill="#0f766e" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-2">
                  {stats.patientsPerDoctor.slice(0, 4).map((row) => (
                    <div key={row.doctorId} className="flex items-center justify-between text-sm">
                      <span>
                        {row.name}
                        {row.hospital ? (
                          <span className="text-[var(--muted)]"> · {row.hospital}</span>
                        ) : null}
                      </span>
                      <Badge tone="neutral">{row.patients} patients</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel animate-rise-delay-1 p-5">
                <FeatureTitle
                  feature="dashboard"
                  title="Recent patients"
                  subtitle="Newest records in the filtered set"
                />
                <div className="mt-4 space-y-3">
                  {stats.recentPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{patient.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {patient.doctor} · {formatDate(patient.createdAt)}
                          </p>
                        </div>
                        <Badge tone="info">{patient.condition}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <Download className="h-3.5 w-3.5" />
              Use PNG / PDF in the header to export this analytics board.
            </div>
          </div>
        ) : null}
      </AppShell>
    </AuthGuard>
  );
}
