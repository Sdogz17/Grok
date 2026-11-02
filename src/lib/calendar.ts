import { GOAL, type StudyDay } from "../data/days";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
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

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Move by whole months. Positive delta is forward. No clamp: any month is allowed. */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map((part) => Number(part));
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  const month = index - year * 12;
  return `${year}-${pad(month + 1)}`;
}

export function monthParts(key: string): { year: number; month: number; name: string } {
  const [year, month] = key.split("-").map((part) => Number(part));
  return { year, month, name: MONTH_NAMES[month - 1] };
}

export function monthCells(key: string): (number | null)[] {
  const { year, month } = monthParts(key);
  const leading = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= count; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function isoDate(monthKey: string, day: number): string {
  return `${monthKey}-${pad(day)}`;
}

export function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function indexDays(days: readonly StudyDay[]): Map<string, StudyDay> {
  const map = new Map<string, StudyDay>();
  for (const day of days) map.set(day.date, day);
  return map;
}

export type StudyStats = {
  total: number;
  days: number;
  greens: number;
  streak: number;
  latestMonth: string;
};

export function studyStats(days: readonly StudyDay[], now = new Date()): StudyStats {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const total = sorted.reduce((sum, day) => sum + day.count, 0);
  const greens = sorted.filter((day) => day.count >= GOAL).length;
  let streak = 0;
  if (sorted.length > 0) {
    const cursor = new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`);
    const logged = new Set(sorted.map((day) => day.date));
    while (logged.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }
  const latestMonth = sorted.length > 0 ? sorted[sorted.length - 1].date.slice(0, 7) : todayIso(now).slice(0, 7);
  return { total, days: sorted.length, greens, streak, latestMonth };
}

export function monthSummary(days: readonly StudyDay[], monthKey: string): { words: number; days: number } {
  let words = 0;
  let count = 0;
  for (const day of days) {
    if (day.date.slice(0, 7) !== monthKey) continue;
    words += day.count;
    count += 1;
  }
  return { words, days: count };
}

export function monthSummaryText(words: number, days: number): string {
  if (days === 0) return "Nothing logged this month";
  const wordLabel = words === 1 ? "word" : "words";
  const dayLabel = days === 1 ? "day" : "days";
  return `${words} ${wordLabel} over ${days} ${dayLabel} this month`;
}

export function dayLabel(iso: string, today: string, count: number | null): string {
  const { year, name } = monthParts(iso.slice(0, 7));
  const day = Number(iso.slice(8));
  const weekday = WEEKDAYS_LONG[weekdayIndex(iso)];
  const when = `${weekday} ${day} ${name} ${year}`;
  const study = count === null ? "no study" : `${count} ${count === 1 ? "word" : "words"}`;
  return `${when}${iso === today ? ", today" : ""}, ${study}`;
}
