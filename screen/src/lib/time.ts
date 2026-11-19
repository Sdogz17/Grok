/** Civil dates for the screen-time calendar. Australia/Sydney, including DST. */

export const TIMEZONE = "Australia/Sydney";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const MS_MINUTE = 60_000;
export const MS_HOUR = 3_600_000;
/** A Sydney civil day is 23h, 24h, or 25h. 26h is the stored upper bound. */
export const MAX_DAY_MS = 26 * MS_HOUR;
/** The repeated hour on the April fallback can hold two clock hours. */
export const MAX_HOUR_MS = 2 * MS_HOUR;
export const EARLIEST_DATE = "2018-01-01";

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** YYYY-MM-DD in the given IANA zone. Uses the zone database, not a fixed offset. */
export function civilDate(now = new Date(), timeZone = TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not format a civil date");
  return `${year}-${month}-${day}`;
}

export function zoneAbbreviation(now = new Date(), timeZone = TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(now);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Monday of the week containing iso. Weeks run Monday to Sunday. */
export function weekStart(iso: string): string {
  return addDays(iso, -((weekdayIndex(iso) + 6) % 7));
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function monthParts(monthKey: string): { year: number; month: number; name: string } {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  return { year, month, name: MONTH_NAMES[month - 1] ?? "" };
}

export function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  if (month < 1 || month > 12 || day < 1) return false;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= count;
}

export type MonthCell = { iso: string; inMonth: boolean };

export function monthWeeks(monthKey: string): MonthCell[][] {
  const { year, month } = monthParts(monthKey);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${monthKey}-${pad(count)}`;
  const weeks: MonthCell[][] = [];
  for (let start = weekStart(`${monthKey}-01`); start <= last; start = addDays(start, 7)) {
    weeks.push(
      [0, 1, 2, 3, 4, 5, 6].map((offset) => {
        const iso = addDays(start, offset);
        return { iso, inMonth: iso.slice(0, 7) === monthKey };
      }),
    );
  }
  return weeks;
}

export function formatDuration(ms: number): string {
  if (ms > 0 && ms < 30_000) return "under 1 m";
  const minutesTotal = Math.max(0, Math.round(ms / MS_MINUTE));
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (hours === 0) return `${minutes} m`;
  return `${hours} h ${pad(minutes)} m`;
}

export function formatCompact(ms: number): string {
  if (ms > 0 && ms < 30_000) return "<1m";
  const minutesTotal = Math.max(0, Math.round(ms / MS_MINUTE));
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${pad(minutes)}`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function deviceIdFor(label: string, existing: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "device";
  const taken = new Set(existing);
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}
