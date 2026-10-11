import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "bg-[var(--surface-soft)] text-[var(--muted)] border-[var(--border)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent-border)]",
    success: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success-border)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning-border)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger-border)]",
    info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info-border)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
