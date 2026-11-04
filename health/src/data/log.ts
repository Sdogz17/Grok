/**
 * Health log. This is the only file to edit when a new day comes in.
 *
 * Dates and clock times are Melbourne local (AEST until 4 Oct 2026, AEDT after).
 * A sleep row is keyed by the Melbourne date that sleep started. Newest rows go first.
 *
 * TODAY_ISO is the day the calendar treats as today, and the last day you can open.
 * Move it forward when you add a newer day.
 *
 * SLEEP_LOG    Whoop sleep performance, recovery, and the cycle strain that follows.
 *              A null performance means a cycle with no scored sleep.
 * WORKOUTS     One row per session. sport "weightlifting" is a lift, "walking" is a walk.
 *              notes is what you lifted. iso is the calendar key.
 * DIET_LOG     One fully logged day. iso is the calendar key. Figures are estimates.
 * DAYS         Daily Whoop cycles from the 26 Oct pull. The calendar does not read this.
 * ROUTINE_LOG  Red light and exercise notes. Not shown.
 * LAST_NIGHT   The night of 25 Oct, from the 26 Oct pull.
 * BODY         Whoop profile values. No history.
 *
 * Sleep bands: 85 or more is good, 70 to 84 is ok, under 70 is poor.
 * Recovery uses Whoop's bands: 67 or more, 34 to 66, under 34.
 * Weeks run Monday to Sunday. The lift goal is 4 sessions.
 * Food targets are 1,800 kcal and 100 to 130 g protein.
 */

export type Day = {
  date: string; recovery: number | null; hrv: number | null; rhr: number | null;
  sleepH: number | null; needH: number | null; napH: number | null; perf: number | null; eff: number | null;
  strain: number | null; kcal: number | null; steps: number | null; complete: boolean;
};
/* notes: optional free text for what was done (exercises, sets). Add it to any WORKOUTS entry. */
export type Workout = { iso: string; date: string; time: string; sport: string; mins: number; strain: number; avg: number; max: number; kcal: number; notes?: string };
export type DietDay = { iso: string; date: string; kcal: number; protein: number; carbs: number; fat: number; burned: number | null; items: string[] };
export type RoutineDay = { date: string; redLight: string; exercise: string; notes: string };
/* One row per Melbourne calendar day, keyed by the date of the wake-up from the main sleep (naps excluded).
   perf = WHOOP sleep performance %, hours = time asleep, bed/wake = Melbourne clock times,
   recovery/hrv/rhr = that sleep's recovery, strain = the WHOOP cycle that follows the sleep.
   Rows with perf null are days with a WHOOP cycle but no scored sleep. */
export type SleepDay = { iso: string; perf: number | null; hours: number | null; bed: string | null; wake: string | null; recovery: number | null; hrv: number | null; rhr: number | null; strain: number | null };

export const PULLED = "26 Oct 2026, 4:17 AM Melbourne time";
export const TARGET_KCAL = 1800;
export const PROTEIN_MIN = 100;

export const BODY = { weightKg: 81.1, heightM: 1.8034, maxHr: 196 };

export const LAST_NIGHT = {
  window: "Sun 25 Oct, 04:30 to 14:02",
  inBedH: 9.53, asleepH: 8.79, needH: 7.95, perf: 85, eff: 93, consistency: 68,
  light: 4.73, sws: 2.12, rem: 1.95, awake: 0.73, respRate: 15.9, disturbances: 13,
};

export const SLEEP_PULLED = "2 Nov 2026, 9:20 PM Melbourne time";

