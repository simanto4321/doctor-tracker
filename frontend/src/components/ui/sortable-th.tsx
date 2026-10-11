"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortableThProps = {
  label: string;
  column: string;
  sort: string;
  dir: "asc" | "desc";
  onSort: (column: string) => void;
  className?: string;
};

export function SortableTh({ label, column, sort, dir, onSort, className }: SortableThProps) {
  const active = sort === column;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
          active && "text-[var(--accent-strong)]",
          className
        )}
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
        )}
      </button>
    </th>
  );
}
