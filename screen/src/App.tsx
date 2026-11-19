import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { readBridge } from "./lib/bridge";
import {
  basisLabel,
  dayAria,
  emptyDocument,
  headline,
  heatFor,
  insertManual,
  mergeDocuments,
  monthSummaryText,
  recentWeeks,
  recordsFor,
  summarizeDay,
  summarizeWeek,
  validateDocument,
  withoutStatus,
  type DayRecord,
  type Heat,
  type Issue,
  type Platform,
  type ScreenTimeDocument,
  type WeekSummary,
} from "./lib/model";
import { connectionLines, type Surface } from "./lib/status";
import { clearDocument, loadDocument, saveDocument } from "./lib/storage";
import {
  EARLIEST_DATE,
  MONTHS_SHORT,
  MS_HOUR,
  WEEKDAYS,
  WEEKDAYS_LONG,
  addDays,
  civilDate,
  formatCompact,
  formatDuration,
  formatWhen,
  monthParts,
  monthWeeks,
  shiftMonth,
  weekStart,
  weekdayIndex,
} from "./lib/time";

const SURFACE: Surface = import.meta.env.VITE_SURFACE === "android" ? "android" : "browser";
const SHIELD_MS = 600;
const CLOSE_GUARD_MS = 800;
const SWIPE_PX = 48;

const EXAMPLE = `{
  "schema": "screentime.v1",
  "timezone": "Australia/Sydney",
  "devices": [{ "id": "phone", "label": "Example phone", "platform": "android" }],
  "days": [{
    "date": "2026-01-05",
    "deviceId": "phone",
    "source": { "kind": "manual", "name": "Typed in", "recordedAt": "2026-01-05T01:00:00.000Z" },
    "screenInteractiveMs": 3600000,
    "deviceTotal": {
      "basis": "typed",
      "method": "typed",
      "partial": false,
      "detail": "Typed into this page. It was not read from a phone."
    }
  }]
}`;

function sourceLabel(kind: DayRecord["source"]["kind"]): string {
  if (kind === "android-usage-stats") return "Android usage stats";
  if (kind === "manual") return "Typed in";
  return "File";
}

