"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

type EntityHoverProps = {
  href?: string;
  title: string;
  lines: Array<{ label: string; value: string }>;
  badge?: string;
  className?: string;
  children: React.ReactNode;
};

/** Hover card for concrete rows (doctor/patient/appointment) with latest details. */
export function EntityHover({ href, title, lines, badge, className, children }: EntityHoverProps) {
  const [open, setOpen] = useState(false);
  const content = (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl text-[var(--foreground)]">
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
                <span className="font-medium text-[var(--foreground)]">{line.value}</span>
              </div>
            ))}
          </div>
          {href ? (
            <p className="mt-3 text-[10px] font-semibold text-[var(--accent-strong)]">Open details →</p>
          ) : null}
        </div>
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }
  return content;
}
