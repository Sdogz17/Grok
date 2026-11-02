import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  DIET_LOG,
  LIFT_GOAL,
  LIFT_GOAL_SET,
  PROTEIN_MAX,
  PROTEIN_MIN,
  PULLED,
  SLEEP_LOG,
  SLEEP_PULLED,
  TARGET_KCAL,
  TODAY_ISO,
  WORKOUTS,
  type DietDay,
  type SleepDay,
  type Workout,
} from "./data/log";
import {
  WEEKDAYS,
  WEEKDAYS_LONG,
  buildLiftWeeks,
  daysLeftInWeek,
  firstLoggedIso,
  formatHours,
  formatNumber,
  inRange,
  liftCountOn,
  liftsInWeek,
  metricValue,
  monthLine,
  monthParts,
  monthWeeks,
  shiftMonth,
  shortDate,
  sleepStreaks,
  sportLabel,
  tierFor,
  tierWord,
  walkedOn,
  weekRun,
  weekdayIndex,
  addDays,
  type Metric,
  type Tier,
} from "./lib/calendar";

// A tap that opens the dialog is followed, on some Android Chromes, by a
// second click on whatever now sits under the finger. On a short day that
// target is the scrim, so the dialog vanished at once. The shield swallows
// that ghost event. The timer is a second guard for anything that lands late.
const SHIELD_MS = 600;
const CLOSE_GUARD_MS = 800;
const RECENT = 8;

const FIRST_ISO = firstLoggedIso(SLEEP_LOG, WORKOUTS);
const MIN_MONTH = FIRST_ISO.slice(0, 7);
const MAX_MONTH = TODAY_ISO.slice(0, 7);

function LiftMark() {
  return (
    <svg className="lift-mark" viewBox="0 0 16 10" width="16" height="10" fill="currentColor" aria-hidden="true">
      <rect x="0" y="2.4" width="2.2" height="5.2" />
      <rect x="2.3" y="0" width="3.3" height="10" />
      <rect x="5.2" y="4" width="5.6" height="2" />
      <rect x="10.4" y="0" width="3.3" height="10" />
      <rect x="13.8" y="2.4" width="2.2" height="5.2" />
    </svg>
  );
}

function ModeSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="mode" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function dayAria(iso: string, metric: Metric, day: SleepDay | undefined, lifts: number, walked: boolean): string {
  const { year, name } = monthParts(iso.slice(0, 7));
  const when = `${WEEKDAYS_LONG[weekdayIndex(iso)]} ${Number(iso.slice(8))} ${name} ${year}`;
  const value = metricValue(metric, day);
  const tier = tierFor(metric, value);
  const score =
    value === null || !tier
      ? metric === "sleep"
        ? "no sleep score"
        : "no recovery score"
      : `${metric} ${Math.round(value)}%, ${tierWord(tier).toLowerCase()}`;
  const parts = [when];
  if (iso === TODAY_ISO) parts.push("today");
  parts.push(score);
  if (lifts > 0) parts.push(lifts === 1 ? "lift" : `${lifts} lifts`);
  if (walked) parts.push("walk");
  return parts.join(", ");
}

