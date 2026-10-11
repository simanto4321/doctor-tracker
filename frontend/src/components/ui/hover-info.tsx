"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const gap = 8;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - 144;
    if (side === "top") {
      top = rect.top - gap;
      left = rect.left + rect.width / 2 - 144;
    } else if (side === "left") {
      top = rect.top + rect.height / 2 - 40;
      left = rect.left - 288 - gap;
    } else if (side === "right") {
      top = rect.top + rect.height / 2 - 40;
      left = rect.right + gap;
    }
    const maxLeft = window.innerWidth - 300;
    const maxTop = window.innerHeight - 16;
    setCoords({
      top: Math.max(8, Math.min(top, maxTop)),
      left: Math.max(8, Math.min(left, maxLeft)),
    });
  }, [open, side]);

  const tooltip =
    open && mounted && coords
      ? createPortal(
          <div
            id={tipId}
            role="tooltip"
            className="pointer-events-none fixed z-[80] w-72 rounded-2xl border border-[var(--border)] bg-white p-3 text-left shadow-xl"
            style={{ top: coords.top, left: coords.left }}
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
                    <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {insight?.updatedAt ? (
              <p className="mt-2 text-[10px] text-[var(--muted)]">
                Updated {new Date(insight.updatedAt).toLocaleTimeString()}
              </p>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <span
      ref={anchorRef}
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
      {tooltip}
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
