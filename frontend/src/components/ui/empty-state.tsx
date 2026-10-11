"use client";

import { cn } from "@/lib/utils";

function EmptyIllustration({ kind }: { kind: "doctors" | "patients" | "generic" }) {
  if (kind === "doctors") {
    return (
      <svg
        viewBox="0 0 160 120"
        className="h-28 w-40 text-[var(--accent)]"
        role="img"
        aria-hidden
      >
        <rect x="18" y="28" width="124" height="72" rx="16" fill="currentColor" opacity="0.12" />
        <circle cx="56" cy="58" r="16" fill="currentColor" opacity="0.35" />
        <rect x="80" y="48" width="46" height="8" rx="4" fill="currentColor" opacity="0.45" />
        <rect x="80" y="62" width="34" height="6" rx="3" fill="currentColor" opacity="0.28" />
        <path
          d="M70 88c8-10 20-10 28 0"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          opacity="0.55"
        />
        <circle cx="118" cy="36" r="10" fill="currentColor" opacity="0.55" />
        <path d="M118 30v12M112 36h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "patients") {
    return (
      <svg
        viewBox="0 0 160 120"
        className="h-28 w-40 text-[var(--info)]"
        role="img"
        aria-hidden
      >
        <rect x="20" y="24" width="120" height="78" rx="16" fill="currentColor" opacity="0.1" />
        <rect x="36" y="40" width="52" height="46" rx="10" fill="currentColor" opacity="0.28" />
        <circle cx="62" cy="56" r="9" fill="currentColor" opacity="0.55" />
        <path d="M48 78c4-8 24-8 28 0" fill="currentColor" opacity="0.4" />
        <rect x="98" y="44" width="28" height="6" rx="3" fill="currentColor" opacity="0.4" />
        <rect x="98" y="56" width="22" height="6" rx="3" fill="currentColor" opacity="0.28" />
        <rect x="98" y="68" width="26" height="6" rx="3" fill="currentColor" opacity="0.22" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 120" className="h-28 w-40 text-[var(--muted)]" role="img" aria-hidden>
      <ellipse cx="80" cy="88" rx="46" ry="12" fill="currentColor" opacity="0.12" />
      <rect x="48" y="34" width="64" height="48" rx="12" fill="currentColor" opacity="0.2" />
      <path
        d="M64 58h32M80 42v32"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
  kind = "generic",
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  kind?: "doctors" | "patients" | "generic";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/70 px-6 py-16 text-center",
        className
      )}
      role="status"
    >
      <EmptyIllustration kind={kind} />
      <h3 className="mt-4 font-display text-xl text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
