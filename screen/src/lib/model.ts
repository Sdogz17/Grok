/**
 * Screen-time document, schema screentime.v1.
 *
 * Dates are Australia/Sydney civil dates. A missing field means the source
 * did not report it. Zero means the source reported zero.
 *
 * screenInteractiveMs is device screen-interactive time.
 * unlockedInteractiveMs is the part of that time with the keyguard hidden.
 * apps[].foregroundMs is per-app foreground time. On a fold those spans can
 * overlap, so their sum is not a screen total and is never copied into one.
 *
 * hours exists only when a source supplied timestamps. A daily total does not
 * create hour buckets.
 */

import {
  EARLIEST_DATE,
  MAX_DAY_MS,
  MAX_HOUR_MS,
  MS_HOUR,
  TIMEZONE,
  WEEKDAYS_LONG,
  addDays,
  formatDuration,
  isRealDate,
  monthParts,
  weekStart,
  weekdayIndex,
} from "./time";

export const SCHEMA = "screentime.v1" as const;

export type Platform = "android" | "ios" | "other";
export type SourceKind = "manual" | "file" | "android-usage-stats";
export type TotalBasis = "unlocked-interactive" | "screen-interactive" | "typed";
export type DeviceMethod = "events" | "event-stats" | "typed";
export type AppsMethod = "events" | "usage-stats" | "typed";

export interface Device {
  id: string;
  label: string;
  platform: Platform;
}

export interface Source {
  kind: SourceKind;
  name: string;
  recordedAt: string;
}

export interface DeviceTotal {
  basis: TotalBasis;
  method: DeviceMethod;
  partial: boolean;
  detail: string;
}

export interface AppUse {
  id: string;
  label: string;
  foregroundMs: number;
  visibleMs?: number;
}

export interface AppsNote {
  method: AppsMethod;
  partial: boolean;
  detail: string;
}

export interface HourBucket {
  hour: number;
  screenInteractiveMs?: number;
  unlockedInteractiveMs?: number;
  partial: boolean;
  apps?: AppUse[];
}

export interface DayRecord {
  date: string;
  deviceId: string;
  source: Source;
  screenInteractiveMs?: number;
  unlockedInteractiveMs?: number;
  deviceTotal?: DeviceTotal;
  apps?: AppUse[];
  appsNote?: AppsNote;
  hours?: HourBucket[];
}

export interface Status {
  usageAccess: "granted" | "denied" | "unknown";
  userUnlocked: boolean | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastResult: "never" | "ok" | "locked" | "denied" | "unavailable" | "empty" | "error";
  lastDetail: string;
  deviceZone: string;
  zoneMatches: boolean;
  eventsRetainedFrom: string | null;
  droppedUnalignedDays: number;
}

export interface ScreenTimeDocument {
  schema: typeof SCHEMA;
  timezone: typeof TIMEZONE;
  devices: Device[];
  days: DayRecord[];
  status?: Status;
}

export interface Issue {
  path: string;
  message: string;
}

export type ValidateResult = { ok: true; document: ScreenTimeDocument } | { ok: false; issues: Issue[] };

const PLATFORMS = new Set<Platform>(["android", "ios", "other"]);
const SOURCE_KINDS = new Set<SourceKind>(["manual", "file", "android-usage-stats"]);
const DEVICE_METHODS = new Set<DeviceMethod>(["events", "event-stats", "typed"]);
const APPS_METHODS = new Set<AppsMethod>(["events", "usage-stats", "typed"]);
const BASES = new Set<TotalBasis>(["unlocked-interactive", "screen-interactive", "typed"]);
const ACCESS = new Set(["granted", "denied", "unknown"]);
const RESULTS = new Set(["never", "ok", "locked", "denied", "unavailable", "empty", "error"]);
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const DEVICE_ID = /^[a-zA-Z0-9._:-]{1,64}$/;

export function emptyDocument(): ScreenTimeDocument {
  return { schema: SCHEMA, timezone: TIMEZONE, devices: [], days: [] };
}

export function withoutStatus(document: ScreenTimeDocument): ScreenTimeDocument {
  return {
    schema: document.schema,
    timezone: document.timezone,
    devices: document.devices,
    days: document.days,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extra(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: Issue[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push({ path: `${path}.${key}`, message: "Unknown field" });
  }
}

function readString(value: unknown, path: string, max: number, issues: Issue[]): string | undefined {
  if (typeof value !== "string") {
    issues.push({ path, message: "Must be text" });
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    issues.push({ path, message: `Must be 1 to ${max} characters` });
    return undefined;
  }
  if (/[\u0000-\u001f]/.test(trimmed)) {
    issues.push({ path, message: "Must not contain control characters" });
    return undefined;
  }
  return trimmed;
}

function readMs(value: unknown, path: string, max: number, issues: Issue[]): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push({ path, message: "Must be a whole number of milliseconds" });
    return undefined;
  }
  if (value < 0 || value > max) {
    issues.push({ path, message: `Must be from 0 to ${max} milliseconds` });
    return undefined;
  }
  return value;
}

