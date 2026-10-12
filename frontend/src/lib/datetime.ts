/**
 * Local-calendar and locale-aware date/time helpers.
 * Avoid Date#toISOString().slice for inputs — that shifts the day in non-UTC zones.
 */

const LOCALE_TAG: Record<string, string> = {
  en: "en-US",
  bn: "bn-BD",
  es: "es-ES",
  fr: "fr-FR",
  hi: "hi-IN",
  ar: "ar-SA",
};

export function activeLocaleTag() {
  if (typeof document === "undefined") return "en-US";
  const lang = document.documentElement.lang || "en";
  return LOCALE_TAG[lang] || lang || "en-US";
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Local calendar YYYY-MM-DD */
export function toLocalDateInput(date: Date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local datetime-local value YYYY-MM-DDTHH:mm */
export function toLocalDateTimeInput(date: Date = new Date()) {
  return `${toLocalDateInput(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseLocalDateOnly(value: string, hour = 12) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, 0, 0, 0);
}

export function localDayStart(dateOnly: string) {
  return parseLocalDateOnly(dateOnly, 0);
}

export function localDayEnd(dateOnly: string) {
  const d = parseLocalDateOnly(dateOnly, 0);
  if (Number.isNaN(d.getTime())) return d;
  d.setHours(23, 59, 59, 999);
  return d;
}

/** ISO bounds for a local calendar day — send these to the API for timezone-safe filters. */
export function localDayBoundsIso(dateOnly: string) {
  return {
    from: localDayStart(dateOnly).toISOString(),
    to: localDayEnd(dateOnly).toISOString(),
  };
}

export function shiftLocalDate(dateOnly: string, deltaDays: number) {
  const d = parseLocalDateOnly(dateOnly, 12);
  d.setDate(d.getDate() + deltaDays);
  return toLocalDateInput(d);
}

export function formatDate(
  value?: string | Date,
  options?: Intl.DateTimeFormatOptions,
  locale = activeLocaleTag()
) {
  if (!value) return "—";
  let date: Date;
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    date = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
      : new Date(value);
  } else {
    date = value;
  }
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, options || {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(
  value?: string | Date,
  options?: Intl.DateTimeFormatOptions,
  locale = activeLocaleTag()
) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale, options || {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(
  value?: string | Date,
  options?: Intl.DateTimeFormatOptions,
  locale = activeLocaleTag()
) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, options || {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeRange(startsAt?: string | Date, endsAt?: string | Date) {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}
