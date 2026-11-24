import { describe, expect, it } from "vitest";
import exampleDocument from "../../fixtures/example.screentime.json";
import {
  emptyDocument,
  foregroundSum,
  headline,
  heatFor,
  insertManual,
  mergeDocuments,
  monthSummaryText,
  summarizeDay,
  summarizeWeek,
  validateDocument,
  type DayRecord,
  type ScreenTimeDocument,
} from "./model";
import { connectionLines, isStale } from "./status";
import { clearDocument, loadDocument, saveDocument, type KeyValue } from "./storage";
import { addDays, civilDate, monthWeeks, weekdayIndex, weekStart } from "./time";

const MAX = "2026-11-08";

function memory(initial?: string): KeyValue & { raw: string | null } {
  const state: { raw: string | null } = { raw: initial ?? null };
  return {
    get raw() {
      return state.raw;
    },
    set raw(value: string | null) {
      state.raw = value;
    },
    getItem: () => state.raw,
    setItem: (_key, value) => {
      state.raw = value;
    },
    removeItem: () => {
      state.raw = null;
    },
  };
}

function typedDay(date: string, ms: number | undefined, apps = false): DayRecord {
  const day: DayRecord = {
    date,
    deviceId: "phone",
    source: { kind: "manual", name: "Typed in", recordedAt: "2026-11-08T00:00:00.000Z" },
  };
  if (ms !== undefined) {
    day.screenInteractiveMs = ms;
    day.deviceTotal = {
      basis: "typed",
      method: "typed",
      partial: false,
      detail: "Typed into this page. It was not read from a phone.",
    };
  }
  if (apps) {
    day.apps = [{ id: "mail", label: "Mail", foregroundMs: 9_000_000 }];
    day.appsNote = {
      method: "typed",
      partial: false,
      detail: "Typed app time. It is stored beside the screen total and is not added into it.",
    };
  }
  return day;
}

function doc(days: DayRecord[]): ScreenTimeDocument {
  return {
    schema: "screentime.v1",
    timezone: "Australia/Sydney",
    devices: [{ id: "phone", label: "Example phone", platform: "android" }],
    days,
  };
}

describe("Sydney civil dates", () => {
  it("changes date at Sydney midnight, not at a fixed offset or UTC midnight", () => {
    expect(civilDate(new Date("2026-11-07T12:59:59.999Z"))).toBe("2026-11-07");
    expect(civilDate(new Date("2026-11-07T13:00:00.000Z"))).toBe("2026-11-08");
    expect(civilDate(new Date("2026-07-15T13:59:59.999Z"))).toBe("2026-07-15");
    expect(civilDate(new Date("2026-07-15T14:00:00.000Z"))).toBe("2026-07-16");
  });

  it("keeps the DST fallback and the skipped hour on the right civil dates", () => {
    expect(weekdayIndex("2026-04-05")).toBe(0);
    expect(weekdayIndex("2026-10-04")).toBe(0);
    expect(civilDate(new Date("2026-04-04T12:59:59.999Z"))).toBe("2026-04-04");
    expect(civilDate(new Date("2026-04-04T13:00:00.000Z"))).toBe("2026-04-05");
    expect(civilDate(new Date("2026-04-04T15:30:00.000Z"))).toBe("2026-04-05");
    expect(civilDate(new Date("2026-04-04T16:30:00.000Z"))).toBe("2026-04-05");
    expect(civilDate(new Date("2026-04-05T13:59:59.999Z"))).toBe("2026-04-05");
    expect(civilDate(new Date("2026-04-05T14:00:00.000Z"))).toBe("2026-04-06");
    expect(civilDate(new Date("2026-10-03T15:30:00.000Z"))).toBe("2026-10-04");
    expect(civilDate(new Date("2026-10-03T16:30:00.000Z"))).toBe("2026-10-04");
    expect(civilDate(new Date("2026-10-04T12:59:59.999Z"))).toBe("2026-10-04");
    expect(civilDate(new Date("2026-10-04T13:00:00.000Z"))).toBe("2026-10-05");
  });

  it("builds a Monday week and rejects a calendar date that does not exist", () => {
    expect(weekdayIndex("2026-11-08")).toBe(0);
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    const november = monthWeeks("2026-11");
    expect(november[0][0].iso).toBe("2026-10-26");
    expect(november[0][6]).toEqual({ iso: "2026-11-01", inMonth: true });
    expect(addDays("2026-10-04", 1)).toBe("2026-10-05");
    const bad = validateDocument(
      {
        schema: "screentime.v1",
        timezone: "Australia/Sydney",
        devices: [{ id: "phone", label: "Example phone", platform: "android" }],
        days: [typedDay("2026-02-31", 0)],
      },
      { maxDate: MAX },
    );
    expect(bad.ok).toBe(false);
  });
});