function readTimestamp(value: unknown, path: string, issues: Issue[]): string | undefined {
  if (typeof value !== "string" || !ISO_TIME.test(value) || Number.isNaN(Date.parse(value))) {
    issues.push({ path, message: "Must be an ISO-8601 timestamp with Z or a numeric offset" });
    return undefined;
  }
  return value;
}

function readApps(value: unknown, path: string, issues: Issue[]): AppUse[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, message: "Must be a non-empty list, or the field must be omitted" });
    return undefined;
  }
  if (value.length > 300) {
    issues.push({ path, message: "Must list at most 300 apps" });
    return undefined;
  }
  const apps: AppUse[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path: itemPath, message: "Must be an object" });
      return;
    }
    extra(item, ["id", "label", "foregroundMs", "visibleMs"], itemPath, issues);
    const id = readString(item.id, `${itemPath}.id`, 200, issues);
    const label = readString(item.label, `${itemPath}.label`, 80, issues);
    const foregroundMs = readMs(item.foregroundMs, `${itemPath}.foregroundMs`, MAX_DAY_MS, issues);
    let visibleMs: number | undefined;
    if ("visibleMs" in item) {
      visibleMs = readMs(item.visibleMs, `${itemPath}.visibleMs`, MAX_DAY_MS, issues);
    }
    if (!id || !label || foregroundMs === undefined) return;
    if (seen.has(id)) {
      issues.push({ path: `${itemPath}.id`, message: "Duplicate app id on this day" });
      return;
    }
    seen.add(id);
    apps.push(visibleMs === undefined ? { id, label, foregroundMs } : { id, label, foregroundMs, visibleMs });
  });
  return apps.length === value.length ? apps : undefined;
}

export function validateDocument(input: unknown, options: { maxDate: string }): ValidateResult {
  const issues: Issue[] = [];
  if (!isRealDate(options.maxDate)) issues.push({ path: "maxDate", message: "Validator maxDate is not a real date" });
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: "$", message: "The file must be one JSON object" }] };
  }
  extra(input, ["schema", "timezone", "devices", "days", "status"], "$", issues);
  if (input.schema !== SCHEMA) issues.push({ path: "$.schema", message: `Must be ${SCHEMA}` });
  if (input.timezone !== TIMEZONE) {
    issues.push({ path: "$.timezone", message: `Must be ${TIMEZONE}. Dates are Sydney civil dates.` });
  }
  const devices: Device[] = [];
  const deviceIds = new Set<string>();
  if (!Array.isArray(input.devices)) {
    issues.push({ path: "$.devices", message: "Must be a list" });
  } else if (input.devices.length > 12) {
    issues.push({ path: "$.devices", message: "Must list at most 12 devices" });
  } else {
    input.devices.forEach((item, index) => {
      const path = `$.devices[${index}]`;
      if (!isRecord(item)) {
        issues.push({ path, message: "Must be an object" });
        return;
      }
      extra(item, ["id", "label", "platform"], path, issues);
      const label = readString(item.label, `${path}.label`, 80, issues);
      const platform = item.platform;
      if (typeof item.id !== "string" || !DEVICE_ID.test(item.id)) {
        issues.push({ path: `${path}.id`, message: "Must be 1 to 64 letters, digits, or . _ : -" });
      } else if (deviceIds.has(item.id)) {
        issues.push({ path: `${path}.id`, message: "Duplicate device id" });
      } else {
        deviceIds.add(item.id);
      }
      if (typeof platform !== "string" || !PLATFORMS.has(platform as Platform)) {
        issues.push({ path: `${path}.platform`, message: "Must be android, ios, or other" });
      }
      if (typeof item.id === "string" && label && typeof platform === "string" && PLATFORMS.has(platform as Platform)) {
        devices.push({ id: item.id, label, platform: platform as Platform });
      }
    });
  }

  const days: DayRecord[] = [];
  const dayKeys = new Set<string>();
  if (!Array.isArray(input.days)) {
    issues.push({ path: "$.days", message: "Must be a list" });
  } else if (input.days.length > 5000) {
    issues.push({ path: "$.days", message: "Must list at most 5000 days" });
  } else {
    input.days.forEach((item, index) => readDay(item, index, options.maxDate, deviceIds, dayKeys, days, issues));
  }

  let status: Status | undefined;
  if ("status" in input) status = readStatus(input.status, issues);

  if (issues.length > 0) return { ok: false, issues };
  days.sort((a, b) => a.date.localeCompare(b.date) || a.deviceId.localeCompare(b.deviceId));
  devices.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const document: ScreenTimeDocument = { schema: SCHEMA, timezone: TIMEZONE, devices, days };
  if (status) document.status = status;
  return { ok: true, document };
}

