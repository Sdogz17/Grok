import { validateDocument, type ScreenTimeDocument } from "./model";

export const STORAGE_KEY = "screentime.v1";

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult = { ok: true; document: ScreenTimeDocument } | { ok: false; reason: "corrupt" };
export type SaveResult = { ok: true } | { ok: false; reason: "quota" | "invalid" };

/** Load accepts dates through 2100 so a clock change does not brick a store that was valid when it was saved. */
const LOAD_MAX = "2100-01-01";

export function loadDocument(storage: KeyValue): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null || raw.trim() === "") {
    return { ok: true, document: { schema: "screentime.v1", timezone: "Australia/Sydney", devices: [], days: [] } };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = validateDocument(parsed, { maxDate: LOAD_MAX });
    if (!result.ok) return { ok: false, reason: "corrupt" };
    return { ok: true, document: result.document };
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}

export function saveDocument(storage: KeyValue, document: ScreenTimeDocument): SaveResult {
  const validated = validateDocument(document, { maxDate: LOAD_MAX });
  if (!validated.ok) return { ok: false, reason: "invalid" };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(validated.document));
    return { ok: true };
  } catch {
    return { ok: false, reason: "quota" };
  }
}

export function clearDocument(storage: KeyValue): void {
  storage.removeItem(STORAGE_KEY);
}
