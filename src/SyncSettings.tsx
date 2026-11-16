import { useEffect, useState, type FormEvent } from "react";
import { saveReview, type ReviewStore } from "./lib/review";
import {
  bindSync,
  clearToken,
  loadToken,
  saveToken,
  syncNow,
  SYNCED_AT_KEY,
  type SyncStatus,
} from "./lib/sync";

export function useSyncBridge(store: ReviewStore, setStore: (store: ReviewStore) => void) {
  const [status, setStatus] = useState<SyncStatus>(() => {
    const token = loadToken();
    const at = localStorage.getItem(SYNCED_AT_KEY);
    if (!token) return { kind: "not-connected" };
    return at ? { kind: "synced", at } : { kind: "not-connected" };
  });

  bindSync(store, (next) => {
    saveReview(next);
    setStore(next);
  }, setStatus);

  useEffect(() => {
    void syncNow();
    const online = () => void syncNow();
    window.addEventListener("online", online);
    const tick = window.setInterval(() => setStatus((current) => ({ ...current })), 30000);
    return () => {
      window.removeEventListener("online", online);
      window.clearInterval(tick);
    };
  }, []);

  return { status };
}

export function SyncSettings() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(loadToken().length > 0);
  const [message, setMessage] = useState("");

  function save(event: FormEvent) {
    event.preventDefault();
    const next = token.trim();
    if (!next) return;
    saveToken(next);
    setToken("");
    setSaved(true);
    setMessage("Token saved on this phone. It is not in the repo.");
    void syncNow();
  }

  return (
    <section className="needs" aria-label="Sync settings">
      <h1 className="month-title">Sync</h1>
      <p className="summary">
        Your tutor can read Remembered and Forgot marks from the repo. The token stays in this browser only.
      </p>
      <ol className="setup">
        <li>
          Open{" "}
          <a href="https://github.com/settings/personal-access-tokens/new">
            github.com/settings/personal-access-tokens/new
          </a>
          .
        </li>
        <li>Token name: Mandarin. Resource owner: Sdogz17. Expiration: 90 days.</li>
        <li>Repository access: Only select repositories, then Sdogz17/Grok.</li>
        <li>Repository permissions: Contents, then Read and write. Leave every other permission as No access.</li>
        <li>Generate the token and paste the github_pat_… value below.</li>
      </ol>
      {saved ? <p className="hint">A token is saved on this phone.</p> : <p className="hint">Not connected yet.</p>}
      <form className="token-form" onSubmit={save}>
        <label>
          GitHub token
          <input
            type="password"
            autoComplete="off"
            value={token}
            placeholder="github_pat_…"
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <div className="nav">
          <button type="submit" className="nav-btn" disabled={token.trim().length === 0}>
            Save token
          </button>
          <button
            type="button"
            className="nav-btn"
            onClick={() => {
              clearToken();
              setSaved(false);
              setMessage("Token removed from this phone.");
            }}
          >
            Remove token
          </button>
          <button type="button" className="nav-btn" onClick={() => void syncNow()}>
            Sync now
          </button>
        </div>
      </form>
      {message ? <p className="hint">{message}</p> : null}
      <p className="hint">
        Marks are written to data/review-state.json on main. That file does not republish the site.
      </p>
    </section>
  );
}
