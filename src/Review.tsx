import { useState } from "react";
import type { ReviewResult, ReviewStore, CatalogWord } from "./lib/review";
import {
  forgotWords,
  latestMark,
  resultsAll,
  resultsSinceCopy,
  reviewCounts,
  reviewQueue,
  shortDate,
  stampDay,
} from "./lib/review";

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
    <li className={latest ? `word is-${latest.result}` : "word"}>
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
      <p className="month-line">Words you marked forgot, plus anything you have not marked yet.</p>
      <div className="stats review-counts">
        <div className="stat">
          <div className="stat-label">Remembered</div>
          <div className="stat-value">{counts.remembered}</div>
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
            ? "Unreviewed words and words you forgot will show up here."
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