describe("document contract", () => {
  it("accepts the committed example and does not treat it as stored history", () => {
    const result = validateDocument(exampleDocument, { maxDate: MAX });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.days).toHaveLength(1);
    expect(result.document.days[0].screenInteractiveMs).toBe(3_600_000);
    expect(result.document.days[0].hours).toBeUndefined();
    expect(emptyDocument().days).toEqual([]);
  });

  it("rejects a future date, a negative total, an oversized total, and duplicate apps", () => {
    const base = doc([typedDay("2026-11-09", 60_000)]);
    expect(validateDocument(base, { maxDate: MAX }).ok).toBe(false);
    const negative = doc([typedDay("2026-11-08", -1)]);
    expect(validateDocument(negative, { maxDate: MAX }).ok).toBe(false);
    const huge = doc([typedDay("2026-11-08", 27 * 3_600_000)]);
    expect(validateDocument(huge, { maxDate: MAX }).ok).toBe(false);
    const day = typedDay("2026-11-08", 60_000);
    day.apps = [
      { id: "mail", label: "Mail", foregroundMs: 10 },
      { id: "mail", label: "Mail again", foregroundMs: 10 },
    ];
    day.appsNote = {
      method: "typed",
      partial: false,
      detail: "Typed app time. It is stored beside the screen total and is not added into it.",
    };
    const duplicate = validateDocument(doc([day]), { maxDate: MAX });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.issues.some((issue) => issue.message.includes("Duplicate app"))).toBe(true);
  });

  it("rejects hour buckets invented beside aggregated totals", () => {
    const day = typedDay("2026-11-01", 3_600_000);
    day.source = { kind: "android-usage-stats", name: "UsageStatsManager", recordedAt: "2026-11-02T00:00:00.000Z" };
    day.deviceTotal = {
      basis: "screen-interactive",
      method: "event-stats",
      partial: false,
      detail: "Android event stats for screen interactive time. The bucket matches this Sydney day.",
    };
    day.hours = [{ hour: 9, screenInteractiveMs: 3_600_000, partial: false }];
    const result = validateDocument(doc([day]), { maxDate: MAX });
    expect(result.ok).toBe(false);
  });

  it("keeps a reported zero distinct from a missing day", () => {
    const stored = doc([typedDay("2026-11-07", 0), typedDay("2026-11-06", undefined, true)]);
    const validated = validateDocument(stored, { maxDate: MAX });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const zero = summarizeDay("2026-11-07", validated.document.days.filter((day) => day.date === "2026-11-07"));
    const missing = summarizeDay("2026-11-05", []);
    const appsOnly = summarizeDay("2026-11-06", validated.document.days.filter((day) => day.date === "2026-11-06"));
    expect(zero.headlineMs).toBe(0);
    expect(heatFor(zero)).toBe("zero");
    expect(missing.headlineMs).toBeNull();
    expect(heatFor(missing)).toBe("missing");
    expect(appsOnly.headlineMs).toBeNull();
    expect(heatFor(appsOnly)).toBe("apps");
    expect(headline(appsOnly.records[0]).ms).toBeNull();
    expect(foregroundSum(appsOnly.records[0])).toBe(9_000_000);
    const week = summarizeWeek(validated.document.days, "2026-11-02", MAX);
    expect(week.headlineMs).toBe(0);
    expect(week.recordedDays).toBe(1);
    expect(week.elapsedDays).toBe(7);
    expect(week.partial).toBe(true);
    expect(monthSummaryText(validated.document.days, "2026-11")).toContain("0 m of screen time");
  });

  it("replaces the same day and device instead of adding the totals", () => {
    const first = doc([typedDay("2026-11-01", 60 * 60_000)]);
    const second = doc([typedDay("2026-11-01", 30 * 60_000)]);
    second.devices.push({ id: "other", label: "Other phone", platform: "ios" });
    second.days.push({ ...typedDay("2026-11-01", 15 * 60_000), deviceId: "other" });
    const merged = mergeDocuments(first, second);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.replaced).toBe(1);
    expect(merged.added).toBe(1);
    const phone = merged.document.days.find((day) => day.deviceId === "phone");
    const other = merged.document.days.find((day) => day.deviceId === "other");
    expect(phone?.screenInteractiveMs).toBe(30 * 60_000);
    expect(other?.screenInteractiveMs).toBe(15 * 60_000);
    const again = mergeDocuments(merged.document, second);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.document.days.filter((day) => day.deviceId === "phone")).toHaveLength(1);
    expect(again.document.days.find((day) => day.deviceId === "phone")?.screenInteractiveMs).toBe(30 * 60_000);
  });

  it("stores a typed zero only when asked, and never copies app time into the total", () => {
    const recordedAt = "2026-11-08T01:00:00.000Z";
    const zero = insertManual(
      emptyDocument(),
      {
        date: "2026-11-08",
        deviceId: "",
        deviceLabel: "Example phone",
        platform: "android",
        creatingDevice: true,
        recordTotal: true,
        hours: 0,
        minutes: 0,
        apps: [],
        recordedAt,
      },
      MAX,
    );
    expect(zero.ok).toBe(true);
    if (!zero.ok) return;
    expect(zero.document.days[0].screenInteractiveMs).toBe(0);
    expect(zero.document.days[0].hours).toBeUndefined();

    const appsOnly = insertManual(
      emptyDocument(),
      {
        date: "2026-11-08",
        deviceId: "",
        deviceLabel: "Example phone",
        platform: "android",
        creatingDevice: true,
        recordTotal: false,
        hours: 0,
        minutes: 0,
        apps: [{ label: "Mail", hours: 2, minutes: 0 }],
        recordedAt,
      },
      MAX,
    );
    expect(appsOnly.ok).toBe(true);
    if (!appsOnly.ok) return;
    expect(appsOnly.document.days[0].screenInteractiveMs).toBeUndefined();
    expect(appsOnly.document.days[0].deviceTotal).toBeUndefined();
    expect(foregroundSum(appsOnly.document.days[0])).toBe(2 * 3_600_000);

    const blank = insertManual(
      emptyDocument(),
      {
        date: "2026-11-08",
        deviceId: "phone",
        deviceLabel: "",
        platform: "android",
        creatingDevice: false,
        recordTotal: false,
        hours: 0,
        minutes: 0,
        apps: [],
        recordedAt,
      },
      MAX,
    );
    expect(blank.ok).toBe(false);
  });
});

