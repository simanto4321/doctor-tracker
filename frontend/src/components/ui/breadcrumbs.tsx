"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-1", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3 w-3 opacity-60" aria-hidden /> : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="font-semibold text-[var(--accent-strong)] underline-offset-2 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn("font-semibold", last && "text-[var(--foreground)]")}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