function readDay(
  item: unknown,
  index: number,
  maxDate: string,
  deviceIds: Set<string>,
  dayKeys: Set<string>,
  days: DayRecord[],
  issues: Issue[],
) {
  const path = `$.days[${index}]`;
  if (!isRecord(item)) {
    issues.push({ path, message: "Must be an object" });
    return;
  }
  extra(
    item,
    [
      "date",
      "deviceId",
      "source",
      "screenInteractiveMs",
      "unlockedInteractiveMs",
      "deviceTotal",
      "apps",
      "appsNote",
      "hours",
    ],
    path,
    issues,
  );
  let date = "";
  if (typeof item.date !== "string" || !isRealDate(item.date)) {
    issues.push({ path: `${path}.date`, message: "Must be a real YYYY-MM-DD date" });
  } else if (item.date < EARLIEST_DATE || item.date > maxDate) {
    issues.push({ path: `${path}.date`, message: `Must be from ${EARLIEST_DATE} through ${maxDate}` });
  } else {
    date = item.date;
  }
  const deviceId = typeof item.deviceId === "string" ? item.deviceId : "";
  if (!deviceIds.has(deviceId)) issues.push({ path: `${path}.deviceId`, message: "Must match a device id" });
  const key = `${date}|${deviceId}`;
  if (date && deviceId) {
    if (dayKeys.has(key)) issues.push({ path, message: "Duplicate date for this device. Import replaces a day. It does not list it twice." });
    else dayKeys.add(key);
  }
  const source = readSource(item.source, `${path}.source`, issues);
  let screenInteractiveMs: number | undefined;
  let unlockedInteractiveMs: number | undefined;
  if ("screenInteractiveMs" in item) {
    screenInteractiveMs = readMs(item.screenInteractiveMs, `${path}.screenInteractiveMs`, MAX_DAY_MS, issues);
  }
  if ("unlockedInteractiveMs" in item) {
    unlockedInteractiveMs = readMs(item.unlockedInteractiveMs, `${path}.unlockedInteractiveMs`, MAX_DAY_MS, issues);
  }
  if (
    screenInteractiveMs !== undefined &&
    unlockedInteractiveMs !== undefined &&
    unlockedInteractiveMs > screenInteractiveMs
  ) {
    issues.push({
      path: `${path}.unlockedInteractiveMs`,
      message: "Unlocked time is part of screen-interactive time, so it cannot be larger",
    });
  }
  const deviceTotal = "deviceTotal" in item ? readDeviceTotal(item.deviceTotal, `${path}.deviceTotal`, issues) : undefined;
  const apps = "apps" in item ? readApps(item.apps, `${path}.apps`, issues) : undefined;
  const appsNote = "appsNote" in item ? readAppsNote(item.appsNote, `${path}.appsNote`, issues) : undefined;
  const hours = "hours" in item ? readHours(item.hours, `${path}.hours`, issues) : undefined;

  if (deviceTotal && source) checkBasis(deviceTotal, source, screenInteractiveMs, unlockedInteractiveMs, path, issues);
  if (apps && !appsNote) issues.push({ path: `${path}.appsNote`, message: "Required when apps is present" });
  if (appsNote && !apps) issues.push({ path: `${path}.apps`, message: "Required when appsNote is present" });
  if (!deviceTotal && !apps) {
    issues.push({ path, message: "A day needs a device total, an app list, or both. Omit the day when there is no data." });
  }
  if (hours && source?.kind === "android-usage-stats" && deviceTotal && deviceTotal.method !== "events" && appsNote?.method !== "events") {
    issues.push({ path: `${path}.hours`, message: "Hour buckets need event timestamps. Aggregated totals cannot invent them." });
  }
  if (hours && deviceTotal?.method === "event-stats") {
    issues.push({ path: `${path}.hours`, message: "Event stats have no hour timestamps." });
  }
  if (!date || !deviceId || !source) return;
  if ((deviceTotal && !deviceTotalOk(deviceTotal)) || (apps && !appsNote)) return;
  const day: DayRecord = { date, deviceId, source };
  if (screenInteractiveMs !== undefined) day.screenInteractiveMs = screenInteractiveMs;
  if (unlockedInteractiveMs !== undefined) day.unlockedInteractiveMs = unlockedInteractiveMs;
  if (deviceTotal && deviceTotalOk(deviceTotal)) day.deviceTotal = deviceTotal;
  if (apps && appsNote && appsNoteOk(appsNote)) {
    day.apps = apps;
    day.appsNote = appsNote;
  }
  if (hours) day.hours = hours;
  if (day.deviceTotal || day.apps) days.push(day);
}