/* Sleep log for the habit calendar (newest first). Extend from WHOOP get_sleep / get_recovery / get_cycles. */
export const SLEEP_LOG: SleepDay[] = [
  {iso: "2026-11-04", perf: 73, hours: 7.90, bed: "02:21", wake: "11:30", recovery: 94, hrv: 73.4, rhr: 62, strain: 13.6},
  {iso: "2026-11-03", perf: 75, hours: 9.57, bed: "05:09", wake: "16:14", recovery: 50, hrv: 43.3, rhr: 63, strain: 5.2},
  {iso: "2026-11-02", perf: 28, hours: 3.74, bed: "12:17", wake: "16:10", recovery: 13, hrv: 34.3, rhr: 65, strain: 12.2},
  {iso: "2026-11-01", perf: 70, hours: 5.65, bed: "05:14", wake: "10:56", recovery: 51, hrv: 48.0, rhr: 65, strain: 15.5},
  {iso: "2026-10-31", perf: 84, hours: 6.80, bed: "06:13", wake: "13:36", recovery: 46, hrv: 42.2, rhr: 63, strain: 13.8},
  {iso: "2026-10-30", perf: 88, hours: 8.20, bed: "05:41", wake: "14:18", recovery: 57, hrv: 49.2, rhr: 64, strain: 12.9},
  {iso: "2026-10-29", perf: 82, hours: 9.80, bed: "04:27", wake: "14:38", recovery: 36, hrv: 35.9, rhr: 65, strain: 11.2},
  {iso: "2026-10-28", perf: 83, hours: 10.81, bed: "05:38", wake: "17:15", recovery: 41, hrv: 38.2, rhr: 63, strain: 6.9},
  {iso: "2026-10-27", perf: 81, hours: 8.31, bed: "06:18", wake: "15:06", recovery: 93, hrv: 78.5, rhr: 64, strain: 7.1},
  {iso: "2026-10-26", perf: 72, hours: 5.91, bed: "09:57", wake: "16:10", recovery: 33, hrv: 38.2, rhr: 65, strain: 14.2},
  {iso: "2026-10-25", perf: 85, hours: 8.79, bed: "04:30", wake: "14:02", recovery: 44, hrv: 42.6, rhr: 68, strain: 4.1},
  {iso: "2026-10-24", perf: 82, hours: 10.81, bed: "04:33", wake: "15:44", recovery: 74, hrv: 66.0, rhr: 66, strain: 6.6},
  {iso: "2026-10-23", perf: 78, hours: 10.54, bed: "03:31", wake: "14:32", recovery: 57, hrv: 50.0, rhr: 61, strain: 13.9},
  {iso: "2026-10-22", perf: 65, hours: 6.24, bed: "04:37", wake: "11:10", recovery: 49, hrv: 53.0, rhr: 66, strain: 4.9},
  {iso: "2026-10-21", perf: 53, hours: 4.53, bed: "10:44", wake: "15:23", recovery: 21, hrv: 34.7, rhr: 66, strain: 11.2},
  {iso: "2026-10-20", perf: 82, hours: 7.31, bed: "05:56", wake: "13:50", recovery: 29, hrv: 39.4, rhr: 64, strain: 14.8},
  {iso: "2026-10-19", perf: 79, hours: 8.33, bed: "05:05", wake: "13:52", recovery: 65, hrv: 72.4, rhr: 65, strain: 9.1},
  {iso: "2026-10-18", perf: 81, hours: 8.92, bed: "06:39", wake: "15:49", recovery: 27, hrv: 40.6, rhr: 66, strain: 14.3},
  {iso: "2026-10-17", perf: 76, hours: 8.34, bed: "06:16", wake: "15:21", recovery: 20, hrv: 27.5, rhr: 71, strain: 6.4},
  {iso: "2026-10-16", perf: 82, hours: 6.89, bed: "05:06", wake: "12:19", recovery: 34, hrv: 52.9, rhr: 66, strain: 6.5},
  {iso: "2026-10-15", perf: 87, hours: 8.55, bed: "04:56", wake: "13:56", recovery: 46, hrv: 64.7, rhr: 65, strain: 12.9},
  {iso: "2026-10-14", perf: 82, hours: 9.20, bed: "04:04", wake: "13:49", recovery: 62, hrv: 82.6, rhr: 64, strain: 7.4},
  {iso: "2026-10-13", perf: 100, hours: 7.46, bed: "05:53", wake: "13:50", recovery: 43, hrv: 62.1, rhr: 63, strain: 13.5},
  {iso: "2026-10-12", perf: 65, hours: 5.34, bed: "06:01", wake: "11:56", recovery: 37, hrv: 69.4, rhr: 68, strain: 7.4},
  {iso: "2026-10-11", perf: null, hours: null, bed: null, wake: null, recovery: null, hrv: null, rhr: null, strain: 5.0},
  {iso: "2026-10-06", perf: null, hours: null, bed: null, wake: null, recovery: null, hrv: null, rhr: null, strain: 13.0},
  {iso: "2026-10-05", perf: 28, hours: 2.81, bed: "04:13", wake: "07:14", recovery: 24, hrv: 127.3, rhr: 70, strain: 10.2},
  {iso: "2026-10-04", perf: 76, hours: 7.42, bed: "07:13", wake: "15:15", recovery: 37, hrv: 55.3, rhr: 66, strain: 8.7},
  {iso: "2026-10-03", perf: 76, hours: 6.90, bed: "04:25", wake: "11:37", recovery: 23, hrv: 49.0, rhr: 68, strain: 9.6},
  {iso: "2026-10-02", perf: 42, hours: 4.11, bed: "08:25", wake: "13:56", recovery: 11, hrv: 33.5, rhr: 68, strain: 9.6},
  {iso: "2026-10-01", perf: 80, hours: 7.00, bed: "03:53", wake: "11:06", recovery: 31, hrv: 55.0, rhr: 65, strain: 12.5},
  {iso: "2026-09-30", perf: 78, hours: 6.93, bed: "03:29", wake: "10:45", recovery: 31, hrv: 55.9, rhr: 65, strain: 7.5},
  {iso: "2026-09-29", perf: 76, hours: 7.70, bed: "02:39", wake: "10:43", recovery: 36, hrv: 72.6, rhr: 67, strain: 8.4},
  {iso: "2026-09-28", perf: null, hours: null, bed: null, wake: null, recovery: null, hrv: null, rhr: null, strain: 12.3},
  {iso: "2026-09-27", perf: 87, hours: 7.30, bed: "05:01", wake: "12:36", recovery: 65, hrv: 97.5, rhr: 62, strain: 7.2},
  {iso: "2026-09-26", perf: 88, hours: 8.11, bed: "04:45", wake: "13:18", recovery: 59, hrv: 79.3, rhr: 61, strain: 8.2},
  {iso: "2026-09-25", perf: 87, hours: 9.62, bed: "03:55", wake: "13:48", recovery: 50, hrv: 67.8, rhr: 65, strain: 6.5},
  {iso: "2026-09-24", perf: 84, hours: 8.78, bed: "02:31", wake: "11:36", recovery: 75, hrv: 107.8, rhr: 66, strain: 15.7},
  {iso: "2026-09-23", perf: null, hours: null, bed: null, wake: null, recovery: null, hrv: null, rhr: null, strain: 6.6},
  {iso: "2026-09-22", perf: 90, hours: 8.21, bed: "04:16", wake: "12:39", recovery: 62, hrv: 99.1, rhr: 64, strain: 14.8},
  {iso: "2026-09-21", perf: 73, hours: 7.54, bed: "03:30", wake: "13:45", recovery: 65, hrv: 103.0, rhr: 64, strain: 11.6},
  {iso: "2026-09-20", perf: 84, hours: 7.77, bed: "05:09", wake: "13:01", recovery: 43, hrv: 76.2, rhr: 62, strain: 11.4},
  {iso: "2026-09-19", perf: 85, hours: 9.15, bed: "03:32", wake: "13:08", recovery: 57, hrv: 97.7, rhr: 61, strain: 7.7},
  {iso: "2026-09-18", perf: 84, hours: 9.58, bed: "01:46", wake: "11:47", recovery: 68, hrv: 108.4, rhr: 60, strain: 8.8},
  {iso: "2026-09-17", perf: 80, hours: 8.75, bed: "02:08", wake: "11:32", recovery: 95, hrv: 119.5, rhr: 64, strain: 9.3},
  {iso: "2026-09-16", perf: 79, hours: 8.36, bed: "04:28", wake: "13:09", recovery: 98, hrv: 124.0, rhr: 66, strain: 12.9},
  {iso: "2026-09-15", perf: 76, hours: 6.23, bed: "05:48", wake: "12:05", recovery: 96, hrv: 125.5, rhr: 63, strain: 6.9},
  {iso: "2026-09-14", perf: 77, hours: 13.38, bed: "21:01 (13 Sep)", wake: "11:00", recovery: 80, hrv: 107.4, rhr: 70, strain: 9.3},
  {iso: "2026-09-13", perf: null, hours: null, bed: null, wake: null, recovery: null, hrv: null, rhr: null, strain: 14.3},
  {iso: "2026-09-12", perf: 82, hours: 8.14, bed: "02:29", wake: "10:52", recovery: 94, hrv: 125.9, rhr: 65, strain: 13.6},
  {iso: "2026-09-11", perf: 81, hours: 7.31, bed: "04:46", wake: "12:23", recovery: 75, hrv: 92.2, rhr: 68, strain: 9.4},
  {iso: "2026-09-10", perf: 83, hours: 8.71, bed: "03:18", wake: "12:20", recovery: 84, hrv: 97.1, rhr: 65, strain: 15.7},
  {iso: "2026-09-09", perf: 80, hours: 8.02, bed: "04:03", wake: "12:13", recovery: 57, hrv: 72.9, rhr: 63, strain: 10.7},
  {iso: "2026-09-08", perf: 80, hours: 9.46, bed: "01:00", wake: "10:49", recovery: 83, hrv: 98.6, rhr: 63, strain: 14.6},
  {iso: "2026-09-07", perf: 73, hours: 5.74, bed: "03:36", wake: "09:24", recovery: 50, hrv: 78.8, rhr: 66, strain: 10.0},
  {iso: "2026-09-06", perf: 70, hours: 5.02, bed: "04:03", wake: "09:15", recovery: 22, hrv: 45.5, rhr: 73, strain: 9.1},
  {iso: "2026-09-05", perf: 84, hours: 8.13, bed: "03:33", wake: "11:54", recovery: 78, hrv: 92.7, rhr: 65, strain: 14.6},
  {iso: "2026-09-04", perf: 88, hours: 9.60, bed: "01:17", wake: "11:14", recovery: 67, hrv: 80.9, rhr: 62, strain: 8.0},
  {iso: "2026-09-03", perf: 82, hours: 8.01, bed: "01:40", wake: "09:53", recovery: 71, hrv: 83.0, rhr: 64, strain: 8.8},
  {iso: "2026-09-02", perf: 77, hours: 6.64, bed: "02:11", wake: "08:58", recovery: 67, hrv: 80.6, rhr: 62, strain: 8.6},
  {iso: "2026-09-01", perf: 76, hours: 6.86, bed: "03:45", wake: "10:55", recovery: 93, hrv: 105.9, rhr: 61, strain: 13.4},
  {iso: "2026-08-31", perf: 80, hours: 8.79, bed: "01:32", wake: "10:37", recovery: 99, hrv: 109.5, rhr: 64, strain: 14.0},
];