describe("local store", () => {
  it("round-trips, refuses a corrupt payload, and deletes it only when asked", () => {
    const store = memory();
    const saved = saveDocument(store, doc([typedDay("2026-11-08", 120_000)]));
    expect(saved.ok).toBe(true);
    const loaded = loadDocument(store);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.document.days[0].screenInteractiveMs).toBe(120_000);
    store.setItem("screentime.v1", "{");
    expect(loadDocument(store)).toEqual({ ok: false, reason: "corrupt" });
    expect(store.raw).toBe("{");
    clearDocument(store);
    const cleared = loadDocument(store);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.document.days).toEqual([]);
  });
});

describe("connection copy", () => {
  it("does not describe the public page as automatic, and does not turn a locked refresh into zeros", () => {
    const browser = connectionLines("browser", emptyDocument(), new Date("2026-11-08T00:00:00.000Z"));
    expect(browser.join(" ")).toContain("cannot read");
    expect(browser.join(" ")).toContain("Nothing is collected automatically");
    const locked: ScreenTimeDocument = {
      ...emptyDocument(),
      status: {
        usageAccess: "granted",
        userUnlocked: false,
        lastAttemptAt: "2026-11-08T00:00:00.000Z",
        lastSuccessAt: "2026-11-07T00:00:00.000Z",
        lastResult: "locked",
        lastDetail: "Phone locked.",
        deviceZone: "Australia/Sydney",
        zoneMatches: true,
        eventsRetainedFrom: null,
        droppedUnalignedDays: 0,
      },
    };
    const lines = connectionLines("android", locked, new Date("2026-11-08T06:00:00.000Z"));
    expect(lines.join(" ")).toContain("nothing was filled in as zero");
    expect(isStale(locked.status, new Date("2026-11-08T06:00:00.000Z"))).toBe(false);
    expect(isStale(locked.status, new Date("2026-11-09T12:00:00.000Z"))).toBe(true);
  });
});
