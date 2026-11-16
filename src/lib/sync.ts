import { catalog, loadReview, saveReview, type CatalogWord, type ReviewMark, type ReviewResult, type ReviewStore } from "./review";

export const TOKEN_KEY = "mandarin-github-token";
export const SYNCED_AT_KEY = "mandarin-review-synced-at";
const DIRTY_KEY = "mandarin-review-dirty";

const API = "https://api.github.com/repos/Sdogz17/Grok/contents/data/review-state.json";

export type RemoteWord = {
  latest: ReviewResult;
  latest_at: string;
  history: { result: ReviewResult; at: string }[];
  meaning: string;
  learned_date: string;
};

export type RemoteState = {
  updated_at: string;
  words: Record<string, RemoteWord>;
};

export type SyncStatus =
  | { kind: "not-connected" }
  | { kind: "syncing" }
  | { kind: "offline" }
  | { kind: "error"; message: string }
  | { kind: "synced"; at: string };

type ApplyStore = (store: ReviewStore) => void;

let latestStore: ReviewStore | null = null;
let applyStore: ApplyStore | null = null;
let timer: number | null = null;
let inflight: Promise<void> | null = null;
let again = false;
let setStatus: ((status: SyncStatus) => void) | null = null;

export function loadToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function bindSync(store: ReviewStore, apply: ApplyStore, status: (next: SyncStatus) => void): void {
  latestStore = store;
  applyStore = apply;
  setStatus = status;
}

export function scheduleSync(store: ReviewStore): void {
  latestStore = store;
  try {
    localStorage.setItem(DIRTY_KEY, "1");
  } catch {
    // Ignore storage failure. The in-memory marks still work.
  }
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void syncNow();
  }, 4000);
}

export function syncStatusLabel(status: SyncStatus, now = Date.now()): string {
  if (status.kind === "not-connected") return "Not connected";
  if (status.kind === "syncing") return "Syncing";
  if (status.kind === "offline") return "Offline. Will sync when connected.";
  if (status.kind === "error") return "Sync error";
  const mins = Math.max(0, Math.round((now - new Date(status.at).getTime()) / 60000));
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `Synced ${hours} hr ago`;
}

export async function syncNow(): Promise<void> {
  if (inflight) {
    again = true;
    return inflight;
  }
  inflight = runSync().finally(() => {
    inflight = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return inflight;
}

async function runSync(): Promise<void> {
  const token = loadToken();
  if (!token) {
    setStatus?.({ kind: "not-connected" });
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setStatus?.({ kind: "offline" });
    return;
  }
  setStatus?.({ kind: "syncing" });
  try {
    const local = latestStore ?? loadReview();
    const remote = await getRemote(token);
    const merged = mergeRemote(local, remote?.state ?? null);
    if (merged.marks.length !== local.marks.length || JSON.stringify(merged.marks) !== JSON.stringify(local.marks)) {
      saveReview(merged);
      latestStore = merged;
      applyStore?.(merged);
    }
    const words = catalog();
    const next = toRemote(latestStore ?? merged, words);
    const remoteWords = remote?.state?.words ?? {};
    const changed = JSON.stringify(next.words) !== JSON.stringify(remoteWords);
    const dirty = localStorage.getItem(DIRTY_KEY) === "1";
    if (changed || dirty || !remote) {
      await putRemote(token, next, remote?.sha ?? null);
    }
    const at = new Date().toISOString();
    localStorage.setItem(SYNCED_AT_KEY, at);
    localStorage.removeItem(DIRTY_KEY);
    setStatus?.({ kind: "synced", at });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    setStatus?.({ kind: "error", message });
  }
}

function headers(token: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function getRemote(token: string): Promise<{ sha: string; state: RemoteState } | null> {
  const response = await fetch(`${API}?ref=main`, { headers: headers(token) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read review file (${response.status})`);
  const body = (await response.json()) as { sha?: string; content?: string };
  if (!body.sha || !body.content) throw new Error("Review file was missing its content");
  const state = JSON.parse(fromBase64(body.content)) as RemoteState;
  return { sha: body.sha, state };
}

async function putRemote(token: string, state: RemoteState, sha: string | null, attempt = 0): Promise<void> {
  const response = await fetch(API, {
    method: "PUT",
    headers: headers(token, true),
    body: JSON.stringify({
      message: "Update review marks [skip ci]",
      content: toBase64(JSON.stringify(state, null, 2) + "\n"),
      branch: "main",
      ...(sha ? { sha } : {}),
    }),
  });
  if (response.status === 409 && attempt < 3) {
    const remote = await getRemote(token);
    const merged = mergeRemote(latestStore ?? loadReview(), remote?.state ?? null);
    saveReview(merged);
    latestStore = merged;
    applyStore?.(merged);
    await putRemote(token, toRemote(merged, catalog()), remote?.sha ?? null, attempt + 1);
    return;
  }
  if (!response.ok) throw new Error(`Could not save review file (${response.status})`);
}

export function mergeRemote(local: ReviewStore, remote: RemoteState | null): ReviewStore {
  const events = new Map<string, ReviewMark>();
  const add = (pinyin: string, result: ReviewResult, timestamp: string) => {
    if (!pinyin || (result !== "remembered" && result !== "forgot") || !timestamp) return;
    const key = `${pinyin}\n${timestamp}`;
    if (!events.has(key)) events.set(key, { pinyin, result, timestamp });
  };
  for (const mark of local.marks) add(mark.pinyin, mark.result, mark.timestamp);
  for (const [pinyin, word] of Object.entries(remote?.words ?? {})) {
    for (const item of word.history ?? []) add(pinyin, item.result, item.at);
    if (word.latest && word.latest_at) add(pinyin, word.latest, word.latest_at);
  }
  const marks = [...events.values()].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.pinyin.localeCompare(b.pinyin),
  );
  return { marks, lastCopiedAt: local.lastCopiedAt };
}

export function toRemote(store: ReviewStore, words: readonly CatalogWord[]): RemoteState {
  const grouped = new Map<string, ReviewMark[]>();
  for (const mark of store.marks) {
    const list = grouped.get(mark.pinyin) ?? [];
    list.push(mark);
    grouped.set(mark.pinyin, list);
  }
  const info = new Map(words.map((word) => [word.pinyin, word]));
  const out: RemoteState["words"] = {};
  for (const [pinyin, list] of grouped) {
    const sorted = list.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const latest = sorted[sorted.length - 1];
    const known = info.get(pinyin);
    out[pinyin] = {
      latest: latest.result,
      latest_at: latest.timestamp,
      history: sorted.map((mark) => ({ result: mark.result, at: mark.timestamp })),
      meaning: known?.meaning ?? "",
      learned_date: known?.learned ?? "",
    };
  }
  return { updated_at: new Date().toISOString(), words: out };
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