export const DAYS: Day[] = [
  {date: "2026-09-26", recovery: 59, hrv: 79.3, rhr: 61, sleepH: 8.11, needH: 7.96, napH: null, perf: 88, eff: 95, strain: 8.2, kcal: 2241, steps: 11229, complete: true},
  {date: "2026-09-27", recovery: 65, hrv: 97.5, rhr: 62, sleepH: 7.3, needH: 8.0, napH: 2.08, perf: 87, eff: 96, strain: 7.2, kcal: 2040, steps: 2965, complete: true},
  {date: "2026-09-28", recovery: null, hrv: null, rhr: null, sleepH: null, needH: null, napH: null, perf: null, eff: null, strain: 12.3, kcal: 2122, steps: 8385, complete: true},
  {date: "2026-09-29", recovery: 36, hrv: 72.6, rhr: 67, sleepH: 7.7, needH: 8.67, napH: null, perf: 76, eff: 95, strain: 8.4, kcal: 2175, steps: 6510, complete: true},
  {date: "2026-09-30", recovery: 31, hrv: 55.9, rhr: 65, sleepH: 6.93, needH: 8.5, napH: null, perf: 78, eff: 96, strain: 7.5, kcal: 2126, steps: 10519, complete: true},
  {date: "2026-10-01", recovery: 31, hrv: 55.0, rhr: 65, sleepH: 7.0, needH: 8.77, napH: 2.35, perf: 80, eff: 97, strain: 12.5, kcal: 2849, steps: 10998, complete: true},
  {date: "2026-10-02", recovery: 11, hrv: 33.5, rhr: 68, sleepH: 4.11, needH: 6.78, napH: null, perf: 42, eff: 75, strain: 9.6, kcal: 1876, steps: 15725, complete: true},
  {date: "2026-10-03", recovery: 23, hrv: 49.0, rhr: 68, sleepH: 6.9, needH: 9.39, napH: null, perf: 76, eff: 96, strain: 9.6, kcal: 2438, steps: 11849, complete: true},
  {date: "2026-10-04", recovery: 37, hrv: 55.3, rhr: 66, sleepH: 7.42, needH: 9.65, napH: null, perf: 76, eff: 92, strain: 8.7, kcal: 1996, steps: 7624, complete: true},
  {date: "2026-10-05", recovery: 24, hrv: 127.3, rhr: 70, sleepH: 2.81, needH: 9.45, napH: 1.25, perf: 28, eff: 93, strain: 10.2, kcal: 2273, steps: 11645, complete: true},
  {date: "2026-10-06", recovery: null, hrv: null, rhr: null, sleepH: null, needH: null, napH: null, perf: null, eff: null, strain: 13.0, kcal: 2280, steps: 14122, complete: true},
  {date: "2026-10-07", recovery: null, hrv: null, rhr: null, sleepH: null, needH: null, napH: null, perf: null, eff: null, strain: null, kcal: null, steps: null, complete: false},
  {date: "2026-10-08", recovery: null, hrv: null, rhr: null, sleepH: null, needH: null, napH: null, perf: null, eff: null, strain: null, kcal: null, steps: null, complete: false},
  {date: "2026-10-09", recovery: null, hrv: null, rhr: null, sleepH: null, needH: null, napH: null, perf: null, eff: null, strain: null, kcal: null, steps: null, complete: false},
  {date: "2026-10-10", recovery: null, hrv: null, rhr: null, sleepH: null, needH: null, napH: null, perf: null, eff: null, strain: null, kcal: null, steps: null, complete: false},
  {date: "2026-10-11", recovery: null, hrv: null, rhr: null, sleepH: null, needH: null, napH: null, perf: null, eff: null, strain: 5.0, kcal: 1191, steps: 8377, complete: false},
  {date: "2026-10-12", recovery: 37, hrv: 69.4, rhr: 68, sleepH: 5.34, needH: 10.06, napH: 2.96, perf: 65, eff: 90, strain: 7.4, kcal: 2095, steps: 10147, complete: true},
  {date: "2026-10-13", recovery: 43, hrv: 62.1, rhr: 63, sleepH: 7.46, needH: 7.14, napH: null, perf: 100, eff: 94, strain: 13.5, kcal: 2148, steps: 10205, complete: true},
  {date: "2026-10-14", recovery: 62, hrv: 82.6, rhr: 64, sleepH: 9.2, needH: 8.33, napH: null, perf: 82, eff: 94, strain: 7.4, kcal: 2048, steps: 8615, complete: true},
  {date: "2026-10-15", recovery: 46, hrv: 64.7, rhr: 65, sleepH: 8.55, needH: 7.98, napH: null, perf: 87, eff: 95, strain: 12.9, kcal: 2670, steps: 14065, complete: true},
  {date: "2026-10-16", recovery: 34, hrv: 52.9, rhr: 66, sleepH: 6.89, needH: 8.27, napH: 3.17, perf: 82, eff: 96, strain: 6.5, kcal: 2119, steps: 788, complete: true},
  {date: "2026-10-17", recovery: 20, hrv: 27.5, rhr: 71, sleepH: 8.34, needH: 5.68, napH: null, perf: 76, eff: 92, strain: 6.4, kcal: 2052, steps: 5324, complete: true},
  {date: "2026-10-18", recovery: 27, hrv: 40.6, rhr: 66, sleepH: 8.92, needH: 7.95, napH: 1.71, perf: 81, eff: 97, strain: 14.3, kcal: 2479, steps: 16486, complete: true},
  {date: "2026-10-19", recovery: 65, hrv: 72.4, rhr: 65, sleepH: 8.33, needH: 6.71, napH: null, perf: 79, eff: 95, strain: 9.1, kcal: 2273, steps: 12123, complete: true},
  {date: "2026-10-20", recovery: 29, hrv: 39.4, rhr: 64, sleepH: 7.31, needH: 8.03, napH: null, perf: 82, eff: 93, strain: 14.8, kcal: 3010, steps: 11225, complete: true},
  {date: "2026-10-21", recovery: 21, hrv: 34.7, rhr: 66, sleepH: 4.53, needH: 8.93, napH: null, perf: 53, eff: 97, strain: 11.2, kcal: 1968, steps: 19434, complete: true},
  {date: "2026-10-22", recovery: 49, hrv: 53.0, rhr: 66, sleepH: 6.24, needH: 10.28, napH: 1.13, perf: 65, eff: 96, strain: 4.9, kcal: 1873, steps: 10795, complete: true},
  {date: "2026-10-23", recovery: 57, hrv: 50.0, rhr: 61, sleepH: 10.54, needH: 8.82, napH: null, perf: 78, eff: 96, strain: 13.9, kcal: 2588, steps: 12337, complete: true},
  {date: "2026-10-24", recovery: 74, hrv: 66.0, rhr: 66, sleepH: 10.81, needH: 8.37, napH: null, perf: 82, eff: 97, strain: 6.6, kcal: 2009, steps: 8291, complete: true},
  {date: "2026-10-25", recovery: 44, hrv: 42.6, rhr: 68, sleepH: 8.79, needH: 7.95, napH: null, perf: 85, eff: 93, strain: 4.1, kcal: 1905, steps: 5586, complete: false},
];

