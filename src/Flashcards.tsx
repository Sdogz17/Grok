import { useRef, useState } from "react";
import { MarkButtons } from "./Review";
import { todayIso } from "./lib/calendar";
import type { CatalogWord, ReviewResult, ReviewStore } from "./lib/review";
import { formatResults, frontMeaning, latestMark, resultTone, reviewQueue } from "./lib/review";

export type Deck = "fresh" | "half" | "forgot" | "remembered" | "all";

const DECKS: { id: Deck; label: string; detail: string }[] = [
  { id: "fresh", label: "To review", detail: "No mark yet, half remembered, and forgot" },
  { id: "half", label: "Half remembered", detail: "Latest mark is half remembered" },
  { id: "forgot", label: "Forgot", detail: "Latest mark is forgot" },
  { id: "remembered", label: "Remembered", detail: "Latest mark is remembered" },
  { id: "all", label: "All words", detail: "Every word, with an optional date range" },
];

function deckWords(deck: Deck, words: readonly CatalogWord[], store: ReviewStore, from: string, to: string): CatalogWord[] {
  if (deck === "fresh") return reviewQueue(words, store.marks);
  if (deck === "half") {
    return words
      .filter((word) => latestMark(store.marks, word.pinyin)?.result === "half remembered")
      .sort((a, b) => a.learned.localeCompare(b.learned) || a.pinyin.localeCompare(b.pinyin));
  }
  if (deck === "forgot") return reviewQueue(words, store.marks).filter((word) => latestMark(store.marks, word.pinyin)?.result === "forgot");
  if (deck === "remembered") {
    return words
      .filter((word) => latestMark(store.marks, word.pinyin)?.result === "remembered")
      .sort((a, b) => a.learned.localeCompare(b.learned));
  }
  return words
    .filter((word) => (!from || word.learned >= from) && (!to || word.learned <= to))
    .sort((a, b) => a.learned.localeCompare(b.learned) || a.pinyin.localeCompare(b.pinyin));
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function ToReview(props: {
  words: readonly CatalogWord[];
  store: ReviewStore;
  onMark: (pinyin: string, result: ReviewResult) => void;
  onStudy: () => void;
}) {
  const queue = reviewQueue(props.words, props.store.marks);
  return (
    <section className="needs" aria-label="To review">
      <h1 className="month-title">To review</h1>
      <p className="month-line">
        {queue.length === 1 ? "1 word still to review." : `${queue.length} words still to review.`} Not reviewed, half remembered, and forgot.
      </p>
      <button type="button" className="nav-btn" onClick={props.onStudy} disabled={queue.length === 0}>
        Study as cards
      </button>
      {queue.length === 0 ? (
        <p className="empty">Every word is remembered.</p>
      ) : (
        <ul className="words">
          {queue.map((word) => {
            const latest = latestMark(props.store.marks, word.pinyin);
            return (
              <li key={word.pinyin} className={latest ? `word is-${resultTone(latest.result)}` : "word"}>
                <div className="word-copy">
                  <span className="pinyin" lang="zh-Latn">
                    {word.pinyin}
                  </span>
                  {latest?.result === "half remembered" ? <span className="tag half">Half remembered</span> : null}
                  {latest?.result === "forgot" ? <span className="tag forgot">Forgot</span> : null}
                  <span className="meaning">{word.meaning}</span>
                  <span className="reviewed">Learned {word.learned}</span>
                </div>
                <MarkButtons pinyin={word.pinyin} store={props.store} onMark={props.onMark} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Flashcards(props: {
  words: readonly CatalogWord[];
  store: ReviewStore;
  onMark: (pinyin: string, result: ReviewResult) => void;
  initialDeck?: Deck | null;
}) {
  const [deck, setDeck] = useState<Deck | null>(props.initialDeck ?? null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shuffled, setShuffled] = useState(false);
  const [queue, setQueue] = useState<CatalogWord[] | null>(null);

  if (queue) {
    return (
      <CardRun
        queue={queue}
        store={props.store}
        onMark={props.onMark}
        onClose={() => setQueue(null)}
      />
    );
  }

  const preview = deck ? deckWords(deck, props.words, props.store, from, to) : [];

  return (
    <section className="needs" aria-label="Flashcards">
      <h1 className="month-title">Flashcards</h1>
      <p className="month-line">Meaning first. Flip for the pinyin.</p>
      <div className="deck-list">
        {DECKS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={deck === item.id ? "nav-btn is-selected" : "nav-btn"}
            aria-pressed={deck === item.id}
            onClick={() => setDeck(item.id)}
          >
            {item.label}
            <span className="deck-detail">{item.detail}</span>
          </button>
        ))}
      </div>
      {deck === "all" ? (
        <div className="date-range">
          <label>
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      ) : null}
      <label className="shuffle">
        <input type="checkbox" checked={shuffled} onChange={(event) => setShuffled(event.target.checked)} />
        Shuffle
      </label>
      <button
        type="button"
        className="nav-btn"
        disabled={!deck || preview.length === 0}
        onClick={() => setQueue(shuffled ? shuffle(preview) : preview)}
      >
        Start{deck ? ` (${preview.length})` : ""}
      </button>
    </section>
  );
}

function CardRun(props: {
  queue: CatalogWord[];
  store: ReviewStore;
  onMark: (pinyin: string, result: ReviewResult) => void;
  onClose: () => void;
}) {
  const [cards, setCards] = useState(props.queue);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState<Record<string, ReviewResult>>({});
  const [fallback, setFallback] = useState<string | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const word = cards[index];
  const done = index >= cards.length;

  function answer(result: ReviewResult) {
    if (!word) return;
    props.onMark(word.pinyin, result);
    setSession((current) => ({ ...current, [word.pinyin]: result }));
    setFlipped(false);
    setIndex((current) => current + 1);
  }

  const remembered = Object.values(session).filter((result) => result === "remembered").length;
  const half = Object.values(session).filter((result) => result === "half remembered").length;
  const forgot = Object.values(session).filter((result) => result === "forgot").length;

  async function copySession() {
    const forgotWords = Object.entries(session).filter(([, result]) => result === "forgot").map(([pinyin]) => pinyin).sort();
    const halfWords = Object.entries(session)
      .filter(([, result]) => result === "half remembered")
      .map(([pinyin]) => pinyin)
      .sort();
    const rememberedWords = Object.entries(session)
      .filter(([, result]) => result === "remembered")
      .map(([pinyin]) => pinyin)
      .sort();
    const text = formatResults(forgotWords, halfWords, rememberedWords, todayIso());
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setFallback(null);
        return;
      }
    } catch {
      // Show the text instead.
    }
    setFallback(text);
  }

  if (done || !word) {
    const missed = cards.filter((item) => session[item.pinyin] === "forgot");
    return (
      <section className="needs" aria-label="Deck summary">
        <h1 className="month-title">Deck done</h1>
        <p className="month-line">
          {remembered} remembered, {half} half remembered, {forgot} forgot.
        </p>
        <div className="nav copy-actions">
          <button
            type="button"
            className="nav-btn"
            disabled={missed.length === 0}
            onClick={() => {
              setCards(missed);
              setSession({});
              setIndex(0);
              setFlipped(false);
            }}
          >
            Retry forgotten
          </button>
          <button type="button" className="nav-btn" onClick={() => void copySession()}>
            Copy results
          </button>
          <button type="button" className="nav-btn" onClick={props.onClose}>
            Back
          </button>
        </div>
        {fallback ? <textarea className="copy-box" readOnly value={fallback} rows={6} aria-label="Review results" /> : null}
      </section>
    );
  }

  const progress = cards.length === 0 ? 0 : (index + 1) / cards.length;

  return (
    <section className="needs" aria-label="Flashcard">
      <p className="month-line">
        {index + 1}/{cards.length}
      </p>
      <div className="period-bar" aria-hidden="true">
        <span className="remembered" style={{ width: `${progress * 100}%` }} />
      </div>
      <button
        type="button"
        className="card"
        onClick={() => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          setFlipped((current) => !current);
        }}
        onPointerDown={(event) => {
          setStart({ x: event.clientX, y: event.clientY });
        }}
        onPointerUp={(event) => {
          if (!start || !flipped) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          setStart(null);
          if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy)) return;
          swiped.current = true;
          answer(dx > 0 ? "remembered" : "forgot");
        }}
      >
        {flipped ? (
          <>
            <span className="session-pinyin" lang="zh-Latn">
              {word.pinyin}
            </span>
            <span className="meaning">{word.meaning}</span>
            {word.example ? (
              <span className="example">
                <span lang="zh-Latn">{word.example.pinyin}</span>
                {word.example.english ? <span>{word.example.english}</span> : null}
              </span>
            ) : null}
          </>
        ) : (
          <span className="card-front">{frontMeaning(word.meaning)}</span>
        )}
      </button>
      <p className="hint">{flipped ? "Swipe right if you remembered, left if you forgot." : "Tap the card to flip."}</p>
      {flipped ? (
        <div className="review-actions session-actions">
          <button type="button" className="mark-btn" onClick={() => answer("remembered")}>
            <span aria-hidden="true">✓</span>
            Remembered
          </button>
          <button type="button" className="mark-btn half" onClick={() => answer("half remembered")}>
            <span aria-hidden="true">◐</span>
            Half remembered
          </button>
          <button type="button" className="mark-btn" onClick={() => answer("forgot")}>
            <span aria-hidden="true">×</span>
            Forgot
          </button>
        </div>
      ) : null}
      <button type="button" className="nav-btn" onClick={props.onClose}>
        Back
      </button>
    </section>
  );
}

export function freshWords(words: readonly CatalogWord[], store: ReviewStore): CatalogWord[] {
  return words.filter((word) => !latestMark(store.marks, word.pinyin));
}
