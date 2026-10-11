"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

type Insight = {
  title: string;
  summary: string;
  stats: Array<{ label: string; value: string }>;
  updatedAt: string;
};

type HoverInfoProps = {
  feature: string;
  label?: string;
  className?: string;
  /** Optional static fallback while/without API */
  fallbackSummary?: string;
  side?: "top" | "bottom" | "left" | "right";
  children?: React.ReactNode;
};

export function HoverInfo({
  feature,
  label,
  className,
  fallbackSummary,
  side = "bottom",
  children,
}: HoverInfoProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || insight) return;
    let active = true;
    setLoading(true);
    apiRequest<Insight>(`/insights/hover/${feature}`)
      .then((data) => {
        if (active) setInsight(data);
      })
      .catch(() => {
        if (active) {
          setInsight({
            title: label || feature,
            summary: fallbackSummary || "Feature details unavailable.",
            stats: [],
            updatedAt: new Date().toISOString(),
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, insight, feature, label, fallbackSummary]);

  const position =
    side === "top"
      ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
      : side === "left"
        ? "right-full top-1/2 mr-2 -translate-y-1/2"
        : side === "right"
          ? "left-full top-1/2 ml-2 -translate-y-1/2"
          : "top-full left-1/2 mt-2 -translate-x-1/2";

  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children || (
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          aria-describedby={open ? tipId : undefined}
          aria-label={`About ${label || feature}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      )}

      {open ? (
        <div
          id={tipId}
          role="tooltip"
          className={cn(
            "absolute z-50 w-72 rounded-2xl border border-[var(--border)] bg-white p-3 text-left shadow-xl",
            position
          )}
        >
          <p className="font-display text-base text-[var(--foreground)]">
            {insight?.title || label || feature}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {loading ? "Loading latest details…" : insight?.summary || fallbackSummary}
          </p>
          {insight?.stats?.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {insight.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-[var(--surface-soft)] px-2.5 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{stat.value}</p>
                </div>
              ))}
            </div>
          ) : null}
          {insight?.updatedAt ? (
            <p className="mt-2 text-[10px] text-[var(--muted)]">
              Updated {new Date(insight.updatedAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

export function FeatureTitle({
  feature,
  title,
  subtitle,
}: {
  feature: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl">{title}</h2>
          <HoverInfo feature={feature} label={title} />
        </div>
        {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
    </div>
  );
}