export const WORKOUTS: Workout[] = [
  {iso: "2026-11-04", date: "Wed 4 Nov", time: "21:11", sport: "weightlifting", mins: 47, strain: 11.8, avg: 127, max: 160, kcal: 301, notes: "Chest-supported rows 3 sets, cable bicep curls 3 sets, lat pulldowns 3 sets, cable rows 2 sets"},
  {iso: "2026-11-04", date: "Wed 4 Nov", time: "20:10", sport: "walking", mins: 49, strain: 7.5, avg: 127, max: 161, kcal: 314},
  {iso: "2026-11-02", date: "Mon 2 Nov", time: "20:18", sport: "weightlifting", mins: 36, strain: 9.6, avg: 119, max: 149, kcal: 174, notes: "Chest press 3 sets, tricep pushdowns 3 sets, pull-ups 3 sets"},
  {iso: "2026-11-02", date: "Mon 2 Nov", time: "19:56", sport: "activity", mins: 22, strain: 4.3, avg: 104, max: 130, kcal: 37},
  {iso: "2026-11-02", date: "Mon 2 Nov", time: "04:04", sport: "walking", mins: 15, strain: 4.5, avg: 114, max: 124, kcal: 54},
  {iso: "2026-11-01", date: "Sun 1 Nov", time: "20:51", sport: "walking", mins: 52, strain: 7.7, avg: 127, max: 147, kcal: 337},
  {iso: "2026-10-31", date: "Sat 31 Oct", time: "20:42", sport: "walking", mins: 22, strain: 5.1, avg: 119, max: 134, kcal: 104},
  {iso: "2026-10-31", date: "Sat 31 Oct", time: "19:11", sport: "weightlifting", mins: 63, strain: 12.1, avg: 113, max: 149, kcal: 223, notes: "Lat pulldown, lateral raises, trap bar shrugs, tricep pushdowns, shoulder press, 3 sets each"},
  {iso: "2026-10-31", date: "Sat 31 Oct", time: "00:41", sport: "weightlifting", mins: 51, strain: 11.1, avg: 110, max: 137, kcal: 157, notes: "Incline press 3 sets, cable curls 3 sets, tricep pushdowns 3 sets, assisted pull-ups 2 sets"},
  {iso: "2026-10-30", date: "Fri 30 Oct", time: "15:48", sport: "walking", mins: 16, strain: 4.0, avg: 102, max: 112, kcal: 22},
  {iso: "2026-10-29", date: "Thu 29 Oct", time: "23:35", sport: "walking", mins: 39, strain: 6.3, avg: 124, max: 137, kcal: 217},
  {iso: "2026-10-29", date: "Thu 29 Oct", time: "16:13", sport: "walking", mins: 16, strain: 4.4, avg: 111, max: 128, kcal: 46},
  {iso: "2026-10-28", date: "Wed 28 Oct", time: "21:17", sport: "walking", mins: 45, strain: 6.4, avg: 122, max: 138, kcal: 232},
  {iso: "2026-10-27", date: "Tue 27 Oct", time: "22:38", sport: "walking", mins: 45, strain: 6.1, avg: 119, max: 141, kcal: 201},
  {iso: "2026-10-27", date: "Tue 27 Oct", time: "00:20", sport: "walking", mins: 35, strain: 6.2, avg: 124, max: 155, kcal: 197},
  {iso: "2026-10-26", date: "Mon 26 Oct", time: "23:09", sport: "walking", mins: 34, strain: 7.2, avg: 133, max: 151, kcal: 259},
  {iso: "2026-10-26", date: "Mon 26 Oct", time: "20:59", sport: "weightlifting", mins: 45, strain: 10.3, avg: 111, max: 137, kcal: 140},
  {iso: "2026-10-24", date: "Sat 24 Oct", time: "23:38", sport: "walking", mins: 20, strain: 4.4, avg: 107, max: 117, kcal: 41},
  {iso: "2026-10-24", date: "Sat 24 Oct", time: "00:34", sport: "weightlifting", mins: 49, strain: 10.7, avg: 108, max: 142, kcal: 139},
  {iso: "2026-10-23", date: "Fri 23 Oct", time: "22:43", sport: "walking", mins: 60, strain: 8.0, avg: 127, max: 145, kcal: 372},
  {iso: "2026-10-22", date: "Thu 22 Oct", time: "22:09", sport: "walking", mins: 16, strain: 4.2, avg: 104, max: 117, kcal: 27},
  {iso: "2026-10-22", date: "Thu 22 Oct", time: "02:13", sport: "walking", mins: 23, strain: 5.4, avg: 124, max: 141, kcal: 131},
  {iso: "2026-10-22", date: "Thu 22 Oct", time: "00:30", sport: "walking", mins: 15, strain: 5.1, avg: 128, max: 141, kcal: 98},
  {iso: "2026-10-21", date: "Wed 21 Oct", time: "23:30", sport: "walking", mins: 18, strain: 4.9, avg: 120, max: 133, kcal: 86},
  {iso: "2026-10-21", date: "Wed 21 Oct", time: "19:38", sport: "walking", mins: 33, strain: 4.8, avg: 109, max: 127, kcal: 80},
  {iso: "2026-10-20", date: "Tue 20 Oct", time: "20:43", sport: "walking", mins: 58, strain: 7.5, avg: 125, max: 141, kcal: 333},
  {iso: "2026-10-20", date: "Tue 20 Oct", time: "17:49", sport: "weightlifting", mins: 61, strain: 13.1, avg: 128, max: 164, kcal: 391},
  {iso: "2026-10-18", date: "Sun 18 Oct", time: "23:15", sport: "weightlifting", mins: 52, strain: 11.1, avg: 110, max: 141, kcal: 143},
  {iso: "2026-10-18", date: "Sun 18 Oct", time: "21:14", sport: "walking", mins: 86, strain: 8.5, avg: 122, max: 140, kcal: 450},
  {iso: "2026-10-15", date: "Thu 15 Oct", time: "21:38", sport: "walking", mins: 56, strain: 9.3, avg: 133, max: 156, kcal: 433},
  {iso: "2026-10-15", date: "Thu 15 Oct", time: "20:37", sport: "walking", mins: 39, strain: 7.8, avg: 133, max: 150, kcal: 304},
  {iso: "2026-10-15", date: "Thu 15 Oct", time: "18:28", sport: "walking", mins: 27, strain: 5.1, avg: 115, max: 134, kcal: 102},
  {iso: "2026-10-15", date: "Thu 15 Oct", time: "00:06", sport: "walking", mins: 18, strain: 5.1, avg: 122, max: 145, kcal: 95},
  {iso: "2026-10-13", date: "Tue 13 Oct", time: "22:28", sport: "weightlifting", mins: 61, strain: 11.9, avg: 109, max: 139, kcal: 190},
  {iso: "2026-10-12", date: "Mon 12 Oct", time: "22:46", sport: "walking", mins: 25, strain: 4.8, avg: 112, max: 124, kcal: 79},
  {iso: "2026-10-07", date: "Wed 7 Oct", time: "04:55", sport: "walking", mins: 19, strain: 4.3, avg: 105, max: 118, kcal: 36},
  {iso: "2026-10-06", date: "Tue 6 Oct", time: "23:08", sport: "walking", mins: 20, strain: 5.1, avg: 122, max: 136, kcal: 107},
  {iso: "2026-10-06", date: "Tue 6 Oct", time: "14:17", sport: "weightlifting", mins: 20, strain: 5.6, avg: 109, max: 127, kcal: 51},
  {iso: "2026-10-06", date: "Tue 6 Oct", time: "03:17", sport: "weightlifting", mins: 14, strain: 4.4, avg: 109, max: 129, kcal: 38},
  {iso: "2026-10-05", date: "Mon 5 Oct", time: "20:00", sport: "walking", mins: 42, strain: 6.9, avg: 126, max: 145, kcal: 256},
  {iso: "2026-10-04", date: "Sun 4 Oct", time: "20:04", sport: "walking", mins: 14, strain: 5.5, avg: 134, max: 152, kcal: 112},
  {iso: "2026-10-03", date: "Sat 3 Oct", time: "15:22", sport: "walking", mins: 41, strain: 6.8, avg: 125, max: 141, kcal: 248},
  {iso: "2026-10-03", date: "Sat 3 Oct", time: "00:03", sport: "walking", mins: 16, strain: 4.3, avg: 106, max: 114, kcal: 32},
  {iso: "2026-10-02", date: "Fri 2 Oct", time: "19:35", sport: "walking", mins: 16, strain: 4.3, avg: 107, max: 131, kcal: 39},
  {iso: "2026-10-01", date: "Thu 1 Oct", time: "22:26", sport: "activity", mins: 13, strain: 4.5, avg: 115, max: 129, kcal: 52},
  {iso: "2026-10-01", date: "Thu 1 Oct", time: "21:24", sport: "walking", mins: 40, strain: 6.5, avg: 122, max: 158, kcal: 217},
  {iso: "2026-10-01", date: "Thu 1 Oct", time: "14:43", sport: "walking", mins: 15, strain: 4.5, avg: 112, max: 122, kcal: 49},
  {iso: "2026-09-30", date: "Wed 30 Sep", time: "23:05", sport: "walking", mins: 27, strain: 4.8, avg: 110, max: 130, kcal: 74},
  {iso: "2026-09-28", date: "Mon 28 Sep", time: "23:18", sport: "walking", mins: 13, strain: 5.2, avg: 133, max: 144, kcal: 100},
  {iso: "2026-09-28", date: "Mon 28 Sep", time: "22:22", sport: "weightlifting", mins: 36, strain: 9.2, avg: 111, max: 145, kcal: 125},
  {iso: "2026-09-26", date: "Sat 26 Sep", time: "22:19", sport: "walking", mins: 62, strain: 7.3, avg: 120, max: 146, kcal: 308},
  {iso: "2026-09-25", date: "Fri 25 Sep", time: "23:36", sport: "walking", mins: 42, strain: 5.7, avg: 115, max: 129, kcal: 160},
  {iso: "2026-09-24", date: "Thu 24 Sep", time: "20:48", sport: "walking", mins: 56, strain: 7.4, avg: 123, max: 138, kcal: 320},
  {iso: "2026-09-24", date: "Thu 24 Sep", time: "16:27", sport: "weightlifting", mins: 80, strain: 13.5, avg: 124, max: 166, kcal: 474},
  {iso: "2026-09-23", date: "Wed 23 Sep", time: "19:51", sport: "walking", mins: 31, strain: 5.7, avg: 120, max: 139, kcal: 154},
  {iso: "2026-09-22", date: "Tue 22 Sep", time: "20:33", sport: "walking", mins: 46, strain: 6.6, avg: 121, max: 144, kcal: 243},
  {iso: "2026-09-22", date: "Tue 22 Sep", time: "17:40", sport: "weightlifting", mins: 61, strain: 12.7, avg: 121, max: 158, kcal: 316},
  {iso: "2026-09-21", date: "Mon 21 Sep", time: "22:08", sport: "walking", mins: 101, strain: 8.9, avg: 120, max: 141, kcal: 499},
  {iso: "2026-09-21", date: "Mon 21 Sep", time: "19:08", sport: "walking", mins: 29, strain: 5.7, avg: 123, max: 141, kcal: 163},
  {iso: "2026-09-20", date: "Sun 20 Sep", time: "22:31", sport: "weightlifting", mins: 22, strain: 6.6, avg: 120, max: 140, kcal: 105},
  {iso: "2026-09-20", date: "Sun 20 Sep", time: "21:09", sport: "walking", mins: 69, strain: 8.9, avg: 129, max: 141, kcal: 467},
  {iso: "2026-09-19", date: "Sat 19 Sep", time: "22:07", sport: "walking", mins: 54, strain: 7.2, avg: 124, max: 139, kcal: 305},
  {iso: "2026-09-18", date: "Fri 18 Sep", time: "22:34", sport: "walking", mins: 17, strain: 4.1, avg: 103, max: 117, kcal: 26},
  {iso: "2026-09-18", date: "Fri 18 Sep", time: "21:59", sport: "walking", mins: 19, strain: 4.8, avg: 116, max: 142, kcal: 79},
  {iso: "2026-09-18", date: "Fri 18 Sep", time: "21:34", sport: "walking", mins: 13, strain: 4.4, avg: 112, max: 128, kcal: 40},
  {iso: "2026-09-17", date: "Thu 17 Sep", time: "18:40", sport: "walking", mins: 56, strain: 6.7, avg: 119, max: 137, kcal: 261},
  {iso: "2026-09-16", date: "Wed 16 Sep", time: "22:55", sport: "walking", mins: 19, strain: 4.8, avg: 116, max: 128, kcal: 77},
  {iso: "2026-09-16", date: "Wed 16 Sep", time: "19:12", sport: "walking", mins: 56, strain: 8.4, avg: 129, max: 155, kcal: 386},
  {iso: "2026-09-16", date: "Wed 16 Sep", time: "18:40", sport: "weightlifting", mins: 31, strain: 8.4, avg: 115, max: 149, kcal: 116},
  {iso: "2026-09-15", date: "Tue 15 Sep", time: "21:10", sport: "walking", mins: 16, strain: 4.8, avg: 119, max: 130, kcal: 75},
  {iso: "2026-09-14", date: "Mon 14 Sep", time: "23:09", sport: "walking", mins: 15, strain: 4.5, avg: 114, max: 127, kcal: 53},
  {iso: "2026-09-14", date: "Mon 14 Sep", time: "18:39", sport: "weightlifting", mins: 17, strain: 5.3, avg: 123, max: 146, kcal: 96},
  {iso: "2026-09-13", date: "Sun 13 Sep", time: "18:20", sport: "weightlifting", mins: 43, strain: 12.3, avg: 136, max: 161, kcal: 360},
  {iso: "2026-09-13", date: "Sun 13 Sep", time: "17:13", sport: "walking", mins: 36, strain: 6.4, avg: 126, max: 140, kcal: 223},
  {iso: "2026-09-12", date: "Sat 12 Sep", time: "23:23", sport: "walking", mins: 51, strain: 8.5, avg: 132, max: 152, kcal: 384},
  {iso: "2026-09-12", date: "Sat 12 Sep", time: "19:26", sport: "walking", mins: 23, strain: 5.4, avg: 123, max: 143, kcal: 127},
  {iso: "2026-09-11", date: "Fri 11 Sep", time: "22:51", sport: "walking", mins: 21, strain: 4.1, avg: 101, max: 115, kcal: 31},
  {iso: "2026-09-11", date: "Fri 11 Sep", time: "18:32", sport: "walking", mins: 51, strain: 7.0, avg: 122, max: 144, kcal: 284},
  {iso: "2026-09-10", date: "Thu 10 Sep", time: "23:16", sport: "walking", mins: 49, strain: 6.8, avg: 123, max: 142, kcal: 269},
  {iso: "2026-09-10", date: "Thu 10 Sep", time: "18:38", sport: "weightlifting", mins: 47, strain: 12.3, avg: 132, max: 163, kcal: 355},
  {iso: "2026-09-09", date: "Wed 9 Sep", time: "22:21", sport: "walking", mins: 16, strain: 4.7, avg: 119, max: 137, kcal: 74},
  {iso: "2026-09-09", date: "Wed 9 Sep", time: "17:06", sport: "walking", mins: 35, strain: 6.3, avg: 126, max: 141, kcal: 211},
  {iso: "2026-09-08", date: "Tue 8 Sep", time: "18:45", sport: "weightlifting", mins: 48, strain: 11.8, avg: 124, max: 161, kcal: 282},
  {iso: "2026-09-07", date: "Mon 7 Sep", time: "20:52", sport: "walking", mins: 22, strain: 4.9, avg: 117, max: 132, kcal: 90},
  {iso: "2026-09-07", date: "Mon 7 Sep", time: "19:31", sport: "walking", mins: 51, strain: 7.9, avg: 129, max: 150, kcal: 348},
  {iso: "2026-09-06", date: "Sun 6 Sep", time: "15:57", sport: "walking", mins: 52, strain: 6.4, avg: 118, max: 144, kcal: 228},
  {iso: "2026-09-05", date: "Sat 5 Sep", time: "13:55", sport: "weightlifting", mins: 85, strain: 14.0, avg: 130, max: 168, kcal: 582},
  {iso: "2026-09-04", date: "Fri 4 Sep", time: "19:18", sport: "walking", mins: 15, strain: 5.2, avg: 129, max: 148, kcal: 100},
  {iso: "2026-09-04", date: "Fri 4 Sep", time: "18:26", sport: "walking", mins: 27, strain: 5.3, avg: 120, max: 137, kcal: 122},
  {iso: "2026-09-03", date: "Thu 3 Sep", time: "16:45", sport: "walking", mins: 40, strain: 6.2, avg: 123, max: 139, kcal: 209},
  {iso: "2026-09-02", date: "Wed 2 Sep", time: "19:10", sport: "walking", mins: 40, strain: 6.0, avg: 121, max: 136, kcal: 193},
  {iso: "2026-09-01", date: "Tue 1 Sep", time: "19:36", sport: "weightlifting", mins: 38, strain: 10.0, avg: 119, max: 156, kcal: 168},
  {iso: "2026-08-31", date: "Mon 31 Aug", time: "18:21", sport: "walking", mins: 52, strain: 8.8, avg: 134, max: 156, kcal: 404},
  {iso: "2026-08-31", date: "Mon 31 Aug", time: "17:18", sport: "weightlifting", mins: 50, strain: 11.4, avg: 117, max: 162, kcal: 218},
  {iso: "2026-08-31", date: "Mon 31 Aug", time: "13:37", sport: "walking", mins: 29, strain: 4.3, avg: 104, max: 117, kcal: 45},
];