function deviceTotalOk(value: DeviceTotal | undefined): value is DeviceTotal {
  return Boolean(value && value.basis && value.method && value.detail);
}

function appsNoteOk(value: AppsNote | undefined): value is AppsNote {
  return Boolean(value && value.method && value.detail);
}

function checkBasis(
  total: DeviceTotal | undefined,
  source: Source,
  screenInteractiveMs: number | undefined,
  unlockedInteractiveMs: number | undefined,
  path: string,
  issues: Issue[],
) {
  if (!total || !total.basis || !total.method) return;
  if (total.basis === "unlocked-interactive" && unlockedInteractiveMs === undefined) {
    issues.push({ path: `${path}.unlockedInteractiveMs`, message: "Required when the total is unlocked and interactive" });
  }
  if ((total.basis === "screen-interactive" || total.basis === "typed") && screenInteractiveMs === undefined) {
    issues.push({ path: `${path}.screenInteractiveMs`, message: "Required for this device total" });
  }
  if (source.kind === "android-usage-stats" && total.method === "typed") {
    issues.push({ path: `${path}.deviceTotal.method`, message: "A phone reading is not a typed total" });
  }
  if (source.kind === "manual" && total.method !== "typed") {
    issues.push({ path: `${path}.deviceTotal.method`, message: "A typed day uses method typed" });
  }
}

function readSource(value: unknown, path: string, issues: Issue[]): Source | undefined {
  if (!isRecord(value)) {
    issues.push({ path, message: "Must be an object" });
    return undefined;
  }
  extra(value, ["kind", "name", "recordedAt"], path, issues);
  const name = readString(value.name, `${path}.name`, 120, issues);
  const recordedAt = readTimestamp(value.recordedAt, `${path}.recordedAt`, issues);
  if (typeof value.kind !== "string" || !SOURCE_KINDS.has(value.kind as SourceKind)) {
    issues.push({ path: `${path}.kind`, message: "Must be manual, file, or android-usage-stats" });
    return undefined;
  }
  if (!name || !recordedAt) return undefined;
  return { kind: value.kind as SourceKind, name, recordedAt };
}

function readDeviceTotal(value: unknown, path: string, issues: Issue[]): DeviceTotal | undefined {
  if (!isRecord(value)) {
    issues.push({ path, message: "Must be an object" });
    return undefined;
  }
  extra(value, ["basis", "method", "partial", "detail"], path, issues);
  const detail = readString(value.detail, `${path}.detail`, 400, issues);
  if (typeof value.basis !== "string" || !BASES.has(value.basis as TotalBasis)) {
    issues.push({ path: `${path}.basis`, message: "Must be unlocked-interactive, screen-interactive, or typed" });
  }
  if (typeof value.method !== "string" || !DEVICE_METHODS.has(value.method as DeviceMethod)) {
    issues.push({ path: `${path}.method`, message: "Must be events, event-stats, or typed" });
  }
  if (typeof value.partial !== "boolean") issues.push({ path: `${path}.partial`, message: "Must be true or false" });
  if (
    typeof value.basis !== "string" ||
    typeof value.method !== "string" ||
    typeof value.partial !== "boolean" ||
    !detail ||
    !BASES.has(value.basis as TotalBasis) ||
    !DEVICE_METHODS.has(value.method as DeviceMethod)
  ) {
    return undefined;
  }
  return { basis: value.basis as TotalBasis, method: value.method as DeviceMethod, partial: value.partial, detail };
}

function readAppsNote(value: unknown, path: string, issues: Issue[]): AppsNote | undefined {
  if (!isRecord(value)) {
    issues.push({ path, message: "Must be an object" });
    return undefined;
  }
  extra(value, ["method", "partial", "detail"], path, issues);
  const detail = readString(value.detail, `${path}.detail`, 400, issues);
  if (typeof value.method !== "string" || !APPS_METHODS.has(value.method as AppsMethod)) {
    issues.push({ path: `${path}.method`, message: "Must be events, usage-stats, or typed" });
  }
  if (typeof value.partial !== "boolean") issues.push({ path: `${path}.partial`, message: "Must be true or false" });
  if (typeof value.method !== "string" || typeof value.partial !== "boolean" || !detail || !APPS_METHODS.has(value.method as AppsMethod)) {
    return undefined;
  }
  return { method: value.method as AppsMethod, partial: value.partial, detail };
}

