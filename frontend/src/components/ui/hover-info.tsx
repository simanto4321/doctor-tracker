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

function preferHover() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

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
  const [canHover, setCanHover] = useState(true);

  useEffect(() => {
    setMounted(true);
    setCanHover(preferHover());
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onChange = () => setCanHover(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!anchorRef.current) return;
      const tip = document.getElementById(tipId);
      const target = e.target as Node;
      if (anchorRef.current.contains(target)) return;
      if (tip?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, tipId]);

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
    const tipW = Math.min(288, window.innerWidth - 16);
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - tipW / 2;
    if (side === "top") {
      top = rect.top - gap - 8;
      left = rect.left + rect.width / 2 - tipW / 2;
    } else if (side === "left") {
      top = rect.top + rect.height / 2 - 40;
      left = rect.left - tipW - gap;
    } else if (side === "right") {
      top = rect.top + rect.height / 2 - 40;
      left = rect.right + gap;
    }
    const maxLeft = window.innerWidth - tipW - 8;
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
            className="pointer-events-none fixed z-[80] w-[min(18rem,calc(100vw-1rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-xl text-[var(--foreground)]"
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
            {insight?.updatedAt && !loading ? (
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
      onMouseEnter={() => {
        if (canHover) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHover) setOpen(false);
      }}
      onFocus={() => {
        if (canHover) setOpen(true);
      }}
      onBlur={() => {
        if (canHover) setOpen(false);
      }}
    >
      {children || (
        <button
          type="button"
          className="touch-target inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)] sm:h-7 sm:w-7 sm:min-h-7 sm:min-w-7"
          aria-describedby={open ? tipId : undefined}
          aria-expanded={open}
          aria-label={`About ${label || feature}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
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