/* Diet log: add one entry per fully logged day (newest first). All values are estimates. */
export const DIET_LOG: DietDay[] = [
  {
    iso: "2026-10-30", date: "Fri 30 Oct", kcal: 752, protein: 44, carbs: 15, fat: 57, burned: null,
    items: [
      "Coles Middle Eastern lamb kebabs x6 (whole 450 g pack): 752 kcal, 44 g protein, ~15 g carbs, ~57 g fat, ~15 mg zinc",
      "Note: Label: 376 kcal and 22 g protein per 3 kebabs; carbs/fat estimated. High-zinc day.",
    ],
  },
  {
    iso: "2026-10-26", date: "Mon 26 Oct", kcal: 1597, protein: 111, carbs: 188, fat: 44, burned: null,
    items: [
      "Dinner (first meal) – Guzman y Gomez, about 6:30 pm",
      "GYG Grilled Chicken Bowl, extra chicken, no pico or tomatillo, kept rice and corn chips: 785 kcal, 70 g protein, 24 g fat, 71 g carbs",
      "Half a GYG Grilled Chicken Quesadilla with extra chicken: 300 kcal, 28 g protein, 13 g fat, 17 g carbs",
      "Yoway frozen yoghurt – ~400 kcal, ~12 g protein, ~4 g fat, ~80 g carbs (estimate)",
      "Cocobella chocolate coconut water 400 ml – 112 kcal, 1 g protein, 3 g fat, 20 g carbs (label)",
      "Note: today's personal target is 1,600 kcal including a 300 kcal dessert (source: GYG nutrition guide, 18 Aug 2026)",
      "Reaction: severe stomach pain after the froyo and coconut water combo (suspected sorbitol from coconut water, plus lactose and possibly sugar alcohols in the froyo)",
    ],
  },
  {
    iso: "2026-10-15", date: "Thu 15 Oct", kcal: 1990, protein: 132, carbs: 173, fat: 87, burned: 2670,
    items: [
      "Fishbowl Coconut Chicken Box, plus extra coconut chicken and an extra salmon fillet",
      "Prawn chips",
      "Dried mango",
      "Fun-size Snickers and Mars",
      "Half a Coles pulled chicken pack",
      "Chocolate, about 300 kcal",
    ],
  },
];