function DayDialog({
  iso,
  sleep,
  sessions,
  diets,
  dialogRef,
  onClose,
  onStep,
}: {
  iso: string;
  sleep: SleepDay | undefined;
  sessions: Workout[];
  diets: DietDay[];
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const { year, name } = monthParts(iso.slice(0, 7));
  const sleepTier = sleep ? tierFor("sleep", sleep.perf) : null;
  const recoveryTier = sleep ? tierFor("recovery", sleep.recovery) : null;
  const facts: { label: string; value: string; tier: Tier | null }[] = [];
  if (sleep) {
    if (sleep.hours !== null) facts.push({ label: "Asleep", value: formatHours(sleep.hours), tier: null });
    if (sleep.bed !== null && sleep.wake !== null) {
      facts.push({ label: "Bed to wake", value: `${sleep.bed} – ${sleep.wake}`, tier: null });
    }
    if (sleep.recovery !== null) {
      facts.push({ label: "Recovery", value: `${sleep.recovery}%`, tier: recoveryTier });
    }
    if (sleep.hrv !== null) facts.push({ label: "HRV", value: `${sleep.hrv.toFixed(1)} ms`, tier: null });
    if (sleep.rhr !== null) facts.push({ label: "Resting HR", value: `${sleep.rhr} bpm`, tier: null });
    if (sleep.strain !== null) facts.push({ label: "Day strain", value: sleep.strain.toFixed(1), tier: null });
  }
  const nothing = !sleep && sessions.length === 0 && diets.length === 0;

  return (
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
          <span className="dialog-when">
            {WEEKDAYS_LONG[weekdayIndex(iso)]}
            {iso === TODAY_ISO ? ", today" : ""}
          </span>
          <span className="dialog-date">
            {Number(iso.slice(8))} {name} <span className="year">{year}</span>
          </span>
        </h2>
        <div className="dialog-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous day"
            disabled={iso <= FIRST_ISO}
            onClick={() => onStep(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Next day"
            disabled={iso >= TODAY_ISO}
            onClick={() => onStep(1)}
          >
            ›
          </button>
          <button type="button" className="icon-btn close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className="dialog-body">
        {sleep && sleep.perf !== null && sleepTier ? (
          <div className="score-line">
            <span className={`score is-${sleepTier}`}>{sleep.perf}%</span>
            <span className="score-caption">
              sleep performance, <span className={`is-${sleepTier}`}>{tierWord(sleepTier)}</span>
            </span>
          </div>
        ) : null}
        {sleep && sleep.perf === null ? <p className="empty">No scored sleep for this day.</p> : null}
        {nothing ? <p className="empty">Nothing logged for this day.</p> : null}
        {facts.length > 0 ? (
          <div className="facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <div className="fact-label">{fact.label}</div>
                <div className={fact.tier ? `fact-value is-${fact.tier}` : "fact-value"}>{fact.value}</div>
              </div>
            ))}
          </div>
        ) : null}
        {sessions.length > 0 ? (
          <>
            <div className="block-label">{sessions.length === 1 ? "1 workout" : `${sessions.length} workouts`}</div>
            {sessions.map((session) => (
              <div className="session" key={`${session.time}-${session.sport}-${session.mins}`}>
                <div className="session-top">
                  <span className="session-time">{session.time}</span>
                  <span className="session-name">
                    {session.sport === "weightlifting" ? <LiftMark /> : null}
                    {sportLabel(session.sport)}
                  </span>
                  <span className="session-mins">{session.mins} min</span>
                </div>
                <p className="session-meta">
                  Strain {session.strain.toFixed(1)}, {session.kcal} kcal, avg HR {session.avg}, max {session.max}
                </p>
                {session.notes ? <p className="session-notes">{session.notes}</p> : null}
              </div>
            ))}
          </>
        ) : null}
        {diets.map((diet) => (
          <div key={diet.iso}>
            <div className="block-label">Food, estimated</div>
            <p className="diet-total">
              <span className="diet-num">{formatNumber(diet.kcal)} kcal</span>
              <span className="diet-target">target {formatNumber(TARGET_KCAL)}</span>
            </p>
            <p className="diet-total">
              <span className={diet.protein >= PROTEIN_MIN ? "diet-num is-good" : "diet-num is-poor"}>
                {diet.protein} g protein
              </span>
              <span className="diet-target">
                target {PROTEIN_MIN}–{PROTEIN_MAX} g
              </span>
            </p>
            <p className="diet-quiet">
              {diet.carbs} g carbs, {diet.fat} g fat
              {diet.burned !== null ? `. Whoop recorded ${formatNumber(diet.burned)} kcal burned` : ""}
            </p>
            <ul className="items">
              {diet.items.map((item, index) => (
                <li className="item" key={`${diet.iso}-${index}`}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const sleepByIso = useMemo(() => {
    const map = new Map<string, SleepDay>();
    for (const day of SLEEP_LOG) map.set(day.iso, day);
    return map;
  }, []);
  const liftWeeks = useMemo(() => buildLiftWeeks(WORKOUTS, TODAY_ISO), []);
  const streaks = useMemo(() => sleepStreaks(SLEEP_LOG, TODAY_ISO, FIRST_ISO), []);
  const thisWeek = liftWeeks.length > 0 ? liftWeeks[liftWeeks.length - 1].count : 0;
  const daysLeft = daysLeftInWeek(TODAY_ISO);

  const [month, setMonth] = useState(MAX_MONTH);
  const [metric, setMetric] = useState<Metric>("sleep");
  const [selected, setSelected] = useState<string | null>(null);
  const [shield, setShield] = useState(false);
  const [showLifts, setShowLifts] = useState(false);
  const [showWorkouts, setShowWorkouts] = useState(false);
  const [sport, setSport] = useState<"all" | "weightlifting" | "walking">("all");
  const [dietIso, setDietIso] = useState(DIET_LOG[0]?.iso ?? "");
  const openToken = useRef(0);
  const ignoreCloseUntil = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const open = selected !== null;
  const { year, name } = monthParts(month);
  const weeks = monthWeeks(month);
  const lifts = useMemo(() => WORKOUTS.filter((workout) => workout.sport === "weightlifting"), []);
  const shownWorkouts = WORKOUTS.filter((workout) => sport === "all" || workout.sport === sport);
  const diet = DIET_LOG.find((day) => day.iso === dietIso) ?? DIET_LOG[0];
  const bands =
    metric === "sleep"
      ? [
          { tier: "good" as const, name: "85% or more" },
          { tier: "ok" as const, name: "70 to 84%" },
          { tier: "poor" as const, name: "Under 70%" },
        ]
      : [
          { tier: "good" as const, name: "67% or more" },
          { tier: "ok" as const, name: "34 to 66%" },
          { tier: "poor" as const, name: "Under 34%" },
        ];

  useEffect(() => {
    if (!open) return;
    const token = openToken.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const shieldTimer = window.setTimeout(() => {
      if (openToken.current === token) setShield(false);
    }, SHIELD_MS);
    return () => {
      window.clearTimeout(shieldTimer);
      document.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next = addDays(selected, event.key === "ArrowLeft" ? -1 : 1);
      if (!inRange(next, FIRST_ISO, TODAY_ISO)) return;
      setSelected(next);
      setMonth(next.slice(0, 7));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected]);

  useEffect(() => {
    if (open) dialogRef.current?.scrollTo(0, 0);
  }, [open, selected]);

  function openDay(iso: string) {
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

  function stepDay(delta: number) {
    if (!selected) return;
    const next = addDays(selected, delta);
    if (!inRange(next, FIRST_ISO, TODAY_ISO)) return;
    setSelected(next);
    setMonth(next.slice(0, 7));
  }

  function swallow(event: { preventDefault(): void; stopPropagation(): void }) {
    event.preventDefault();
    event.stopPropagation();
  }

  const selectedSleep = selected ? sleepByIso.get(selected) : undefined;
  const selectedSessions = selected
    ? WORKOUTS.filter((workout) => workout.iso === selected)
        .slice()
        .sort((a, b) => a.time.localeCompare(b.time))
    : [];
  const selectedDiets = selected ? DIET_LOG.filter((day) => day.iso === selected) : [];
  const visibleLifts = showLifts ? lifts : lifts.slice(0, RECENT);
  const visibleWorkouts = showWorkouts ? shownWorkouts : shownWorkouts.slice(0, RECENT);

  return (
    <>
      <main className="app" inert={open}>
        <h1 className="month-title">
          {name} <span className="year">{year}</span>
        </h1>
        <p className="month-line">{monthLine(month, metric, SLEEP_LOG)}</p>

        <div className="toolbar">
          <ModeSwitch
            label="Colour the days by"
            value={metric}
            options={[
              { value: "sleep", label: "Sleep" },
              { value: "recovery", label: "Recovery" },
            ]}
            onChange={setMetric}
          />
          <div className="nav" role="group" aria-label="Months">
            <button type="button" className="nav-btn" disabled={month <= MIN_MONTH} onClick={() => setMonth(shiftMonth(month, -1))}>
              Prev
            </button>
            <button type="button" className="nav-btn" disabled={month >= MAX_MONTH} onClick={() => setMonth(shiftMonth(month, 1))}>
              Next
            </button>
            <button type="button" className="nav-btn" disabled={month === MAX_MONTH} onClick={() => setMonth(MAX_MONTH)}>
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
            Lifts
          </div>
          {weeks.map((week) => {
            const count = liftsInWeek(WORKOUTS, week[0].iso);
            const weekEnd = addDays(week[0].iso, 6);
            const counted = week[0].iso <= TODAY_ISO && weekEnd >= FIRST_ISO;
            return (
              <WeekRow
                key={week[0].iso}
                week={week}
                count={count}
                counted={counted}
                metric={metric}
                today={TODAY_ISO}
                selected={selected}
                sleepByIso={sleepByIso}
                onOpen={openDay}
              />
            );
          })}
        </div>

        <div className="legend">
          {bands.map((band) => (
            <div className="legend-item" key={band.name}>
              <span className={`swatch is-${band.tier}`} aria-hidden="true" />
              {band.name}
            </div>
          ))}
          <div className="legend-item">
            <LiftMark />
            Lift
          </div>
          <div className="legend-item">
            <span className="walk-mark" aria-hidden="true" />
            Walk
          </div>
          <div className="legend-item">
            <span className="today-mark" aria-hidden="true">
              2
            </span>
            Today
          </div>
        </div>
        <p className="hint">Tap a day for sleep, training and food.</p>

        <section className="stats" aria-label="Streaks">
          <div className="stat">
            <div className="stat-label">
              Lifts this week, {daysLeft} {daysLeft === 1 ? "day" : "days"} left
            </div>
            <div className="stat-value">
              {thisWeek}/{LIFT_GOAL}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Weeks in a row with a lift</div>
            <div className="stat-value">{weekRun(liftWeeks, 1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Weeks at {LIFT_GOAL} lifts</div>
            <div className="stat-value">{weekRun(liftWeeks, LIFT_GOAL)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Nights at 85% or more, best {streaks.best}</div>
            <div className="stat-value">{streaks.current}</div>
          </div>
        </section>

        <section className="block" aria-label="Lifting">
          <h2>Lifting</h2>
          <p className="lead">
            {lifts.length} sessions, newest first. Goal of {LIFT_GOAL} a week, set {LIFT_GOAL_SET}.
          </p>
          <div className="rows">
            {visibleLifts.map((workout) => (
              <article className="row" key={`${workout.iso}-${workout.time}-${workout.mins}`}>
                <div className="row-top">
                  <span className="row-when">
                    {shortDate(workout.iso)}, {workout.time}
                  </span>
                  <span className="row-mins">{workout.mins} min</span>
                </div>
                <p className="row-meta">
                  Strain {workout.strain.toFixed(1)}, {workout.kcal} kcal, HR {workout.avg}–{workout.max}
                </p>
                {workout.notes ? <p className="session-notes">{workout.notes}</p> : null}
              </article>
            ))}
          </div>
          {lifts.length > RECENT ? (
            <button type="button" className="more" onClick={() => setShowLifts((value) => !value)}>
              {showLifts ? `Show the latest ${RECENT}` : `Show all ${lifts.length}`}
            </button>
          ) : null}
        </section>

        <section className="block" aria-label="Workouts">
          <h2>Workouts</h2>
          <p className="lead">
            {sport === "all"
              ? `${shownWorkouts.length} sessions`
              : `${shownWorkouts.length} ${sport === "weightlifting" ? "lifting" : "walking"} ${shownWorkouts.length === 1 ? "session" : "sessions"}`}
          </p>
          <ModeSwitch
            label="Which workouts"
            value={sport}
            options={[
              { value: "all", label: "All" },
              { value: "weightlifting", label: "Lifting" },
              { value: "walking", label: "Walking" },
            ]}
            onChange={(value) => {
              setSport(value);
              setShowWorkouts(false);
            }}
          />
          <div className="rows">
            {visibleWorkouts.map((workout) => (
              <article className="row" key={`${workout.iso}-${workout.time}-${workout.sport}-${workout.mins}`}>
                <div className="row-top">
                  <span className="row-when">
                    {shortDate(workout.iso)}, {workout.time}
                  </span>
                  <span className="row-mins">{workout.mins} min</span>
                </div>
                <p className="row-meta">
                  {sportLabel(workout.sport)}, strain {workout.strain.toFixed(1)}, {workout.kcal} kcal, HR {workout.avg}–
                  {workout.max}
                </p>
              </article>
            ))}
          </div>
          {shownWorkouts.length > RECENT ? (
            <button type="button" className="more" onClick={() => setShowWorkouts((value) => !value)}>
              {showWorkouts ? `Show the latest ${RECENT}` : `Show all ${shownWorkouts.length}`}
            </button>
          ) : null}
        </section>

        {diet ? (
          <section className="block" aria-label="Diet">
            <h2>Diet</h2>
            <p className="lead">
              Fully logged days. Targets are {formatNumber(TARGET_KCAL)} kcal and {PROTEIN_MIN}–{PROTEIN_MAX} g protein.
            </p>
            <ModeSwitch
              label="Which day"
              value={diet.iso}
              options={DIET_LOG.map((day) => ({ value: day.iso, label: shortDate(day.iso) }))}
              onChange={setDietIso}
            />
            <p className="diet-total">
              <span className="diet-num">{formatNumber(diet.kcal)} kcal</span>
              <span className="diet-target">target {formatNumber(TARGET_KCAL)}</span>
            </p>
            <p className="diet-total">
              <span className={diet.protein >= PROTEIN_MIN ? "diet-num is-good" : "diet-num is-poor"}>
                {diet.protein} g protein
              </span>
              <span className="diet-target">
                target {PROTEIN_MIN}–{PROTEIN_MAX} g
              </span>
            </p>
            <p className="diet-quiet">
              {diet.carbs} g carbs, {diet.fat} g fat
              {diet.burned !== null ? `. Whoop recorded ${formatNumber(diet.burned)} kcal burned` : ""}
            </p>
            <ul className="items">
              {diet.items.map((item, index) => (
                <li className="item" key={`${diet.iso}-${index}`}>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <details className="notes">
          <summary>Notes</summary>
          <div className="notes-body">
            <p>Times are Melbourne local. A row is dated by the night’s sleep, not the morning you woke.</p>
            <p>No Whoop data for 7 to 10 Oct. Diet figures are estimates.</p>
            <p>
              Sleep and workouts were pulled {SLEEP_PULLED}. The earlier cycle history was pulled {PULLED}.
            </p>
          </div>
        </details>
      </main>

      {open && selected ? (
        <div className="overlay">
          <div className="scrim" onClick={closeIfSettled} />
          <div className="dialog-slot">
            <DayDialog
              iso={selected}
              sleep={selectedSleep}
              sessions={selectedSessions}
              diets={selectedDiets}
              dialogRef={dialogRef}
              onClose={closeIfSettled}
              onStep={stepDay}
            />
          </div>
          {shield ? (
            <div className="shield" aria-hidden="true" onClick={swallow} onPointerUp={swallow} onTouchEnd={swallow} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function WeekRow({
  week,
  count,
  counted,
  metric,
  today,
  selected,
  sleepByIso,
  onOpen,
}: {
  week: { iso: string; inMonth: boolean }[];
  count: number;
  counted: boolean;
  metric: Metric;
  today: string;
  selected: string | null;
  sleepByIso: Map<string, SleepDay>;
  onOpen: (iso: string) => void;
}) {
  return (
    <>
      {week.map((cell) => {
        if (!cell.inMonth) return <div key={cell.iso} className="cell-empty" />;
        const openable = inRange(cell.iso, FIRST_ISO, TODAY_ISO);
        const record = sleepByIso.get(cell.iso);
        const value = metricValue(metric, record);
        const tier = openable ? tierFor(metric, value) : null;
        const lifts = liftCountOn(WORKOUTS, cell.iso);
        const walked = walkedOn(WORKOUTS, cell.iso);
        const dayNumber = Number(cell.iso.slice(8));
        if (!openable) {
          return (
            <div key={cell.iso} className="day-quiet" aria-hidden="true">
              <span className="date">{dayNumber}</span>
              <span className="count" />
              <span className="marks" />
            </div>
          );
        }
        return (
          <button
            key={cell.iso}
            type="button"
            className={["day", tier ? `is-${tier}` : "", selected === cell.iso ? "is-selected" : ""].filter(Boolean).join(" ")}
            aria-pressed={selected === cell.iso}
            aria-label={dayAria(cell.iso, metric, record, lifts, walked)}
            data-date={cell.iso}
            onClick={() => onOpen(cell.iso)}
          >
            <span className={cell.iso === today ? "date is-today" : "date"}>{dayNumber}</span>
            <span className="count">{value !== null ? Math.round(value) : ""}</span>
            <span className="marks">
              {lifts > 0 ? <LiftMark /> : null}
              {walked ? <span className="walk-mark" /> : null}
            </span>
          </button>
        );
      })}
      <div
        className={["lifts", counted && count > 0 ? "has-some" : "", counted && count >= LIFT_GOAL ? "is-met" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={counted ? `${count} of ${LIFT_GOAL} lifts this week` : undefined}
      >
        {counted ? `${count}/${LIFT_GOAL}` : ""}
      </div>
    </>
  );
}
