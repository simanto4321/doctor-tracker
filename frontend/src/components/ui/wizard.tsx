"use client";

import { cn } from "@/lib/utils";

export function WizardSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="mb-4 flex flex-wrap gap-2" aria-label="Form steps">
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
              active && "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]",
              done && "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]",
              !active && !done && "border-[var(--border)] text-[var(--muted)]"
            )}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                active || done ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-soft)]"
              )}
            >
              {index + 1}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}