/* Routine log: one row per day. Red light starts once the mask arrives. */
export const ROUTINE_LOG: RoutineDay[] = [
  {date: "Mon 26 Oct", redLight: "To log", exercise: "To log", notes: ""},
  {date: "Sun 25 Oct", redLight: "Not started", exercise: "Walk 20 min", notes: "Recovery 44%"},
  {date: "Sat 24 Oct", redLight: "Not started", exercise: "Lift 49 min", notes: "Recovery 74%, only green day"},
  {date: "Fri 23 Oct", redLight: "Not started", exercise: "Walk 60 min", notes: "Recovery 57%"},
  {date: "Thu 22 Oct", redLight: "Not started", exercise: "3 walks, 54 min", notes: "Recovery 49%"},
  {date: "Wed 21 Oct", redLight: "Not started", exercise: "2 walks, 51 min", notes: "Recovery 21%, 4.5 h sleep"},
  {date: "Tue 20 Oct", redLight: "Not started", exercise: "Lift 61 min, walk 58 min", notes: "Strain 14.8, month high"},
  {date: "Mon 19 Oct", redLight: "Not started", exercise: "Rest", notes: "Recovery 65%"},
  {date: "Sun 18 Oct", redLight: "Not started", exercise: "Walk 86 min, lift 52 min", notes: "Recovery 27%"},
];

export const LIFT_GOAL = 4;
export const LIFT_GOAL_SET = "Mon 26 Oct 2026";
export const TODAY_ISO = "2026-11-04";
export const GOOD_SLEEP = 85;
export const OK_SLEEP = 70;
export const GOOD_RECOVERY = 67;
export const OK_RECOVERY = 34;
export const PROTEIN_MAX = 130;

