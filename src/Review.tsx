import { useState } from "react";
import { DAYS } from "./data/days";
import { todayIso } from "./lib/calendar";
import type { ReviewMark, ReviewResult, ReviewStore, CatalogWord, PeriodStats } from "./lib/review";
import {
  forgotWords,
  halfWords,
  latestMark,
  periodStats,
  resultsAll,
  resultsSinceCopy,
  resultTone,
  reviewCounts,
  reviewQueue,
  shortDate,
  stampDay,
  weekRange,
} from "./lib/review";

function PeriodCard(props: { label: string; stats: PeriodStats }) {
  const sum = props.stats.remembered + props.stats.half + props.stats.forgot + props.stats.fresh;
  const width = (value: number) => (sum === 0 ? "0%" : `${(value / sum) * 100}%`);
  return (
    <div className="period-card">
      <div className="period-label">{props.label}</div>
      <div className="period-total">{props.stats.total}</div>
      <div className="period-bar" aria-hidden="true">
        <span className="remembered" style={{ width: width(props.stats.remembered) }} />
        <span className="half" style={{ width: width(props.stats.half) }} />
        <span className="forgot" style={{ width: width(props.stats.forgot) }} />
        <span className="fresh" style={{ width: width(props.stats.fresh) }} />
      </div>
      <p className="period-split">
        <span className="remembered">{props.stats.remembered} remembered</span>
        <span className="half">{props.stats.half} half remembered</span>
        <span className="forgot">{props.stats.forgot} forgot</span>
        <span>{props.stats.fresh} not reviewed</span>
      </p>
    </div>
  );
}

export function PeriodPanel(props: { anchor: string; monthKey: string; year: number; marks: readonly ReviewMark[] }) {
  const week = weekRange(props.anchor);
  const day = periodStats(
    DAYS.filter((item) => item.date === props.anchor),
    props.marks,
  );
  const weekStats = periodStats(
    DAYS.filter((item) => item.date >= week.start && item.date <= week.end),
    props.marks,
  );
  const monthStats = periodStats(
    DAYS.filter((item) => item.date.startsWith(props.monthKey)),
    props.marks,
  );
  const yearStats = periodStats(
    DAYS.filter((item) => item.date.startsWith(`${props.year}-`)),
    props.marks,
  );
  const dayLabel = props.anchor === todayIso() ? `Today, ${shortDate(props.anchor)}` : shortDate(props.anchor);
  return (
    <section className="period-grid" aria-label="Words in this period">
      <PeriodCard label={dayLabel} stats={day} />
      <PeriodCard label="This week" stats={weekStats} />
      <PeriodCard label="This month" stats={monthStats} />
      <PeriodCard label="This year" stats={yearStats} />
    </section>
  );
}

export function MarkButtons(props: {
  pinyin: string;
  store: ReviewStore;
  onMark: (pinyin: string, result: ReviewResult) => void;
}) {
  const latest = latestMark(props.store.marks, props.pinyin);
  return (
    <div className="review-actions">
      <button
        type="button"
        className={latest?.result === "remembered" ? "mark-btn is-on remembered" : "mark-btn"}
        aria-pressed={latest?.result === "remembered"}
        aria-label={`Remembered ${props.pinyin}`}
        onClick={(event) => {
          event.stopPropagation();
          props.onMark(props.pinyin, "remembered");
        }}
      >
        <span aria-hidden="true">✓</span>
        Remembered
      </button>
      <button
        type="button"
        className={latest?.result === "half remembered" ? "mark-btn half is-on" : "mark-btn half"}
        aria-pressed={latest?.result === "half remembered"}
        aria-label={`Half remembered ${props.pinyin}`}
        onClick={(event) => {
          event.stopPropagation();
          props.onMark(props.pinyin, "half remembered");
        }}
      >
        <span aria-hidden="true">◐</span>
        Half remembered
      </button>
      <button
        type="button"
        className={latest?.result === "forgot" ? "mark-btn is-on forgot" : "mark-btn"}
        aria-pressed={latest?.result === "forgot"}
        aria-label={`Forgot ${props.pinyin}`}
        onClick={(event) => {
          event.stopPropagation();
          props.onMark(props.pinyin, "forgot");
        }}
      >
        <span aria-hidden="true">×</span>
        Forgot
      </button>
    </div>
  );
}

export function WordReview(props: {
  pinyin: string;
  meaning: string;
  store: ReviewStore;
  onMark: (pinyin: string, result: ReviewResult) => void;
}) {
  const latest = latestMark(props.store.marks, props.pinyin);
  return (
    <li className={latest ? `word is-${resultTone(latest.result)}` : "word"}>
      <div className="word-copy">
        <span className="pinyin" lang="zh-Latn">
          {props.pinyin}
        </span>
        <span className="meaning">{props.meaning}</span>
        {latest ? <span className="reviewed">Reviewed {stampDay(latest.timestamp)}</span> : null}
      </div>
      <MarkButtons pinyin={props.pinyin} store={props.store} onMark={props.onMark} />
    </li>
  );
}

