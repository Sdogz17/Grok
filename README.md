# Mandarin

A study calendar of words learned each day, written in pinyin, against a goal of 10. It is a small installable web app for a phone home screen.

The month grid shows each day’s count. Green is 10 or more. Ochre is 1 to 9. An empty day has no entry. Tap a day for the summary, grammar, and word list. Swipe right for the next month and left for the previous one. Prev, Next, and Latest do the same, and any month can be opened.

## Add a day

Edit `src/data/days.ts` and append one object to `DAYS`. That is the only file you need to change.

```ts
{
  date: "2026-11-03", // YYYY-MM-DD
  count: 6,           // the number drawn on the calendar
  summary: "What you worked on.",
  grammar: ["a phrase or note"], // [] if there are none
  words: [
    { pinyin: "míngtiān", meaning: "tomorrow" }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `date` | `string` | `YYYY-MM-DD`. One entry per date. |
| `count` | `number` | Words you count for that day. This is what the cell shows. It does not have to equal `words.length`. |
| `summary` | `string` | A sentence or two about the session. |
| `grammar` | `string[]` | Phrases and notes. Use `[]` when there are none. |
| `words` | `{ pinyin, meaning }[]` | Pinyin with tone marks, and a short meaning. No Chinese characters. |

`GOAL` at the top of the same file is the daily target (10). Days at or above it are green. Days from 1 to `GOAL - 1` are ochre.

Pinyin only, with tone marks. Do not add Chinese characters.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/Grok/ . The dev server uses the same `/Grok/` base path as the published site.

```bash
npm run build
npm run preview
```

## Publish

GitHub Actions builds the app and deploys it to GitHub Pages on every push to `main`. The site is https://sdogz17.github.io/Grok/ .

Pages will not update until these are true:

1. The repository is **public**. GitHub Pages is free only on public repositories. This repo is private, so a free site will not serve until you change that: **Settings → General → Danger zone → Change repository visibility → Public**. The study log is in the repo, so a public repo makes those notes public too.
2. **Settings → Pages → Build and deployment → Source** is **GitHub Actions**.
3. The workflow on `main` has finished. **Actions** shows “Deploy GitHub Pages”. The first run can sit on a “Waiting for review” environment approval; approve it if GitHub asks.

Merging the pull request into `main` is what triggers the deploy. The preview branch itself is not published.

## Install on a Samsung phone

In Chrome, open https://sdogz17.github.io/Grok/ . Use the menu and choose **Install app** or **Add to Home screen**. The icon is labelled Mandarin and the app opens full screen, without the browser bar.

Light and dark follow the phone’s theme.
