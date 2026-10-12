import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | Date) {
  if (!value) return "—";
  let date: Date;
  if (typeof value === "string") {
    // Parse date-only as local calendar day (avoid UTC midnight shift).
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    date = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
      : new Date(value);
  } else {
    date = value;
  }
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
