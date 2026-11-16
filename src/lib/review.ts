import { DAYS, type StudyDay } from "../data/days";
import { todayIso } from "./calendar";

export type ReviewResult = "remembered" | "forgot";

export type ReviewMark = {
  pinyin: string;
  result: ReviewResult;
  timestamp: string;
};

export type ReviewStore = {
  marks: ReviewMark[];
  lastCopiedAt: string | null;
};

export type CatalogWord = {
  pinyin: string;
  meaning: string;
  learned: string;
  example: { pinyin: string; english: string } | null;
};

export const REVIEW_KEY = "mandarin-review-v1";

const EMPTY: ReviewStore = { marks: [], lastCopiedAt: null };

export function loadReview(): ReviewStore {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ReviewStore>;
    const marks = Array.isArray(parsed.marks)
      ? parsed.marks.filter(
          (mark): mark is ReviewMark =>
            !!mark &&
            typeof mark.pinyin === "string" &&
            (mark.result === "remembered" || mark.result === "forgot") &&
            typeof mark.timestamp === "string",
        )
      : [];
    return {
      marks,
      lastCopiedAt: typeof parsed.lastCopiedAt === "string" ? parsed.lastCopiedAt : null,
    };
  } catch {
    return EMPTY;
  }
}

export function saveReview(store: ReviewStore): void {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(store));
  } catch {
    // Private browsing can block storage. Marks still apply for this visit.
  }
}

function sentenceWith(summary: string, pinyin: string): { pinyin: string; english: string } | null {
  if (!summary.includes(pinyin)) return null;
  const sentence = summary.split(/(?<=\.)\s+/).find((part) => part.includes(pinyin)) ?? summary;
  return { pinyin: sentence, english: "" };
}

export function frontMeaning(meaning: string): string {
  const stripped = meaning
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;:\s]+|[,;\s]+$/g, "")
    .trim();
  return stripped || meaning;
}

export function catalog(days: readonly StudyDay[] = DAYS): CatalogWord[] {
  const map = new Map<string, CatalogWord>();
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of sorted) {
    for (const word of day.words) {
      if (!map.has(word.pinyin)) {
        map.set(word.pinyin, {
          pinyin: word.pinyin,
          meaning: word.meaning,
          learned: day.date,
          example: word.example ?? sentenceWith(day.summary, word.pinyin),
        });
      }
    }
  }
  return [...map.values()];
}

export function latestMark(marks: readonly ReviewMark[], pinyin: string): ReviewMark | null {
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    if (marks[i].pinyin === pinyin) return marks[i];
  }
  return null;
}

/** Same result again removes that latest mark. The other result appends one. */
export function toggleMark(store: ReviewStore, pinyin: string, result: ReviewResult, now = new Date()): ReviewStore {
  const marks = store.marks.slice();
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    if (marks[i].pinyin !== pinyin) continue;
    if (marks[i].result === result) {
      marks.splice(i, 1);
      return { ...store, marks };
    }
    break;
  }
  marks.push({ pinyin, result, timestamp: now.toISOString() });
  return { ...store, marks };
}

export function forgottenPinyins(marks: readonly ReviewMark[]): Set<string> {
  const latest = new Map<string, ReviewResult>();
  for (const mark of marks) latest.set(mark.pinyin, mark.result);
  const forgotten = new Set<string>();
  for (const [pinyin, result] of latest) {
    if (result === "forgot") forgotten.add(pinyin);
  }
  return forgotten;
}

export function reviewCounts(words: readonly CatalogWord[], marks: readonly ReviewMark[]): {
  remembered: number;
  forgot: number;
  fresh: number;
} {
  let remembered = 0;
  let forgot = 0;
  let fresh = 0;
  for (const word of words) {
    const latest = latestMark(marks, word.pinyin);
    if (!latest) fresh += 1;
    else if (latest.result === "remembered") remembered += 1;
    else forgot += 1;
  }
  return { remembered, forgot, fresh };
}

export function forgotWords(words: readonly CatalogWord[], marks: readonly ReviewMark[]): CatalogWord[] {
  return words
    .filter((word) => latestMark(marks, word.pinyin)?.result === "forgot")
    .sort((a, b) => a.learned.localeCompare(b.learned) || a.pinyin.localeCompare(b.pinyin));
}

/** Unreviewed first (oldest learned), then forgotten words oldest review first. */
export function reviewQueue(words: readonly CatalogWord[], marks: readonly ReviewMark[]): CatalogWord[] {
  return words
    .filter((word) => {
      const latest = latestMark(marks, word.pinyin);
      return !latest || latest.result === "forgot";
    })
    .sort((a, b) => {
      const ta = latestMark(marks, a.pinyin)?.timestamp ?? "";
      const tb = latestMark(marks, b.pinyin)?.timestamp ?? "";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.learned.localeCompare(b.learned) || a.pinyin.localeCompare(b.pinyin);
    });
}

export function formatResults(forgot: readonly string[], remembered: readonly string[], day = todayIso()): string {
  return [
    `REVIEW RESULTS (${day})`,
    `Forgot: ${forgot.length ? forgot.join(", ") : "none"}`,
    `Remembered: ${remembered.length ? remembered.join(", ") : "none"}`,
  ].join("\n");
}

function groupedSince(marks: readonly ReviewMark[], after: string | null): { forgot: string[]; remembered: string[] } {
  const latest = new Map<string, ReviewMark>();
  for (const mark of marks) {
    if (after && mark.timestamp <= after) continue;
    latest.set(mark.pinyin, mark);
  }
  const forgot: string[] = [];
  const remembered: string[] = [];
  for (const [pinyin, mark] of latest) {
    (mark.result === "forgot" ? forgot : remembered).push(pinyin);
  }
  forgot.sort();
  remembered.sort();
  return { forgot, remembered };
}

export function resultsSinceCopy(store: ReviewStore, day = todayIso()): string {
  const groups = groupedSince(store.marks, store.lastCopiedAt);
  return formatResults(groups.forgot, groups.remembered, day);
}

export function resultsAll(store: ReviewStore, day = todayIso()): string {
  const groups = groupedSince(store.marks, null);
  return formatResults(groups.forgot, groups.remembered, day);
}

export function shortDate(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  if (!year || !month || !day) return iso;
  return `${day} ${months[month - 1]} ${year}`;
}

export function stampDay(timestamp: string): string {
  return shortDate(todayIso(new Date(timestamp)));
}

export type PeriodStats = {
  total: number;
  remembered: number;
  forgot: number;
  fresh: number;
};

/** Monday–Sunday week that contains an ISO date. */
export function weekRange(iso: string): { start: string; end: string } {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const isoOf = (value: Date) => {
    const yy = value.getUTCFullYear();
    const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(value.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };
  return { start: isoOf(start), end: isoOf(end) };
}

/** Totals use each day's count. Review splits count only the listed words. */
export function periodStats(days: readonly StudyDay[], marks: readonly ReviewMark[]): PeriodStats {
  let total = 0;
  let remembered = 0;
  let forgot = 0;
  for (const day of days) {
    total += day.count;
    for (const word of day.words) {
      const latest = latestMark(marks, word.pinyin);
      if (latest?.result === "remembered") remembered += 1;
      else if (latest?.result === "forgot") forgot += 1;
    }
  }
  return { total, remembered, forgot, fresh: Math.max(0, total - remembered - forgot) };
}