function readHours(value: unknown, path: string, issues: Issue[]): HourBucket[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, message: "Must be a non-empty list, or the field must be omitted" });
    return undefined;
  }
  if (value.length > 24) {
    issues.push({ path, message: "Must list at most 24 hours" });
    return undefined;
  }
  const hours: HourBucket[] = [];
  const seen = new Set<number>();
  let screenSum = 0;
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path: itemPath, message: "Must be an object" });
      return;
    }
    extra(item, ["hour", "screenInteractiveMs", "unlockedInteractiveMs", "partial", "apps"], itemPath, issues);
    const hour = item.hour;
    if (typeof hour !== "number" || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      issues.push({ path: `${itemPath}.hour`, message: "Must be an hour from 0 to 23 in Australia/Sydney" });
      return;
    }
    if (seen.has(hour)) issues.push({ path: `${itemPath}.hour`, message: "Duplicate hour" });
    seen.add(hour);
    if (typeof item.partial !== "boolean") issues.push({ path: `${itemPath}.partial`, message: "Must be true or false" });
    let screenInteractiveMs: number | undefined;
    let unlockedInteractiveMs: number | undefined;
    if ("screenInteractiveMs" in item) {
      screenInteractiveMs = readMs(item.screenInteractiveMs, `${itemPath}.screenInteractiveMs`, MAX_HOUR_MS, issues);
      if (screenInteractiveMs !== undefined) screenSum += screenInteractiveMs;
    }
    if ("unlockedInteractiveMs" in item) {
      unlockedInteractiveMs = readMs(item.unlockedInteractiveMs, `${itemPath}.unlockedInteractiveMs`, MAX_HOUR_MS, issues);
    }
    if (
      screenInteractiveMs !== undefined &&
      unlockedInteractiveMs !== undefined &&
      unlockedInteractiveMs > screenInteractiveMs
    ) {
      issues.push({ path: `${itemPath}.unlockedInteractiveMs`, message: "Cannot be larger than screen-interactive time in this hour" });
    }
    const apps = "apps" in item ? readApps(item.apps, `${itemPath}.apps`, issues) : undefined;
    if (screenInteractiveMs === undefined && unlockedInteractiveMs === undefined && !apps) {
      issues.push({ path: itemPath, message: "An hour needs a measurement. Omit hours you do not have." });
      return;
    }
    if (typeof item.partial !== "boolean") return;
    const bucket: HourBucket = { hour, partial: item.partial };
    if (screenInteractiveMs !== undefined) bucket.screenInteractiveMs = screenInteractiveMs;
    if (unlockedInteractiveMs !== undefined) bucket.unlockedInteractiveMs = unlockedInteractiveMs;
    if (apps) bucket.apps = apps;
    hours.push(bucket);
  });
  if (screenSum > MAX_DAY_MS) issues.push({ path, message: "Hour totals are longer than a Sydney day" });
  return hours.length === value.length ? hours : undefined;
}

function readStatus(value: unknown, issues: Issue[]): Status | undefined {
  const path = "$.status";
  if (!isRecord(value)) {
    issues.push({ path, message: "Must be an object" });
    return undefined;
  }
  extra(
    value,
    [
      "usageAccess",
      "userUnlocked",
      "lastAttemptAt",
      "lastSuccessAt",
      "lastResult",
      "lastDetail",
      "deviceZone",
      "zoneMatches",
      "eventsRetainedFrom",
      "droppedUnalignedDays",
    ],
    path,
    issues,
  );
  if (typeof value.usageAccess !== "string" || !ACCESS.has(value.usageAccess)) {
    issues.push({ path: `${path}.usageAccess`, message: "Must be granted, denied, or unknown" });
  }
  if (typeof value.lastResult !== "string" || !RESULTS.has(value.lastResult)) {
    issues.push({ path: `${path}.lastResult`, message: "Must be a known refresh result" });
  }
  if (typeof value.userUnlocked !== "boolean" && value.userUnlocked !== null) {
    issues.push({ path: `${path}.userUnlocked`, message: "Must be true, false, or null" });
  }
  if (typeof value.zoneMatches !== "boolean") issues.push({ path: `${path}.zoneMatches`, message: "Must be true or false" });
  const lastDetail = readString(value.lastDetail, `${path}.lastDetail`, 400, issues);
  const deviceZone = readString(value.deviceZone, `${path}.deviceZone`, 80, issues);
  const lastAttemptAt = readNullableTime(value.lastAttemptAt, `${path}.lastAttemptAt`, issues);
  const lastSuccessAt = readNullableTime(value.lastSuccessAt, `${path}.lastSuccessAt`, issues);
  const eventsRetainedFrom = readNullableTime(value.eventsRetainedFrom, `${path}.eventsRetainedFrom`, issues);
  if (typeof value.droppedUnalignedDays !== "number" || !Number.isInteger(value.droppedUnalignedDays) || value.droppedUnalignedDays < 0) {
    issues.push({ path: `${path}.droppedUnalignedDays`, message: "Must be a whole number from 0 up" });
  }
  if (
    typeof value.usageAccess !== "string" ||
    typeof value.lastResult !== "string" ||
    (typeof value.userUnlocked !== "boolean" && value.userUnlocked !== null) ||
    typeof value.zoneMatches !== "boolean" ||
    typeof value.droppedUnalignedDays !== "number" ||
    !lastDetail ||
    !deviceZone ||
    lastAttemptAt === undefined ||
    lastSuccessAt === undefined ||
    eventsRetainedFrom === undefined
  ) {
    return undefined;
  }
  return {
    usageAccess: value.usageAccess as Status["usageAccess"],
    userUnlocked: value.userUnlocked,
    lastAttemptAt,
    lastSuccessAt,
    lastResult: value.lastResult as Status["lastResult"],
    lastDetail,
    deviceZone,
    zoneMatches: value.zoneMatches,
    eventsRetainedFrom,
    droppedUnalignedDays: value.droppedUnalignedDays,
  };
}

