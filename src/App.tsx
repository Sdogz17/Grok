import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DAYS, GOAL, type StudyDay } from "./data/days";
import {
  MONTH_NAMES,
  WEEKDAYS,
  WEEKDAYS_LONG,
  dayLabel,
  indexDays,
  isoDate,
  monthCells,
  monthParts,
  monthSummary,
  monthSummaryText,
  shiftMonth,
  studyStats,
  todayIso,
  weekdayIndex,
} from "./lib/calendar";

// A tap that opens the dialog is followed, on some Android Chromes, by a
// second click on whatever now sits under the finger. On a short day that
// target is the scrim, so the dialog vanished at once. The shield swallows
// that ghost event. The timer is a second guard for anything that lands late.
const SHIELD_MS = 600;
const CLOSE_GUARD_MS = 800;
const SWIPE_PX = 48;

function toneClass(day: StudyDay | undefined): string {
  if (!day || day.count <= 0) return "";
  return day.count >= GOAL ? "is-met" : "is-under";
}

export default function App() {
  const byDate = useMemo(() => indexDays(DAYS), []);
  const stats = useMemo(() => studyStats(DAYS), []);
  const today = useMemo(() => todayIso(), []);
  const [month, setMonth] = useState(stats.latestMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const [shield, setShield] = useState(false);
  const openToken = useRef(0);
  const ignoreCloseUntil = useRef(0);
  const origin = useRef<{ x: number; y: number; id: number; captured: boolean } | null>(null);
  const lastSwipeAt = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const open = selected !== null;
  const { year, name } = monthParts(month);
  const cells = monthCells(month);
  const summary = monthSummary(DAYS, month);
  const selectedDay = selected ? byDate.get(selected) : undefined;

  useEffect(() => {
    if (!open) return;
    const token = openToken.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const shieldTimer = window.setTimeout(() => {
      if (openToken.current === token) setShield(false);
    }, SHIELD_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(shieldTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus();
    };
  }, [open, selected]);

  function openDay(iso: string) {
    if (performance.now() - lastSwipeAt.current < 500) return;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ignoreCloseUntil.current = performance.now() + CLOSE_GUARD_MS;
    openToken.current += 1;
    setShield(true);
    setSelected(iso);
  }

  function closeIfSettled() {
    if (performance.now() < ignoreCloseUntil.current) return;
    setSelected(null);
  }

  function swallow(event: { preventDefault(): void; stopPropagation(): void }) {
    event.preventDefault();
    event.stopPropagation();
  }

  function goTo(next: string) {
    setMonth(next);
    setSelected(null);
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
    // Finger moves right: next month. Finger moves left: previous month.
    setMonth((current) => shiftMonth(current, dx > 0 ? 1 : -1));
  }

  const selectedParts = selected ? monthParts(selected.slice(0, 7)) : null;
  const selectedWeekday = selected ? WEEKDAYS_LONG[weekdayIndex(selected)] : "";
  const selectedDayNumber = selected ? Number(selected.slice(8)) : 0;

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
        <div className="month-head">
          <div>
            <h1 className="month-title">
              {name} <span className="year">{year}</span>
            </h1>
            <p className="month-line">{monthSummaryText(summary.words, summary.days)}</p>
          </div>
          <div className="nav" role="group" aria-label="Months">
            <button type="button" className="nav-btn" onClick={() => goTo(shiftMonth(month, -1))}>
              Prev
            </button>
            <button type="button" className="nav-btn" onClick={() => goTo(shiftMonth(month, 1))}>
              Next
            </button>
            <button
              type="button"
              className="nav-btn"
              disabled={month === stats.latestMonth}
              onClick={() => goTo(stats.latestMonth)}
            >
              Latest
            </button>
          </div>
        </div>

        <div className="grid" aria-label={`${name} ${year}`}>
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="weekday" aria-hidden="true">
              {weekday}
            </div>
          ))}
          {cells.map((dayNumber, index) => {
            if (dayNumber === null) return <div key={`empty-${index}`} />;
            const iso = isoDate(month, dayNumber);
            const record = byDate.get(iso);
            const tone = toneClass(record);
            const isToday = iso === today;
            const isSelected = open && selected === iso;
            return (
              <button
                key={iso}
                type="button"
                className={["day", tone, isSelected ? "is-selected" : ""].filter(Boolean).join(" ")}
                aria-pressed={isSelected}
                aria-label={dayLabel(iso, today, record ? record.count : null)}
                data-date={iso}
                onClick={() => openDay(iso)}
              >
                <span className={isToday ? "date is-today" : "date"}>{dayNumber}</span>
                {record && record.count > 0 ? <span className="count">{record.count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="legend">
          <div className="legend-item">
            <span className="swatch met" aria-hidden="true" />
            {GOAL} or more
          </div>
          <div className="legend-item">
            <span className="swatch under" aria-hidden="true" />
            1–{GOAL - 1}
          </div>
          <div className="legend-item">
            <span className="today-mark" aria-hidden="true">
              2
            </span>
            Today
          </div>
        </div>
        <p className="hint">Swipe right for the next month, left for the previous.</p>

        <section className="stats" aria-label="All months">
          <div className="stat">
            <div className="stat-label">Words, all time</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Study days</div>
            <div className="stat-value">{stats.days}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Days at {GOAL}</div>
            <div className="stat-value">{stats.greens}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Current streak</div>
            <div className="stat-value">{stats.streak}</div>
          </div>
        </section>
      </main>

      {open && selected && selectedParts ? (
        <div className="overlay">
          <div className="scrim" onClick={closeIfSettled} />
          <div className="dialog-slot">
            <div
              className="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="day-title"
              tabIndex={-1}
              ref={dialogRef}
            >
              <div className="dialog-head">
                <h2 id="day-title">
                  {selectedWeekday} {selectedDayNumber} {MONTH_NAMES[selectedParts.month - 1]}{" "}
                  <span className="year">{selectedParts.year}</span>
                </h2>
                <button type="button" className="close" aria-label="Close" onClick={closeIfSettled}>
                  ×
                </button>
              </div>
              <div className="dialog-body">
                <div className="tally">
                  <span className="tally-num">{selectedDay ? selectedDay.count : 0}</span>
                  <span className="tally-of">of {GOAL} words</span>
                </div>
                {selectedDay ? (
                  <>
                    <p className="summary">{selectedDay.summary}</p>
                    {selectedDay.grammar.length > 0 ? (
                      <>
                        <div className="block-label">Grammar & phrases</div>
                        <ul className="grammar">
                          {selectedDay.grammar.map((line, index) => (
                            <li key={`${line}-${index}`}>{line}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {selectedDay.words.length > 0 ? (
                      <>
                        <div className="block-label">
                          {selectedDay.words.length === 1 ? "1 word" : `${selectedDay.words.length} words`}
                        </div>
                        <ul className="words">
                          {selectedDay.words.map((word, index) => (
                            <li className="word" key={`${word.pinyin}-${index}`}>
                              <span className="pinyin" lang="zh-Latn">
                                {word.pinyin}
                              </span>
                              <span className="meaning">{word.meaning}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className="empty">No study logged for this day.</p>
                )}
              </div>
            </div>
          </div>
          {shield ? (
            <div className="shield" aria-hidden="true" onClick={swallow} onPointerUp={swallow} onTouchEnd={swallow} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