export function NeedsReview(props: {
  words: readonly CatalogWord[];
  store: ReviewStore;
  onMark: (pinyin: string, result: ReviewResult) => void;
  onCopied: (at: string) => void;
}) {
  const counts = reviewCounts(props.words, props.store.marks);
  const forgot = forgotWords(props.words, props.store.marks);
  const [session, setSession] = useState<CatalogWord[] | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function copy(text: string, stamp: boolean) {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (ok) {
      setFallback(null);
      setNote("Copied");
      if (stamp) props.onCopied(new Date().toISOString());
      return;
    }
    setNote("");
    setFallback(text);
  }

  if (session) {
    return (
      <ReviewSession
        queue={session}
        store={props.store}
        onMark={props.onMark}
        onClose={() => setSession(null)}
      />
    );
  }

  return (
    <section className="needs" aria-label="Needs review">
      <h1 className="month-title">Needs review</h1>
      <p className="month-line">Words you marked forgot. The review session also includes half remembered words and anything not marked yet.</p>
      <div className="stats review-counts">
        <div className="stat">
          <div className="stat-label">Remembered</div>
          <div className="stat-value">{counts.remembered}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Half remembered</div>
          <div className="stat-value">{counts.half}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Forgot</div>
          <div className="stat-value">{counts.forgot}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Not yet reviewed</div>
          <div className="stat-value">{counts.fresh}</div>
        </div>
      </div>
      <div className="nav copy-actions">
        <button
          type="button"
          className="nav-btn"
          onClick={() => copy(resultsSinceCopy(props.store), true)}
        >
          Copy results
        </button>
        <button type="button" className="nav-btn" onClick={() => copy(resultsAll(props.store), false)}>
          Copy all
        </button>
        <button
          type="button"
          className="nav-btn"
          onClick={() => setSession(reviewQueue(props.words, props.store.marks))}
        >
          Review session
        </button>
      </div>
      {note ? <p className="hint">{note}</p> : null}
      {props.store.lastCopiedAt ? (
        <p className="hint">Last copied {stampDay(props.store.lastCopiedAt)}. Copy results includes marks since then.</p>
      ) : (
        <p className="hint">Copy results includes every mark until you copy once. After that, only new marks.</p>
      )}
      {fallback ? (
        <textarea className="copy-box" readOnly value={fallback} rows={6} aria-label="Review results" />
      ) : null}
      {forgot.length === 0 ? (
        <p className="empty">No words marked forgot.</p>
      ) : (
        <ul className="words">
          {forgot.map((word) => (
            <li key={word.pinyin} className="word is-forgot">
              <div className="word-copy">
                <span className="pinyin" lang="zh-Latn">
                  {word.pinyin}
                </span>
                <span className="tag forgot">Forgot</span>
                <span className="meaning">{word.meaning}</span>
                <span className="reviewed">Learned {shortDate(word.learned)}</span>
              </div>
              <MarkButtons pinyin={word.pinyin} store={props.store} onMark={props.onMark} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HalfReview(props: {
  words: readonly CatalogWord[];
  store: ReviewStore;
  onMark: (pinyin: string, result: ReviewResult) => void;
  onStudy: () => void;
}) {
  const half = halfWords(props.words, props.store.marks);
  return (
    <section className="needs" aria-label="Half remembered">
      <h1 className="month-title">Half remembered</h1>
      <p className="month-line">
        {half.length === 1 ? "1 word marked half remembered." : `${half.length} words marked half remembered.`}
      </p>
      <button type="button" className="nav-btn" onClick={props.onStudy} disabled={half.length === 0}>
        Study as cards
      </button>
      {half.length === 0 ? (
        <p className="empty">No words marked half remembered.</p>
      ) : (
        <ul className="words">
          {half.map((word) => (
            <li key={word.pinyin} className="word is-half">
              <div className="word-copy">
                <span className="pinyin" lang="zh-Latn">
                  {word.pinyin}
                </span>
                <span className="tag half">Half remembered</span>
                <span className="meaning">{word.meaning}</span>
                <span className="reviewed">Learned {shortDate(word.learned)}</span>
              </div>
              <MarkButtons pinyin={word.pinyin} store={props.store} onMark={props.onMark} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewSession(props: {
  queue: CatalogWord[];
  store: ReviewStore;
  onMark: (pinyin: string, result: ReviewResult) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const word = props.queue[index];

  function mark(result: ReviewResult) {
    if (!word) return;
    const latest = latestMark(props.store.marks, word.pinyin);
    const undoing = latest?.result === result;
    props.onMark(word.pinyin, result);
    if (undoing) return;
    setShow(false);
    setIndex((current) => current + 1);
  }

  if (!word) {
    return (
      <section className="needs" aria-label="Review session">
        <h1 className="month-title">{props.queue.length === 0 ? "Nothing to review" : "Session done"}</h1>
        <p className="month-line">
          {props.queue.length === 0
            ? "Unreviewed, half remembered, and forgotten words will show up here."
            : "You reached the end of this session."}
        </p>
        <button type="button" className="nav-btn" onClick={props.onClose}>
          Back
        </button>
      </section>
    );
  }

  return (
    <section className="needs" aria-label="Review session">
      <p className="month-line">
        {index + 1} of {props.queue.length}
      </p>
      <p className="session-pinyin" lang="zh-Latn">
        {word.pinyin}
      </p>
      {show ? (
        <p className="summary">{word.meaning}</p>
      ) : (
        <button type="button" className="nav-btn" onClick={() => setShow(true)}>
          Show meaning
        </button>
      )}
      <div className="review-actions session-actions">
        <button type="button" className="mark-btn" onClick={() => mark("remembered")}>
          <span aria-hidden="true">✓</span>
          Remembered
        </button>
        <button type="button" className="mark-btn half" onClick={() => mark("half remembered")}>
          <span aria-hidden="true">◐</span>
          Half remembered
        </button>
        <button type="button" className="mark-btn" onClick={() => mark("forgot")}>
          <span aria-hidden="true">×</span>
          Forgot
        </button>
      </div>
      <button type="button" className="nav-btn" onClick={props.onClose}>
        Back
      </button>
    </section>
  );
}