function readNullableTime(value: unknown, path: string, issues: Issue[]): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") {
    issues.push({ path, message: "Must be a timestamp or null" });
    return undefined;
  }
  return readTimestamp(value, path, issues) ?? null;
}

export interface Headline {
  ms: number | null;
  basis: TotalBasis | null;
  partial: boolean;
}

export function headline(day: DayRecord): Headline {
  if (!day.deviceTotal) return { ms: null, basis: null, partial: false };
  if (day.deviceTotal.basis === "unlocked-interactive") {
    return {
      ms: day.unlockedInteractiveMs ?? null,
      basis: "unlocked-interactive",
      partial: day.deviceTotal.partial,
    };
  }
  return {
    ms: day.screenInteractiveMs ?? null,
    basis: day.deviceTotal.basis,
    partial: day.deviceTotal.partial,
  };
}

export function foregroundSum(day: DayRecord): number | null {
  if (!day.apps) return null;
  return day.apps.reduce((total, app) => total + app.foregroundMs, 0);
}

export function basisLabel(basis: TotalBasis): string {
  if (basis === "unlocked-interactive") return "Unlocked and interactive";
  if (basis === "screen-interactive") return "Screen interactive";
  return "Typed screen time";
}

export interface DaySummary {
  date: string;
  records: DayRecord[];
  headlineMs: number | null;
  reported: number;
  omitted: number;
  partial: boolean;
  foregroundMs: number | null;
}

export function recordsFor(document: ScreenTimeDocument, deviceId: string | "all"): DayRecord[] {
  if (deviceId === "all") return document.days;
  return document.days.filter((day) => day.deviceId === deviceId);
}

export function summarizeDay(date: string, records: readonly DayRecord[]): DaySummary {
  const values: number[] = [];
  let omitted = 0;
  let partial = false;
  let foreground: number | null = null;
  for (const record of records) {
    const head = headline(record);
    if (head.ms === null) omitted += 1;
    else values.push(head.ms);
    if (head.partial) partial = true;
    const apps = foregroundSum(record);
    if (apps !== null) foreground = (foreground ?? 0) + apps;
  }
  if (omitted > 0 && values.length > 0) partial = true;
  return {
    date,
    records: [...records],
    headlineMs: values.length === 0 ? null : values.reduce((total, value) => total + value, 0),
    reported: values.length,
    omitted,
    partial,
    foregroundMs: foreground,
  };
}

export type Heat = "missing" | "apps" | "zero" | "low" | "mid" | "high" | "higher";

export function heatFor(summary: DaySummary): Heat {
  if (summary.headlineMs === null) {
    if (summary.records.length === 0 || summary.foregroundMs === null) return "missing";
    return "apps";
  }
  if (summary.headlineMs === 0) return "zero";
  if (summary.headlineMs < MS_HOUR) return "low";
  if (summary.headlineMs < 3 * MS_HOUR) return "mid";
  if (summary.headlineMs < 5 * MS_HOUR) return "high";
  return "higher";
}

export function dayAria(summary: DaySummary, today: string): string {
  const { year, name } = monthParts(summary.date.slice(0, 7));
  const when = `${WEEKDAYS_LONG[weekdayIndex(summary.date)]} ${Number(summary.date.slice(8))} ${name} ${year}`;
  const parts = [when];
  if (summary.date === today) parts.push("today");
  if (summary.date > today) {
    parts.push("not started");
    return parts.join(", ");
  }
  if (summary.headlineMs === null && summary.foregroundMs === null) {
    parts.push("no screen time stored");
    return parts.join(", ");
  }
  if (summary.headlineMs === null) {
    parts.push("no device screen total");
    if (summary.foregroundMs !== null) {
      parts.push(`app foreground ${formatDuration(summary.foregroundMs)}, kept separate from screen time`);
    }
    return parts.join(", ");
  }
  const basis = summary.records.find((record) => record.deviceTotal)?.deviceTotal?.basis;
  parts.push(`${basis ? basisLabel(basis).toLowerCase() : "screen time"} ${formatDuration(summary.headlineMs)}`);
  if (summary.headlineMs === 0) parts.push("recorded zero");
  if (summary.partial) parts.push("partial");
  if (summary.reported > 1) parts.push(`sum of ${summary.reported} devices`);
  return parts.join(", ");
}

