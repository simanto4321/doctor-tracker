"use client";

/** Polite live region for loading / status updates (screen readers). */
export function LiveRegion({
  children,
  busy,
}: {
  children: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy={busy ? true : undefined}>
      {children}
    </div>
  );
}
