import type { ScreenTimeDocument, Status } from "./model";
import { MS_HOUR, TIMEZONE, formatWhen, zoneAbbreviation } from "./time";

export const STALE_MS = 36 * MS_HOUR;
export type Surface = "browser" | "android";

export function isStale(status: Status | undefined, now: Date): boolean {
  if (!status || status.usageAccess !== "granted") return false;
  if (!status.lastSuccessAt) return false;
  const parsed = Date.parse(status.lastSuccessAt);
  if (Number.isNaN(parsed)) return true;
  return now.getTime() - parsed > STALE_MS;
}

export function zoneLine(now = new Date()): string {
  return `Dates use ${TIMEZONE} (${zoneAbbreviation(now)}).`;
}

/** Plain sentences about what is connected. The page renders these as written. */
export function connectionLines(surface: Surface, document: ScreenTimeDocument, now: Date): string[] {
  const lines = [zoneLine(now)];
  if (surface === "browser") {
    lines.push("This browser cannot read Samsung Digital Wellbeing or iPhone Screen Time. Nothing is collected automatically here.");
    lines.push("The Android app reads usage on the phone and fills its own calendar. A file export is the way to copy that into this browser.");
    if (document.days.length > 0) {
      lines.push("What you see here is stored in this browser, from a file or from a day you typed.");
    }
    return lines;
  }
  const status = document.status;
  if (!status || status.usageAccess === "unknown") {
    lines.push("This page is inside the Screen time app. It has not checked Usage access yet.");
    return lines;
  }
  if (status.usageAccess === "denied") {
    lines.push("Usage access is off. The calendar is not reading this phone.");
    lines.push("Android shows a system screen for that permission. The app cannot turn it on by itself.");
    return lines;
  }
  if (!status.zoneMatches) {
    lines.push(`This phone is set to ${status.deviceZone}. Days are still counted in ${TIMEZONE}, and buckets that cross a Sydney midnight are left out.`);
  }
  if (status.lastResult === "never") {
    lines.push("Usage access is on. This phone has not been read yet.");
    return lines;
  }
  if (status.lastResult === "locked") {
    lines.push(
      "The last refresh was skipped because the phone was locked or usage stats were unavailable. Stored days were left as they were, and nothing was filled in as zero.",
    );
  } else if (status.lastResult === "empty") {
    lines.push("The last refresh found no usage rows. No day was set to zero, because an empty response is not a recorded zero.");
  } else if (status.lastResult === "unavailable") {
    lines.push("Usage stats came back unavailable. Stored days were left as they were, and nothing was filled in as zero.");
  } else if (status.lastResult === "error") {
    lines.push(status.lastDetail || "The last refresh failed. Stored days were left as they were.");
  } else if (status.lastSuccessAt) {
    lines.push(`Last read ${formatWhen(status.lastSuccessAt)}.`);
    if (status.droppedUnalignedDays > 0) {
      lines.push(
        `${status.droppedUnalignedDays} older buckets crossed a Sydney midnight and were left out, instead of being split into days.`,
      );
    }
  }
  if (isStale(status, now)) {
    lines.push(
      "The last successful read is old. Background refresh is best-effort and has no promised clock time. Open the app, with the phone unlocked, to read again.",
    );
  }
  return lines;
}