export interface WeekSummary {
  start: string;
  end: string;
  headlineMs: number | null;
  recordedDays: number;
  elapsedDays: number;
  partial: boolean;
}

export function summarizeWeek(days: readonly DayRecord[], weekStartIso: string, today: string): WeekSummary {
  const end = addDays(weekStartIso, 6);
  let headlineMs: number | null = null;
  let recordedDays = 0;
  let elapsedDays = 0;
  let partial = false;
  for (let iso = weekStartIso; iso <= end; iso = addDays(iso, 1)) {
    if (iso > today || iso < EARLIEST_DATE) continue;
    elapsedDays += 1;
    const summary = summarizeDay(
      iso,
      days.filter((day) => day.date === iso),
    );
    if (summary.headlineMs === null) continue;
    recordedDays += 1;
    headlineMs = (headlineMs ?? 0) + summary.headlineMs;
    if (summary.partial) partial = true;
  }
  if (recordedDays > 0 && recordedDays < elapsedDays) partial = true;
  return { start: weekStartIso, end, headlineMs, recordedDays, elapsedDays, partial };
}

export function recentWeeks(days: readonly DayRecord[], today: string, limit = 8): WeekSummary[] {
  if (days.length === 0) return [];
  const earliest = days.reduce((min, day) => (day.date < min ? day.date : min), days[0].date);
  const weeks: WeekSummary[] = [];
  for (let cursor = weekStart(earliest); cursor <= weekStart(today); cursor = addDays(cursor, 7)) {
    weeks.push(summarizeWeek(days, cursor, today));
  }
  return weeks.slice(-limit);
}

export function monthSummaryText(days: readonly DayRecord[], monthKey: string): string {
  const inMonth = days.filter((day) => day.date.slice(0, 7) === monthKey);
  if (inMonth.length === 0) return "No screen time stored for this month";
  const byDate = new Map<string, DayRecord[]>();
  for (const day of inMonth) {
    const list = byDate.get(day.date) ?? [];
    list.push(day);
    byDate.set(day.date, list);
  }
  let headlineMs = 0;
  let recorded = 0;
  let appOnly = 0;
  let partial = 0;
  for (const [date, records] of byDate) {
    const summary = summarizeDay(date, records);
    if (summary.headlineMs === null) {
      if (summary.foregroundMs !== null) appOnly += 1;
      continue;
    }
    recorded += 1;
    headlineMs += summary.headlineMs;
    if (summary.partial) partial += 1;
  }
  if (recorded === 0) {
    const noun = appOnly === 1 ? "day" : "days";
    return appOnly > 0
      ? `No device screen total. App foreground is stored on ${appOnly} ${noun}, separate from screen time.`
      : "No screen time stored for this month";
  }
  const average = Math.round(headlineMs / recorded);
  const noun = recorded === 1 ? "day" : "days";
  let text = `${formatDuration(headlineMs)} of screen time over ${recorded} ${noun}. Average ${formatDuration(average)}.`;
  if (partial > 0) text += " Some of those days are partial.";
  if (appOnly > 0) {
    text += ` ${appOnly} more ${appOnly === 1 ? "day has" : "days have"} app foreground only.`;
  }
  return text;
}

export interface MergeSuccess {
  ok: true;
  document: ScreenTimeDocument;
  added: number;
  replaced: number;
  replacedKeys: string[];
}