export default function App() {
  const bridge = useMemo(() => readBridge(), []);
  const today = useMemo(() => civilDate(), []);
  const [document, setDocument] = useState<ScreenTimeDocument>(emptyDocument);
  const [ready, setReady] = useState(false);
  const [hold, setHold] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [deviceId, setDeviceId] = useState<string | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [shield, setShield] = useState(false);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const openToken = useRef(0);
  const ignoreCloseUntil = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const origin = useRef<{ x: number; y: number; id: number; captured: boolean } | null>(null);
  const lastSwipeAt = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = selected !== null || manualDate !== null || importState !== null || confirmDelete;

  useEffect(() => {
    if (SURFACE === "android") {
      if (!bridge) {
        setReady(true);
        return;
      }
      applySnapshot(bridge.snapshot());
      window.__screenTimeRefresh = () => applySnapshot(bridge.snapshot());
      const onVisible = () => {
        if (window.document.visibilityState === "visible") applySnapshot(bridge.snapshot());
      };
      window.document.addEventListener("visibilitychange", onVisible);
      setReady(true);
      return () => {
        delete window.__screenTimeRefresh;
        window.document.removeEventListener("visibilitychange", onVisible);
      };
    }
    const loaded = loadDocument(window.localStorage);
    if (!loaded.ok) {
      setHold(true);
      setLoadError("Saved screen time in this browser could not be read. Delete it to start again. It has not been changed.");
    } else {
      setDocument(loaded.document);
    }
    setReady(true);
    return undefined;
  }, [bridge]);

  useEffect(() => {
    if (!ready || hold || SURFACE !== "browser") return;
    const saved = saveDocument(window.localStorage, document);
    if (!saved.ok) {
      setLoadError(
        saved.reason === "quota"
          ? "This browser ran out of space for the saved screen time."
          : "The screen time could not be saved in this browser.",
      );
    }
  }, [document, ready, hold]);

  useEffect(() => {
    if (!open) return;
    const token = openToken.current;
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const timer = window.setTimeout(() => {
      if (openToken.current === token) setShield(false);
    }, SHIELD_MS);
    return () => {
      window.clearTimeout(timer);
      window.document.body.style.overflow = previous;
      restoreFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      stepDay(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, today]);

  const days = recordsFor(document, deviceId);
  const { year, name } = monthParts(month);
  const weeks = monthWeeks(month);
  const lines = connectionLines(SURFACE, document, new Date());
  const thisWeek = summarizeWeek(days, weekStart(today), today);
  const trend = recentWeeks(days, today);
  const selectedRecords = selected ? days.filter((day) => day.date === selected) : [];
  const selectedSummary = selected ? summarizeDay(selected, selectedRecords) : null;
  const canLeaveMonth = month > "2018-01";
  const atLatest = month >= today.slice(0, 7);

  function applySnapshot(raw: string) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const result = validateDocument(parsed, { maxDate: "2100-01-01" });
      if (!result.ok) {
        setLoadError("The phone returned screen time that failed the checks. Stored days were not replaced.");
        return;
      }
      setLoadError(null);
      setDocument(result.document);
    } catch {
      setLoadError("The phone returned data this page could not read.");
    }
  }

  function rememberFocus() {
    restoreFocus.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    ignoreCloseUntil.current = performance.now() + CLOSE_GUARD_MS;
    openToken.current += 1;
    setShield(true);
  }

  function openDay(iso: string) {
    if (performance.now() - lastSwipeAt.current < 500) return;
    if (iso > today) return;
    rememberFocus();
    setSelected(iso);
  }

  function closeIfSettled() {
    if (performance.now() < ignoreCloseUntil.current) return;
    setSelected(null);
    setManualDate(null);
    setImportState(null);
    setConfirmDelete(false);
  }

  function stepDay(delta: number) {
    if (!selected) return;
    const next = addDays(selected, delta);
    if (next < EARLIEST_DATE || next > today) return;
    setSelected(next);
    setMonth(next.slice(0, 7));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (open) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId, captured: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const start = origin.current;
    if (!start || start.id !== event.pointerId || start.captured) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      start.captured = true;
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = origin.current;
    origin.current = null;
    if (!start || start.id !== event.pointerId || open) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
    const now = performance.now();
    if (now - lastSwipeAt.current < 400) return;
    lastSwipeAt.current = now;
    setMonth((current) => {
      const next = shiftMonth(current, dx > 0 ? 1 : -1);
      if (next < "2018-01" || next > today.slice(0, 7)) return current;
      return next;
    });
  }

  async function onFile(file: File) {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setImportState({ kind: "invalid", name: file.name, issues: [{ path: "$", message: "The file is not JSON." }] });
      rememberFocus();
      return;
    }
    const result = validateDocument(parsed, { maxDate: today });
    if (!result.ok) {
      setImportState({ kind: "invalid", name: file.name, issues: result.issues });
      rememberFocus();
      return;
    }
    const incoming = withoutStatus(result.document);
    const preview = mergeDocuments(withoutStatus(document), incoming);
    if (!preview.ok) {
      setImportState({ kind: "invalid", name: file.name, issues: preview.issues });
      rememberFocus();
      return;
    }
    setImportState({
      kind: "ready",
      name: file.name,
      incoming,
      added: preview.added,
      replaced: preview.replaced,
      replacedKeys: preview.replacedKeys,
    });
    rememberFocus();
  }

  function commitImport() {
    if (!importState || importState.kind !== "ready") return;
    const preview = mergeDocuments(document, importState.incoming);
    if (!preview.ok) return;
    setDocument(preview.document);
    setNotice(
      preview.replaced > 0
        ? `Imported ${importState.name}. Added ${preview.added} and replaced ${preview.replaced}. Totals were not added together.`
        : `Imported ${importState.name}. Added ${preview.added}.`,
    );
    setImportState(null);
  }

  function commitManual(next: ScreenTimeDocument, replaced: boolean) {
    setDocument(next);
    setManualDate(null);
    setNotice(replaced ? "Replaced the day already stored for that device." : "Stored the day in this browser.");
  }

  function onExport() {
    if (bridge) {
      try {
        const parsed: unknown = JSON.parse(bridge.shareExport());
        const detail =
          parsed && typeof parsed === "object" && "detail" in parsed && typeof parsed.detail === "string"
            ? parsed.detail
            : "Android opened the share sheet. The file stays on this phone unless you send it.";
        const ok = parsed && typeof parsed === "object" && "ok" in parsed ? parsed.ok !== false : true;
        setNotice(ok ? detail : detail);
      } catch {
        setNotice("The export could not be shared.");
      }
      return;
    }
    const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "screentime.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Downloaded screentime.json. It stays in this browser as well.");
  }

  function onDelete() {
    if (bridge) {
      applySnapshot(bridge.deleteAll());
    } else {
      clearDocument(window.localStorage);
      setDocument(emptyDocument());
      setHold(false);
    }
    setConfirmDelete(false);
    setLoadError(null);
    setNotice("Stored screen time was deleted from this copy.");
  }

  const deviceOptions =
    document.devices.length > 1
      ? [{ value: "all" as const, label: "All" }, ...document.devices.map((device) => ({ value: device.id, label: device.label }))]
      : [];

  return (
    <>
      <main
        className="app"
        inert={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          origin.current = null;
        }}
      >
        <p className="kicker">Screen time</p>
        <h1 className="month-title">
          {name} <span className="year">{year}</span>
        </h1>
        <p className="month-line">{monthSummaryText(days, month)}</p>
        {deviceId === "all" && document.devices.length > 1 ? (
          <p className="month-line">All devices adds each device’s own total. Time on two phones at once counts on each.</p>
        ) : null}

        <div className="status" role="status">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {document.devices.length === 1 ? <p>Device: {document.devices[0].label}.</p> : null}
          {notice ? <p>{notice}</p> : null}
        </div>
        {loadError ? (
          <p className="alert" role="alert">
            {loadError}
          </p>
        ) : null}
        {SURFACE === "android" && !bridge ? (
          <p className="alert" role="alert">
            This build is the phone app’s page. Open it from the Screen time app, which supplies the usage reading. This window is not connected to a phone.
          </p>
        ) : null}

        <div className="toolbar">
          {deviceOptions.length > 0 ? (
            <div className="mode" role="group" aria-label="Which device">
              {deviceOptions.map((option) => (
                <button key={option.value} type="button" aria-pressed={deviceId === option.value} onClick={() => setDeviceId(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="nav" role="group" aria-label="Months">
            <button type="button" className="nav-btn" disabled={!canLeaveMonth} onClick={() => setMonth(shiftMonth(month, -1))}>
              Prev
            </button>
            <button type="button" className="nav-btn" disabled={atLatest} onClick={() => setMonth(shiftMonth(month, 1))}>
              Next
            </button>
            <button type="button" className="nav-btn" disabled={atLatest} onClick={() => setMonth(today.slice(0, 7))}>
              Latest
            </button>
          </div>
        </div>

        <div className="calendar" aria-label={`${name} ${year}`}>
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="weekday" aria-hidden="true">
              {weekday}
            </div>
          ))}
          <div className="weekday" aria-hidden="true">
            Sum
          </div>
          {weeks.map((week) => (
            <WeekCells
              key={week[0].iso}
              week={week}
              days={days}
              today={today}
              selected={selected}
              onOpen={openDay}
            />
          ))}
        </div>

        <div className="legend">
          <Legend swatch="is-low" label="Under 1 h" />
          <Legend swatch="is-mid" label="1 h to under 3 h" />
          <Legend swatch="is-high" label="3 h to under 5 h" />
          <Legend swatch="is-higher" label="5 h or more" />
          <Legend swatch="is-zero" label="Recorded 0" />
          <Legend swatch="is-apps" label="App time only" />
          <div className="legend-item">
            <span className="today-mark" aria-hidden="true">
              2
            </span>
            Today
          </div>
        </div>
        <p className="hint">An empty day has nothing stored. A zero was reported as zero. Tap a day for the apps.</p>

        <section className="stats" aria-label="This week">
          <div>
            <div className="stat-label">This week, Monday to Sunday</div>
            <div className="stat-value">{thisWeek.headlineMs === null ? "No total" : formatDuration(thisWeek.headlineMs)}</div>
          </div>
          <div>
            <div className="stat-label">Days with a device total</div>
            <div className="stat-value">
              {thisWeek.recordedDays} of {thisWeek.elapsedDays}
            </div>
          </div>
        </section>

        <section className="block" aria-label="Weeks">
          <h2>Weeks</h2>
          <p className="lead">
            Bars compare with 5 hours a day. The count beside a week says how many days had a device total. Missing days are left out of the sum.
          </p>
          {trend.length === 0 ? <p className="quiet">No weeks yet. A week appears here after a day is stored.</p> : null}
          <div className="weeks">
            {trend.map((week) => (
              <article className="week-row" key={week.start}>
                <div className="week-when">
                  {Number(week.start.slice(8))} {MONTHS_SHORT[Number(week.start.slice(5, 7)) - 1]} – {Number(week.end.slice(8))}{" "}
                  {MONTHS_SHORT[Number(week.end.slice(5, 7)) - 1]}
                </div>
                <div className="week-track" aria-hidden="true">
                  <div
                    className="week-fill"
                    style={{
                      width:
                        week.headlineMs === null || week.elapsedDays === 0
                          ? "0%"
                          : `${Math.min(100, (week.headlineMs / (week.elapsedDays * 5 * MS_HOUR)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="week-figure">
                  {week.headlineMs === null
                    ? `No screen total. 0 of ${week.elapsedDays} days recorded.`
                    : `${formatDuration(week.headlineMs)} over ${week.recordedDays} of ${week.elapsedDays} days${week.partial ? ", partial" : ""}.`}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="actions">
          {SURFACE === "android" && bridge ? (
            <>
              <button type="button" className="primary" onClick={() => applySnapshot(bridge.refresh())}>
                Refresh
              </button>
              {document.status?.usageAccess !== "granted" ? (
                <button type="button" className="action" onClick={() => bridge.openUsageAccess()}>
                  Allow usage access
                </button>
              ) : null}
            </>
          ) : null}
          {SURFACE === "browser" ? (
            <>
              <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
                Import a file
              </button>
              <button
                type="button"
                className="action"
                onClick={() => {
                  rememberFocus();
                  setManualDate(today);
                }}
              >
                Type a day
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                aria-label="Screen time JSON file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void onFile(file);
                }}
              />
            </>
          ) : null}
          <button type="button" className="action" disabled={document.days.length === 0} onClick={onExport}>
            Export
          </button>
          <button
            type="button"
            className="action"
            disabled={document.days.length === 0 && !hold}
            onClick={() => {
              rememberFocus();
              setConfirmDelete(true);
            }}
          >
            Delete
          </button>
        </div>

        <details className="notes">
          <summary>Where the numbers come from</summary>
          <div className="notes-body">
            <p>
              The colour is a device total: unlocked time when the Android reading has both screen and keyguard events, otherwise
              screen-interactive time, otherwise a number you typed. App foreground is listed beside it. On a Galaxy Fold, two apps can be
              resumed together, so the app list can add up to more than the device total. The list is not turned into the total.
            </p>
            <p>
              Screen interactive means Android reported the screen as interactive, which excludes an ambient display. It is a duration, not a
              count of times the screen came on. Unlocked and interactive is that duration while the keyguard was hidden.
            </p>
            <p>
              Hour rows appear only when the source had timestamps. A daily total is never split across the day. Query results that come back
              empty or unavailable stay empty. They are not stored as zero.
            </p>
            <p>
              The public page at /Grok/screen/ cannot see the phone. The Android app reads Usage access on the phone and shows this same
              calendar there. iPhone Screen Time is not read by either copy. An iPhone day can be typed, or brought in with a file.
            </p>
            <p>Times are milliseconds. 3,600,000 is one hour. This is the shape of a file, using an example phone, not a history.</p>
            <pre>{EXAMPLE}</pre>
          </div>
        </details>
      </main>

      {selected && selectedSummary ? (
        <Overlay shield={shield} onClose={closeIfSettled} dialogRef={dialogRef}>
          <DayDialog
            summaryDate={selected}
            today={today}
            records={selectedRecords}
            devices={document.devices}
            onClose={closeIfSettled}
            onStep={stepDay}
            onType={
              SURFACE === "browser"
                ? () => {
                    setSelected(null);
                    setManualDate(selected);
                  }
                : undefined
            }
          />
        </Overlay>
      ) : null}

      {manualDate ? (
        <Overlay shield={shield} onClose={closeIfSettled} dialogRef={dialogRef}>
          <ManualDialog
            initialDate={manualDate}
            today={today}
            document={document}
            onClose={closeIfSettled}
            onSave={commitManual}
          />
        </Overlay>
      ) : null}

      {importState ? (
        <Overlay shield={shield} onClose={closeIfSettled} dialogRef={dialogRef}>
          <ImportDialog state={importState} devices={document.devices} onClose={closeIfSettled} onConfirm={commitImport} />
        </Overlay>
      ) : null}

      {confirmDelete ? (
        <Overlay shield={shield} onClose={closeIfSettled} dialogRef={dialogRef}>
          <div className="dialog-head">
            <h2 id="day-title">Delete stored screen time</h2>
            <button type="button" className="icon-btn close" aria-label="Close" onClick={closeIfSettled}>
              ×
            </button>
          </div>
          <div className="dialog-body">
            <p>
              This removes the screen time kept by this copy. It does not change Digital Wellbeing, Screen Time, or the other app. Export
              first if you want a file.
            </p>
            <div className="dialog-buttons">
              <button type="button" className="action" onClick={closeIfSettled}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={onDelete}>
                Delete stored data
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}

type ImportState =
  | null
  | { kind: "invalid"; name: string; issues: Issue[] }
  | { kind: "ready"; name: string; incoming: ScreenTimeDocument; added: number; replaced: number; replacedKeys: string[] };

function Overlay({
  children,
  shield,
  onClose,
  dialogRef,
}: {
  children: ReactNode;
  shield: boolean;
  onClose: () => void;
  dialogRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="overlay">
      <div className="scrim" onClick={onClose} />
      <div className="dialog-slot">
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="day-title" tabIndex={-1} ref={dialogRef}>
          {children}
        </div>
      </div>
      {shield ? <div className="shield" aria-hidden="true" onClick={(event) => event.stopPropagation()} /> : null}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="legend-item">
      <span className={`swatch ${swatch}`} aria-hidden="true" />
      {label}
    </div>
  );
}

function WeekCells({
  week,
  days,
  today,
  selected,
  onOpen,
}: {
  week: { iso: string; inMonth: boolean }[];
  days: DayRecord[];
  today: string;
  selected: string | null;
  onOpen: (iso: string) => void;
}) {
  const summary = summarizeWeek(
    days.filter((day) => day.date >= week[0].iso && day.date <= addDays(week[0].iso, 6)),
    week[0].iso,
    today,
  );
  return (
    <>
      {week.map((cell) => {
        if (!cell.inMonth) return <div key={cell.iso} className="cell-empty" />;
        const daySummary = summarizeDay(
          cell.iso,
          days.filter((day) => day.date === cell.iso),
        );
        const future = cell.iso > today;
        const heat: Heat | "future" = future ? "future" : heatFor(daySummary);
        const dayNumber = Number(cell.iso.slice(8));
        if (future) {
          return (
            <div key={cell.iso} className="day-quiet" aria-hidden="true">
              <span className="date">{dayNumber}</span>
              <span className="count" />
              <span className="marks" />
            </div>
          );
        }
        const text =
          daySummary.headlineMs === null
            ? daySummary.foregroundMs === null
              ? ""
              : formatCompact(daySummary.foregroundMs)
            : daySummary.headlineMs === 0
              ? "0"
              : formatCompact(daySummary.headlineMs);
        return (
          <button
            key={cell.iso}
            type="button"
            className={["day", heat === "missing" ? "" : `is-${heat}`, selected === cell.iso ? "is-selected" : ""].filter(Boolean).join(" ")}
            aria-pressed={selected === cell.iso}
            aria-label={dayAria(daySummary, today)}
            data-date={cell.iso}
            onClick={() => onOpen(cell.iso)}
          >
            <span className={cell.iso === today ? "date is-today" : "date"}>{dayNumber}</span>
            <span className="count">{text}</span>
            <span className="marks">{daySummary.partial ? <span className="partial-dot" /> : null}</span>
          </button>
        );
      })}
      <div
        className={summary.headlineMs !== null && summary.elapsedDays > 0 ? "week-total has-some" : "week-total"}
        aria-label={weekLabel(summary)}
      >
        {summary.elapsedDays === 0 ? "" : summary.headlineMs === null ? "–" : formatCompact(summary.headlineMs)}
      </div>
    </>
  );
}

function weekLabel(summary: WeekSummary): string {
  if (summary.elapsedDays === 0) return "This week has not started";
  if (summary.headlineMs === null) return `No screen total. 0 of ${summary.elapsedDays} days recorded.`;
  return `${formatDuration(summary.headlineMs)} of screen time over ${summary.recordedDays} of ${summary.elapsedDays} days`;
}

function DayDialog({
  summaryDate,
  today,
  records,
  devices,
  onClose,
  onStep,
  onType,
}: {
  summaryDate: string;
  today: string;
  records: DayRecord[];
  devices: ScreenTimeDocument["devices"];
  onClose: () => void;
  onStep: (delta: number) => void;
  onType?: () => void;
}) {
  const { year, name } = monthParts(summaryDate.slice(0, 7));
  const summary = summarizeDay(summaryDate, records);
  const head = records.length === 1 ? headline(records[0]) : null;
  return (
    <>
      <div className="dialog-head">
        <h2 id="day-title">
          <span className="dialog-when">
            {WEEKDAYS_LONG[weekdayIndex(summaryDate)]}
            {summaryDate === today ? ", today" : ""}
          </span>
          <span className="dialog-date">
            {Number(summaryDate.slice(8))} {name} <span className="year">{year}</span>
          </span>
        </h2>
        <div className="dialog-actions">
          <button type="button" className="icon-btn" aria-label="Previous day" disabled={summaryDate <= EARLIEST_DATE} onClick={() => onStep(-1)}>
            ‹
          </button>
          <button type="button" className="icon-btn" aria-label="Next day" disabled={summaryDate >= today} onClick={() => onStep(1)}>
            ›
          </button>
          <button type="button" className="icon-btn close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className="dialog-body">
        {summary.headlineMs === null && summary.foregroundMs === null ? (
          <p className="quiet">Nothing stored for this day. An empty day is not a zero.</p>
        ) : null}
        {summary.headlineMs !== null ? (
          <div className="score-line">
            <span className={summary.headlineMs === 0 ? "score is-zero" : "score"}>{formatDuration(summary.headlineMs)}</span>
            <span className="score-caption">
              {head ? basisLabel(head.basis ?? "typed").toLowerCase() : "screen time, summed across devices"}
              {summary.partial ? ", partial" : ""}
              {summary.headlineMs === 0 ? ", recorded zero" : ""}
            </span>
          </div>
        ) : null}
        {summary.headlineMs === null && summary.foregroundMs !== null ? (
          <p>No device screen total. App foreground {formatDuration(summary.foregroundMs)} is stored separately.</p>
        ) : null}
        {records.map((record) => (
          <DayRecordBody key={`${record.deviceId}-${record.source.recordedAt}`} record={record} devices={devices} />
        ))}
        {onType ? (
          <div className="dialog-buttons">
            <button type="button" className="action" onClick={onType}>
              Type this day
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function DayRecordBody({ record, devices }: { record: DayRecord; devices: ScreenTimeDocument["devices"] }) {
  const device = devices.find((item) => item.id === record.deviceId);
  const longest = record.apps ? Math.max(...record.apps.map((app) => app.foregroundMs)) : 0;
  const hours = record.hours ? [...record.hours].sort((a, b) => a.hour - b.hour) : [];
  return (
    <section>
      <div className="facts">
        <div>
          <div className="fact-label">Device</div>
          <div className="fact-value">{device?.label ?? record.deviceId}</div>
        </div>
        <div>
          <div className="fact-label">Source</div>
          <div className="fact-value">{sourceLabel(record.source.kind)}</div>
        </div>
        {record.screenInteractiveMs !== undefined ? (
          <div>
            <div className="fact-label">Screen interactive</div>
            <div className="fact-value">{formatDuration(record.screenInteractiveMs)}</div>
          </div>
        ) : null}
        {record.unlockedInteractiveMs !== undefined ? (
          <div>
            <div className="fact-label">Unlocked and interactive</div>
            <div className="fact-value">{formatDuration(record.unlockedInteractiveMs)}</div>
          </div>
        ) : null}
      </div>
      <p className="quiet" style={{ marginTop: 10 }}>
        {record.source.name}. Recorded {formatWhen(record.source.recordedAt)}.
        {record.deviceTotal ? ` ${record.deviceTotal.detail}` : ""}
      </p>
      {record.apps && record.appsNote ? (
        <>
          <div className="block-label">{record.apps.length === 1 ? "1 app" : `${record.apps.length} apps`}</div>
          <p className="quiet">{record.appsNote.detail}</p>
          {[...record.apps]
            .sort((a, b) => b.foregroundMs - a.foregroundMs)
            .map((app) => (
              <div className="app-row" key={app.id}>
                <div className="app-top">
                  <span className="app-name">{app.label}</span>
                  <span className="row-meta">{formatDuration(app.foregroundMs)}</span>
                </div>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: longest > 0 ? `${(app.foregroundMs / longest) * 100}%` : "0%" }} />
                </div>
                {app.visibleMs !== undefined ? <p className="row-meta">Visible {formatDuration(app.visibleMs)}</p> : null}
              </div>
            ))}
        </>
      ) : null}
      {hours.length > 0 ? (
        <>
          <div className="block-label">Hours, Australia/Sydney</div>
          <p className="quiet">Listed hours were in the source. An hour that is absent was not recorded. A zero was recorded as zero.</p>
          {hours.map((hour) => (
            <div className="hour-row" key={hour.hour}>
              <div className="hour-top">
                <span className="app-name">
                  {String(hour.hour).padStart(2, "0")}:00{hour.partial ? ", partial" : ""}
                </span>
                <span className="row-meta">
                  {hour.unlockedInteractiveMs !== undefined
                    ? formatDuration(hour.unlockedInteractiveMs)
                    : hour.screenInteractiveMs !== undefined
                      ? formatDuration(hour.screenInteractiveMs)
                      : "Apps only"}
                </span>
              </div>
            </div>
          ))}
        </>
      ) : record.deviceTotal ? (
        <p className="quiet" style={{ marginTop: 12 }}>
          No hour timeline for this day. The daily total was not split into hours.
        </p>
      ) : null}
    </section>
  );
}

function ManualDialog({
  initialDate,
  today,
  document,
  onClose,
  onSave,
}: {
  initialDate: string;
  today: string;
  document: ScreenTimeDocument;
  onClose: () => void;
  onSave: (next: ScreenTimeDocument, replaced: boolean) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [deviceId, setDeviceId] = useState(document.devices[0]?.id ?? "new");
  const [label, setLabel] = useState("");
  const [platform, setPlatform] = useState<Platform>("android");
  const [recordTotal, setRecordTotal] = useState(true);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [apps, setApps] = useState<{ label: string; hours: string; minutes: string }[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);

  function save() {
    const nextIssues: Issue[] = [];
    if (recordTotal && (hours.trim() === "" || minutes.trim() === "")) {
      nextIssues.push({ path: "hours", message: "Enter hours and minutes. Use 0 and 0 only when the source showed zero." });
    }
    if (nextIssues.length > 0) {
      setIssues(nextIssues);
      return;
    }
    const result = insertManual(
      document,
      {
        date,
        deviceId,
        deviceLabel: label,
        platform,
        creatingDevice: deviceId === "new",
        recordTotal,
        hours: Number(hours || "0"),
        minutes: Number(minutes || "0"),
        apps: apps.map((app) => ({ label: app.label, hours: Number(app.hours || "0"), minutes: Number(app.minutes || "0") })),
        recordedAt: new Date().toISOString(),
      },
      today,
    );
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    onSave(result.document, result.replaced);
  }

  return (
    <>
      <div className="dialog-head">
        <h2 id="day-title">Type a day</h2>
        <button type="button" className="icon-btn close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="dialog-body">
        <p className="quiet">Typed into this page. It is not read from a phone. The same date and device replaces a stored day.</p>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} min={EARLIEST_DATE} max={today} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Device</span>
          <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
            {document.devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
            <option value="new">New device</option>
          </select>
        </label>
        {deviceId === "new" ? (
          <>
            <label className="field">
              <span>Device name</span>
              <input value={label} onChange={(event) => setLabel(event.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              <span>Kind</span>
              <select value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}>
                <option value="android">Android phone</option>
                <option value="ios">iPhone</option>
                <option value="other">Other</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="check">
          <input type="checkbox" checked={recordTotal} onChange={(event) => setRecordTotal(event.target.checked)} />
          <span>Record a screen total. Unchecked leaves the total out. It does not store zero.</span>
        </label>
        {recordTotal ? (
          <div className="pair">
            <label className="field">
              <span>Hours</span>
              <input inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} />
            </label>
            <label className="field">
              <span>Minutes</span>
              <input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
            </label>
          </div>
        ) : null}
        <div className="block-label">Apps, optional</div>
        {apps.map((app, index) => (
          <div className="stack" key={index}>
            <label className="field">
              <span>App name</span>
              <input
                value={app.label}
                onChange={(event) => setApps((rows) => rows.map((row, i) => (i === index ? { ...row, label: event.target.value } : row)))}
              />
            </label>
            <div className="pair">
              <label className="field">
                <span>Hours</span>
                <input
                  inputMode="numeric"
                  value={app.hours}
                  onChange={(event) => setApps((rows) => rows.map((row, i) => (i === index ? { ...row, hours: event.target.value } : row)))}
                />
              </label>
              <label className="field">
                <span>Minutes</span>
                <input
                  inputMode="numeric"
                  value={app.minutes}
                  onChange={(event) => setApps((rows) => rows.map((row, i) => (i === index ? { ...row, minutes: event.target.value } : row)))}
                />
              </label>
            </div>
            <button type="button" className="action" onClick={() => setApps((rows) => rows.filter((_, i) => i !== index))}>
              Remove app
            </button>
          </div>
        ))}
        <div className="dialog-buttons">
          <button type="button" className="action" onClick={() => setApps((rows) => rows.concat({ label: "", hours: "", minutes: "" }))}>
            Add an app
          </button>
        </div>
        {issues.length > 0 ? (
          <ul className="issues" role="alert">
            {issues.slice(0, 8).map((issue) => (
              <li className="issue" key={`${issue.path}-${issue.message}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="dialog-buttons">
          <button type="button" className="primary" onClick={save}>
            Save day
          </button>
          <button type="button" className="action" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

function ImportDialog({
  state,
  devices,
  onClose,
  onConfirm,
}: {
  state: Exclude<ImportState, null>;
  devices: ScreenTimeDocument["devices"];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const labels = new Map(devices.map((device) => [device.id, device.label]));
  return (
    <>
      <div className="dialog-head">
        <h2 id="day-title">{state.kind === "ready" ? "Import this file" : "This file was not imported"}</h2>
        <button type="button" className="icon-btn close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="dialog-body">
        <p className="quiet">{state.name} is read in this browser. It is not uploaded.</p>
        {state.kind === "invalid" ? (
          <ul className="issues" role="alert">
            {state.issues.slice(0, 8).map((issue) => (
              <li className="issue" key={`${issue.path}-${issue.message}`}>
                {issue.path}: {issue.message}
              </li>
            ))}
            {state.issues.length > 8 ? <li className="issue">{state.issues.length - 8} more.</li> : null}
          </ul>
        ) : (
          <>
            <p style={{ marginTop: 12 }}>
              Add {state.added}. Replace {state.replaced}. A replaced day overwrites the stored one. The two totals are not added.
            </p>
            {state.replacedKeys.length > 0 ? (
              <ul className="issues">
                {state.replacedKeys.slice(0, 6).map((key) => {
                  const [date, id] = key.split("|");
                  return (
                    <li className="issue" key={key}>
                      {date} · {labels.get(id) ?? id}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
        <div className="dialog-buttons">
          {state.kind === "ready" ? (
            <button type="button" className="primary" onClick={onConfirm}>
              Import
            </button>
          ) : null}
          <button type="button" className="action" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
