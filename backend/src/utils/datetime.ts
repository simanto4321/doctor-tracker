/**
 * Date/time helpers for API filters.
 * - Full ISO datetimes → absolute instants
 * - Date-only YYYY-MM-DD → start/end of that calendar day in CLINIC_TIMEZONE
 */

import { config } from "../config.js";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function clinicTimeZone() {
  return process.env.CLINIC_TIMEZONE || config.clinicTimeZone || "UTC";
}

/** Offset (ms) of `timeZone` ahead of UTC at the given instant. */
function timeZoneOffsetMs(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - date.getTime();
}

/** Instant when the clinic clock reads y-m-d HH:mm:ss.ms */
function zonedWallTime(
  y: number,
  m: number,
  day: number,
  h: number,
  mi: number,
  s: number,
  ms: number,
  timeZone: string
) {
  let utc = Date.UTC(y, m - 1, day, h, mi, s, ms);
  for (let i = 0; i < 4; i += 1) {
    const offsetMs = timeZoneOffsetMs(new Date(utc), timeZone);
    utc = Date.UTC(y, m - 1, day, h, mi, s, ms) - offsetMs;
  }
  return new Date(utc);
}

/**
 * Start (00:00:00.000) or end (23:59:59.999) of a calendar day in the clinic timezone.
 * Non date-only strings are parsed as absolute instants (ISO recommended from the client).
 */
export function boundForDateInput(value: string, which: "start" | "end") {
  const trimmed = value.trim();
  const dateOnly = DATE_ONLY.exec(trimmed);
  if (!dateOnly) {
    return new Date(trimmed);
  }

  const y = Number(dateOnly[1]);
  const m = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  const timeZone = clinicTimeZone();

  if (which === "start") {
    return zonedWallTime(y, m, day, 0, 0, 0, 0, timeZone);
  }

  // Prefer next-day midnight minus 1ms — more stable across DST than 23:59:59.999.
  const next = new Date(Date.UTC(y, m - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextStart = zonedWallTime(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone
  );
  return new Date(nextStart.getTime() - 1);
}

export function formatInClinic(date: Date, options?: Intl.DateTimeFormatOptions) {
  return date.toLocaleString("en-US", {
    timeZone: clinicTimeZone(),
    ...options,
  });
}
