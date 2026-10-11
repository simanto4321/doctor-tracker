"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Stethoscope, Users, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const PIE_COLORS = ["#0f766e", "#1d4f78", "#0ea5a4", "#64748b", "#14b8a6", "#334155"];

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
          <p className="mt-2 font-[family-name:var(--font-display)] text-3xl">{value}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
        </div>
        <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent-strong)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiRequest<DashboardStats>("/dashboard/stats");
        if (active) setStats(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthGuard>
      <AppShell
        title="Dashboard"
        subtitle="Caseload, specialty mix, and patient intake at a glance."
      >
        {loading ? (
          <div className="panel p-10 text-[var(--muted)]">Loading analytics…</div>
        ) : error ? (
          <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5 text-[var(--danger)]">
            {error}
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total doctors"
                value={stats.totals.doctors}
                hint="Active clinicians in registry"
                icon={Stethoscope}
                delayClass=""
              />
              <StatCard
                label="Total patients"
                value={stats.totals.patients}
                hint="Across all assigned doctors"
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

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <div className="panel animate-rise p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-xl">
                      Patient intake trend
                    </h2>
                    <p className="text-sm text-[var(--muted)]">Last 30 days of registrations</p>
                  </div>
                  <Badge tone="accent">Date-based</Badge>
                </div>
                <div className="h-72">
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
                <h2 className="font-[family-name:var(--font-display)] text-xl">Condition mix</h2>
                <p className="mb-4 text-sm text-[var(--muted)]">Share of tracked patient conditions</p>
                <div className="h-72">
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

            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div className="panel animate-rise p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl">Patients per doctor</h2>
                <p className="mb-4 text-sm text-[var(--muted)]">Top caseloads in the clinic</p>
                <div className="h-72">
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
                      <span>{row.name}</span>
                      <Badge tone="neutral">{row.patients} patients</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel animate-rise-delay-1 p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl">Recent patients</h2>
                <p className="mb-4 text-sm text-[var(--muted)]">Newest records in the system</p>
                <div className="space-y-3">
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
          </div>
        ) : null}
      </AppShell>
    </AuthGuard>
  );
}
