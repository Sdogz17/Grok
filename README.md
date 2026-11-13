# Grok

Three installable phone apps, published from one build.

- [Mandarin](https://sdogz17.github.io/Grok/) is a study calendar.
- [Health](https://sdogz17.github.io/Grok/health/) is a sleep and training calendar.
- [Screen time](https://sdogz17.github.io/Grok/screen/) is a screen-time calendar. The page in the browser does not read a phone. The Android app does, on the phone.

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

## Install on a Samsung phone

In Chrome, open https://sdogz17.github.io/Grok/ . Use the menu and choose **Install app** or **Add to Home screen**. The icon is labelled Mandarin and the app opens full screen, without the browser bar.

Light and dark follow the phone’s theme.

## Publish

GitHub Actions builds the three browser apps and deploys them to GitHub Pages on every push to `main`. Mandarin is https://sdogz17.github.io/Grok/ , Health is https://sdogz17.github.io/Grok/health/ , and Screen time is https://sdogz17.github.io/Grok/screen/ .

`npm run build` typechecks and builds Mandarin, then Health, then Screen time. Health is written to `dist/health` and Screen time to `dist/screen`. The Pages workflow uploads that `dist` folder. The Android app is not part of that upload.

The repository is public, so the study log and the health log are publicly readable. Health includes sleep scores, heart rate, workouts and diet notes.

Pages will not update until these are true:

1. **Settings → Pages → Build and deployment → Source** is **GitHub Actions**.
2. The workflow on `main` has finished. **Actions** shows “Deploy GitHub Pages”. The first run can sit on a “Waiting for review” environment approval; approve it if GitHub asks.

Merging the pull request into `main` is what triggers the deploy. The preview branch itself is not published.

## Health

A month calendar of Whoop sleep and recovery, with lift days and walks marked, and the log for the day you tap. Weeks run Monday to Sunday. The lift goal is 4. Food targets are 1,800 kcal and 100 to 130 g protein.

Edit `health/src/data/log.ts`. That is the only file you need to change. `TODAY_ISO` is the day the calendar treats as today. Move it forward when you add a newer day. Put new rows at the top of `SLEEP_LOG`, `WORKOUTS` and `DIET_LOG`.

```bash
npm run dev:health
```

Open http://localhost:5174/Grok/health/ . The dev server uses the same `/Grok/health/` base path as the published site.

In Chrome on a Samsung phone, open https://sdogz17.github.io/Grok/health/ and choose **Install app** or **Add to Home screen**. The icon is labelled Health. It is a separate app from Mandarin: its own manifest, and a service worker scoped to `/Grok/health/`. The Mandarin worker ignores that path, so the two apps do not share a cache.

Light and dark follow the phone’s theme.

## Screen time

A month calendar of screen time. Weeks run Monday to Sunday. Dates are Australia/Sydney civil dates, so daylight saving moves the midnight boundary. An empty day has nothing stored. A day that shows 0 was reported as zero.

The browser copy at `/Grok/screen/` cannot read Samsung Digital Wellbeing or iPhone Screen Time. It keeps what you import or type, in that browser only. Export downloads a JSON file. Delete removes that copy. Nothing is uploaded, and no one’s usage is committed to this repository.

The Android app, Screen time, is the copy that reads the phone. It shows this same calendar from files bundled inside the app, and it fills the days from Android usage statistics after you allow Usage access. That reading stays on the phone. The public site does not receive it, and opening the public site does not attach the phone.

```bash
npm run dev:screen
```

Open http://localhost:5175/Grok/screen/ .

In Chrome on a Samsung phone, the public page can be installed with **Install app** or **Add to Home screen**. The icon is labelled Screen. Its service worker is scoped to `/Grok/screen/`, so it does not share a cache with Mandarin or Health.

### What a day means

The coloured number is a device total:

- **Unlocked and interactive**, when the Android app had both screen events and keyguard events. The screen was interactive and the lock screen was not showing.
- **Screen interactive**, when the lock-screen state was not available. Android’s screen-interactive event is a duration. It is not a count of times the screen came on.
- **Typed screen time**, when you entered the number yourself.

App rows are foreground time. On a Galaxy Fold, more than one app can be resumed at once, so the rows can add up to more than the device total. They are not added up to make that total. Hour rows appear only when the source had timestamps. A daily total is never spread across the clock.

Usage access can return nothing when the phone is locked. An empty result is left empty. It is not stored as zero. Daily buckets whose timestamps cross a Sydney midnight are left out rather than split by guesswork. Event history is only kept by Android for a few days, so older days stay blank when a bucket does not line up.

### File shape

`screen/fixtures/example.screentime.json` is a shape example. The app does not load it. `schema` is `screentime.v1` and `timezone` is `Australia/Sydney`. Durations are whole milliseconds. `screenInteractiveMs` and `unlockedInteractiveMs` are omitted when the source did not report them, and `0` when it reported zero. `hours` is omitted unless the source supplied timestamps. A second import of the same date and device replaces that day. It does not add the totals together.

### Android app

Build it with JDK 17 or newer and Android SDK 35. The app does not declare an internet permission, so it cannot upload usage. The background job uses WorkManager, which also merges the ordinary permissions it needs to wake for that job. From the repo root:

```bash
npm install
npm run build:screen:android
cd android
./gradlew test assembleDebug
```

`android/local.properties` should set `sdk.dir` to the Android SDK. That file is not committed. The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`, signed with the debug keystore Gradle creates on the machine. That keystore is not a release key, and it is not committed.

On the Galaxy Z Fold:

1. Copy the APK onto the phone and open it. Allow installation from that source if Android asks.
2. Open Screen time.
3. Tap **Allow usage access**. Android opens system Settings. Turn Usage access on for Screen time. The app cannot flip that switch itself.
4. Come back to the app and leave the phone unlocked. It reads the usage Android still has and fills the days it can account for.
5. The calendar on the phone updates when you open the app. A background job also tries, and Android does not promise a time of day for that job.

Export in the app opens the share sheet. That is a file you choose to send. Import that file on the public page if you want the same days in the browser. The two copies do not sync by themselves.

iPhone Screen Time is not read. Apple’s Screen Time report stays inside a report extension and is not a file this app can fetch. An iPhone total can be typed, or imported if you already have a file in this shape.
