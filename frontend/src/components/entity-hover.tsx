"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type EntityHoverProps = {
  href?: string;
  title: string;
  lines: Array<{ label: string; value: string }>;
  badge?: string;
  className?: string;
  /** Where the details card appears relative to the trigger */
  placement?: "top" | "bottom";
  children: React.ReactNode;
};

/** Hover/touch card for concrete rows (doctor/patient/appointment) with latest details. */
export function EntityHover({
  href,
  title,
  lines,
  badge,
  className,
  placement = "bottom",
  children,
}: EntityHoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; place: "top" | "bottom" } | null>(
    null
  );

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }

    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      const gap = 10;
      const cardWidth = 288;
      const estimatedHeight = 220;
      let place = placement;

      // Prefer requested side; flip if there isn't enough room
      if (place === "top" && rect.top < estimatedHeight + gap + 8) {
        place = "bottom";
      } else if (place === "bottom" && window.innerHeight - rect.bottom < estimatedHeight + gap + 8) {
        place = "top";
      }

      // Anchor Y: bottom edge of card when above, top edge when below
      const top =
        place === "top" ? rect.top - gap : rect.bottom + gap;
      const left = rect.left + rect.width / 2 - cardWidth / 2;

      setCoords({
        top,
        left: Math.max(8, Math.min(left, window.innerWidth - cardWidth - 8)),
        place,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, placement]);

  function show() {
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  const card =
    open && mounted && coords
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[80] w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl text-[var(--foreground)]"
            style={{
              top: coords.place === "top" ? undefined : coords.top,
              bottom:
                coords.place === "top" ? window.innerHeight - coords.top : undefined,
              left: coords.left,
              transform: coords.place === "top" ? "translateY(-100%)" : undefined,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[var(--foreground)]">{title}</p>
              {badge ? (
                <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                  {badge}
                </span>
              ) : null}
            </div>
            <div className="mt-2 space-y-1.5">
              {lines.map((line) => (
                <div key={line.label} className="flex justify-between gap-3 text-xs">
                  <span className="text-[var(--muted)]">{line.label}</span>
                  <span className="max-w-[58%] text-right font-medium text-[var(--foreground)]">
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
            {href ? (
              <p className="mt-3 text-[10px] font-semibold text-[var(--accent-strong)]">
                Tap / click for full page →
              </p>
            ) : null}
          </div>,
          document.body
        )
      : null;

  const trigger = (
    <span
      ref={anchorRef}
      className={cn("relative inline-flex w-full", !href && className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={show}
    >
      {children}
      {card}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={cn("inline-flex w-full", className)}>
        {trigger}
      </Link>
    );
  }

  return trigger;
}