export function mergeDocuments(base: ScreenTimeDocument, incoming: ScreenTimeDocument): MergeSuccess | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];
  const devices = new Map(base.devices.map((device) => [device.id, { ...device }]));
  for (const device of incoming.devices) {
    const existing = devices.get(device.id);
    if (existing && existing.platform !== device.platform) {
      issues.push({
        path: `$.devices[${device.id}]`,
        message: `Device ${device.id} is already stored as ${existing.platform}`,
      });
    } else {
      devices.set(device.id, { ...device });
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  const days = new Map(base.days.map((day) => [`${day.date}|${day.deviceId}`, structuredClone(day)]));
  let added = 0;
  let replaced = 0;
  const replacedKeys: string[] = [];
  for (const day of incoming.days) {
    const key = `${day.date}|${day.deviceId}`;
    if (days.has(key)) {
      replaced += 1;
      replacedKeys.push(key);
    } else {
      added += 1;
    }
    days.set(key, structuredClone(day));
  }
  const document: ScreenTimeDocument = {
    schema: SCHEMA,
    timezone: TIMEZONE,
    devices: [...devices.values()],
    days: [...days.values()],
  };
  if (base.status) document.status = structuredClone(base.status);
  return { ok: true, document, added, replaced, replacedKeys };
}

export interface ManualInput {
  date: string;
  deviceId: string;
  deviceLabel: string;
  platform: Platform;
  creatingDevice: boolean;
  recordTotal: boolean;
  hours: number;
  minutes: number;
  apps: { label: string; hours: number; minutes: number }[];
  recordedAt: string;
}

export function insertManual(
  document: ScreenTimeDocument,
  input: ManualInput,
  maxDate: string,
): { ok: true; document: ScreenTimeDocument; replaced: boolean } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!isRealDate(input.date)) issues.push({ path: "date", message: "Choose a real date" });
  else if (input.date < EARLIEST_DATE || input.date > maxDate) {
    issues.push({ path: "date", message: `Use a date from ${EARLIEST_DATE} through ${maxDate}` });
  }
  if (!Number.isInteger(input.hours) || input.hours < 0 || input.hours > 26) {
    issues.push({ path: "hours", message: "Hours must be a whole number from 0 to 26" });
  }
  if (!Number.isInteger(input.minutes) || input.minutes < 0 || input.minutes > 59) {
    issues.push({ path: "minutes", message: "Minutes must be a whole number from 0 to 59" });
  }
  const totalMs = input.hours * MS_HOUR + input.minutes * 60_000;
  if (totalMs > MAX_DAY_MS) issues.push({ path: "hours", message: "That is longer than a Sydney day" });
  const apps: AppUse[] = [];
  const seen = new Set<string>();
  input.apps.forEach((app, index) => {
    const label = app.label.trim();
    if (!label) {
      issues.push({ path: `apps[${index}]`, message: "Enter an app name or remove the row" });
      return;
    }
    if (!Number.isInteger(app.hours) || !Number.isInteger(app.minutes) || app.hours < 0 || app.minutes < 0 || app.minutes > 59) {
      issues.push({ path: `apps[${index}]`, message: "Enter hours and minutes as whole numbers" });
      return;
    }
    const foregroundMs = app.hours * MS_HOUR + app.minutes * 60_000;
    if (foregroundMs === 0) {
      issues.push({ path: `apps[${index}]`, message: "App time is zero. Remove the row, or enter the time you saw." });
      return;
    }
    if (foregroundMs > MAX_DAY_MS) {
      issues.push({ path: `apps[${index}]`, message: "That app time is longer than a Sydney day" });
      return;
    }
    let id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "app";
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);
    apps.push({ id, label, foregroundMs });
  });
  if (!input.recordTotal && apps.length === 0) {
    issues.push({ path: "total", message: "Add a screen total, an app, or both. Leaving it blank does not store a zero." });
  }
  if (issues.length > 0) return { ok: false, issues };

  const devices = document.devices.map((device) => ({ ...device }));
  let deviceId = input.deviceId;
  if (input.creatingDevice) {
    const label = input.deviceLabel.trim();
    if (!label) return { ok: false, issues: [{ path: "device", message: "Name the device" }] };
    deviceId = deviceIdForImport(label, devices.map((device) => device.id));
    devices.push({ id: deviceId, label, platform: input.platform });
  } else if (!devices.some((device) => device.id === deviceId)) {
    return { ok: false, issues: [{ path: "device", message: "Choose a device" }] };
  }

  const day: DayRecord = {
    date: input.date,
    deviceId,
    source: { kind: "manual", name: "Typed in", recordedAt: input.recordedAt },
  };
  if (input.recordTotal) {
    day.screenInteractiveMs = totalMs;
    day.deviceTotal = {
      basis: "typed",
      method: "typed",
      partial: false,
      detail: "Typed into this page. It was not read from a phone.",
    };
  }
  if (apps.length > 0) {
    day.apps = apps;
    day.appsNote = {
      method: "typed",
      partial: false,
      detail: "Typed app time. It is stored beside the screen total and is not added into it.",
    };
  }
  const replaced = document.days.some((existing) => existing.date === day.date && existing.deviceId === day.deviceId);
  const next: ScreenTimeDocument = {
    schema: SCHEMA,
    timezone: TIMEZONE,
    devices,
    days: document.days.filter((existing) => existing.date !== day.date || existing.deviceId !== day.deviceId).concat(day),
  };
  if (document.status) next.status = document.status;
  const validated = validateDocument(next, { maxDate });
  if (!validated.ok) return validated;
  return { ok: true, document: validated.document, replaced };
}

function deviceIdForImport(label: string, existing: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "device";
  let id = base;
  let n = 2;
  const taken = new Set(existing);
  while (taken.has(id) || !DEVICE_ID.test(id)) {
    id = `${base}-${n}`.slice(0, 64);
    n += 1;
  }
  return id;
}
