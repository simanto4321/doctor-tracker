import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDate as formatDateLocale } from "./datetime";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Locale-aware calendar date (respects app language + local date-only parsing). */
export function formatDate(value?: string | Date) {
  return formatDateLocale(value);
}

export {
  formatDateTime,
  formatTime,
  formatTimeRange,
  toLocalDateInput,
  toLocalDateTimeInput,
  localDayBoundsIso,
  shiftLocalDate,
  parseLocalDateOnly,
} from "./datetime";
