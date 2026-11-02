import {
  GOOD_RECOVERY,
  GOOD_SLEEP,
  OK_RECOVERY,
  OK_SLEEP,
  type SleepDay,
  type Workout,
} from "../data/log";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
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
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type Metric = "sleep" | "recovery";
export type Tier = "good" | "ok" | "poor";

export type MonthCell = { iso: string; inMonth: boolean };

export type LiftWeek = { start: string; count: number };

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
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

/** Days still in this Monday–Sunday week, including today. */
export function daysLeftInWeek(iso: string): number {
  return 7 - ((weekdayIndex(iso) + 6) % 7);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function monthParts(monthKey: string): { year: number; month: number; name: string } {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  return { year, month, name: MONTH_NAMES[month - 1] };
}

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

export function inRange(iso: string, first: string, last: string): boolean {
  return iso >= first && iso <= last;
}

export function firstLoggedIso(sleep: readonly SleepDay[], workouts: readonly Workout[]): string {
  const isos = [...sleep.map((day) => day.iso), ...workouts.map((workout) => workout.iso)];
  return isos.reduce((earliest, iso) => (iso < earliest ? iso : earliest));
}

export function formatHours(hours: number): string {
  let whole = Math.floor(hours);
  let minutes = Math.round((hours - whole) * 60);
  if (minutes === 60) {
    whole += 1;
    minutes = 0;
  }
  return `${whole} h ${minutes < 10 ? "0" : ""}${minutes} m`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-AU");
}

export function shortDate(iso: string): string {
  return `${Number(iso.slice(8))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
}

export function sportLabel(sport: string): string {
  if (sport.length === 0) return sport;
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

export function tierFor(metric: Metric, value: number | null): Tier | null {
  if (value === null) return null;
  if (metric === "sleep") {
    if (value >= GOOD_SLEEP) return "good";
    if (value >= OK_SLEEP) return "ok";
    return "poor";
  }
  if (value >= GOOD_RECOVERY) return "good";
  if (value >= OK_RECOVERY) return "ok";
  return "poor";
}

export function tierWord(tier: Tier): string {
  if (tier === "good") return "Good";
  if (tier === "ok") return "Ok";
  return "Poor";
}

export function metricValue(metric: Metric, day: SleepDay | undefined): number | null {
  if (!day) return null;
  return metric === "sleep" ? day.perf : day.recovery;
}

export function liftCountOn(workouts: readonly Workout[], iso: string): number {
  return workouts.filter((workout) => workout.iso === iso && workout.sport === "weightlifting").length;
}

export function walkedOn(workouts: readonly Workout[], iso: string): boolean {
  return workouts.some((workout) => workout.iso === iso && workout.sport === "walking");
}

export function liftsInWeek(workouts: readonly Workout[], weekStartIso: string): number {
  const end = addDays(weekStartIso, 6);
  return workouts.filter(
    (workout) => workout.sport === "weightlifting" && workout.iso >= weekStartIso && workout.iso <= end,
  ).length;
}

export function buildLiftWeeks(workouts: readonly Workout[], today: string): LiftWeek[] {
  const lifts = workouts.filter((workout) => workout.sport === "weightlifting");
  if (lifts.length === 0) return [];
  const first = lifts.reduce((earliest, workout) => (workout.iso < earliest ? workout.iso : earliest), lifts[0].iso);
  const weeks: LiftWeek[] = [];
  for (let start = weekStart(first); start <= weekStart(today); start = addDays(start, 7)) {
    weeks.push({ start, count: liftsInWeek(workouts, start) });
  }
  return weeks;
}

/** Consecutive weeks at or above `min`, from the latest week backward. The current week does not break a run it has not reached yet. */
export function weekRun(weeks: readonly LiftWeek[], min: number): number {
  let run = 0;
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    if (weeks[index].count >= min) run += 1;
    else if (index === weeks.length - 1) continue;
    else break;
  }
  return run;
}

export function sleepStreaks(
  sleep: readonly SleepDay[],
  today: string,
  first: string,
): { current: number; best: number } {
  const byIso = new Map(sleep.map((day) => [day.iso, day]));
  const good = (iso: string) => {
    const perf = byIso.get(iso)?.perf;
    return perf !== null && perf !== undefined && perf >= GOOD_SLEEP;
  };
  let cursor = today;
  const todayRow = byIso.get(cursor);
  if (!todayRow || todayRow.perf === null) cursor = addDays(cursor, -1);
  let current = 0;
  while (cursor >= first && good(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  for (let iso = first; iso <= today; iso = addDays(iso, 1)) {
    run = good(iso) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return { current, best };
}

export function monthLine(monthKey: string, metric: Metric, sleep: readonly SleepDay[]): string {
  const rows = sleep.filter((day) => day.iso.slice(0, 7) === monthKey);
  if (metric === "sleep") {
    const scored = rows.filter((day) => day.perf !== null);
    if (scored.length === 0) return "No scored nights this month";
    const good = scored.filter((day) => (day.perf as number) >= GOOD_SLEEP).length;
    const average = Math.round(scored.reduce((sum, day) => sum + (day.perf as number), 0) / scored.length);
    const nights = scored.length === 1 ? "night" : "nights";
    const reached = good === 0 ? `None of ${scored.length} ${nights} reached 85%` : `${good} of ${scored.length} ${nights} reached 85%`;
    return `${reached}. Average ${average}%`;
  }
  const scored = rows.filter((day) => day.recovery !== null);
  if (scored.length === 0) return "No scored recovery this month";
  const average = Math.round(scored.reduce((sum, day) => sum + (day.recovery as number), 0) / scored.length);
  const days = scored.length === 1 ? "day" : "days";
  return `Average recovery ${average}% over ${scored.length} ${days}`;
}
