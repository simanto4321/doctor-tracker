export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-6 py-16 text-center">
      <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--foreground)]">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
