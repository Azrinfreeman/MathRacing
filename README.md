# MathRacing

An offline-first mathematics racing game for Malaysian **Year 1 and Year 2** classrooms (KSSR Semakan 2017, Edisi 3 alignment). Two to five pupils race on **one large touchscreen**: each has their own question panel, every racer drives towards the finish at the same steady pace, a correct answer gives that racer a boost and a wrong answer slows it for a moment, and the first to the finish wins. It runs in the browser, installs as a Progressive Web App, and works with no internet once loaded.

![Race with five players](docs/screenshots/race-5p-1920x1080.png)

- **Simple teacher setup:** Year 1 or 2, one topic or a mixed race, difficulty level 1-4, 2-5 players with optional names, Perlumbaan (winner) or Latihan (no winner), a 5/8/10/12-step track, Bahasa Melayu or English, sound, reduced motion, hints, support and cruise movement (or the step race with its setback rule).
- **Fair and calm:** every car cruises at the same pace and every correct answer adds the same boost (one step), same questions blueprint and level for everyone, private feedback on a wrong answer, no public accuracy. **Cruise (on by default, switchable on the teacher screen):** a wrong answer slows the car for a moment and never moves it back; a car whose pupil sends no answer for 10 s only crawls (a fifth of the pace) until the next answer, so waiting is never worth it. **Step race (cruise off):** a car moves one step per correct answer, and the optional setback rolls it back one step on the 3rd wrong answer to the same question (Quick Race, once per question, never below the start line).
- **Curriculum-tagged evidence:** every attempt is stored locally with pack, year, topic, SK, template, level, answer, time, hint and support use. **MathRacing records evidence; it never assigns a Tahap Penguasaan (TP).** The teacher makes the professional judgement.
- **Private:** no accounts, server, analytics or tracking. Data stays on the device and can be exported (CSV) or deleted at any time.
- **"Kira & taip" questions:** every question is a picture to count (objects, ten-frames, base-ten blocks, equal groups, coins and notes, a clock, a ruler, a chart) and one whole number typed on the number pad; nothing to order, build or select. 22 templates across 15 topics, generated from a seed (reproducible) and covered by property tests, including "the things drawn equal the answer". At level 1 (Asas) the pictures are plain: no plus sign, crossed-out things or rings, just things to count; the operations are drawn from level 2. See [docs/CURRICULUM-MAPPING.md](docs/CURRICULUM-MAPPING.md).

> **Status and limits.** The curriculum packs are drafts pending review by a qualified Malaysian primary Mathematics educator, and the game plan supplies SK ranges but no SP codes (none were invented). Five-finger operation has been tested through the real browser input pipeline with simulated touches, **not yet on real panel hardware**: run [docs/MANUAL-TOUCH-TEST.md](docs/MANUAL-TOUCH-TEST.md) on each target panel. See "Known limitations" below.

## Prerequisites

- Node.js 22.12 or newer (developed on 24) and npm.
- A Chromium-based browser (Chrome or Edge) for classroom use.

## Setup

```bash
npm install
```

Everything (Phaser, Vite, Vitest, Playwright, ESLint, Prettier) is a local dependency; no global tools are needed. For the browser tests, download the test browser once:

```bash
npx playwright install chromium
```

If the Playwright browser is unavailable but Chrome is installed, PowerShell can use it without downloading
another browser: `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e`. Omit the variable for the default bundled
Chromium. Dependency versions are unchanged.

## Everyday commands

| Command                           | What it does                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                     | Development server with hot reload (http://localhost:5173). Add `?diag` to the address to show the pointer-ownership overlay (development only). |
| `npm run build`                   | Type-checks, then produces the deployable static site in `dist/` (with service worker and manifest).                                             |
| `npm run preview`                 | Serves `dist/` at http://localhost:4173, as a school would host it.                                                                              |
| `npm run lint`                    | ESLint over the whole project.                                                                                                                   |
| `npm run typecheck`               | `tsc --noEmit` (strict).                                                                                                                         |
| `npm test`                        | Vitest unit and integration tests, one run (not watch mode). `npm run test:watch` for watch mode.                                                |
| `npm run test:e2e`                | Playwright end-to-end tests against the production build (builds and serves it automatically).                                                   |
| `npm run format` / `format:check` | Prettier.                                                                                                                                        |
| `npm run docs:curriculum`         | Regenerates `docs/CURRICULUM-MAPPING.md` from the live registry.                                                                                 |
| `npm run icons`                   | Re-renders the PWA icons from `public/icons/icon.svg`.                                                                                           |
| `npm run check`                   | lint + typecheck + unit tests + build.                                                                                                           |

## Using it in a classroom

1. Open the app once with internet (Chrome/Edge). After "Sedia digunakan tanpa internet." appears it works offline. To install it as an app, use the browser's **Install** button in the address bar (or menu → Cast, save and share → Install page as app).
2. **Splash and menu:** the app opens with a short splash, then a static main menu: **Perlumbaan** (race), **Latihan** (practice, no winner), **Main semula** (review the last setup), and **Tetapan guru**. Teacher settings have three sections: **Permainan**, **Bantuan murid**, and **Data & lanjutan** (session count, deletion and seed). Storage warnings and the PBD notice remain visible.
3. **Setup in three steps** (core choices fit a 960x540 landscape screen with the keyboard closed; Nunito is bundled offline): **Soalan** combines year, short topic labels and four levels. Multiple topics remain supported; **Maklumat kurikulum** opens the formal titles, SK ranges and full draft notice, and **Pratonton 5 soalan** keeps its sample questions and answers. **Pemain** offers 2-5 players and the existing vehicle/animal racer selector; **Tambah nama (pilihan)** reveals optional nickname/initial fields. **Sedia** shows question, player and game summaries. **Tukar** edits a row; game mode and track length are applied with **Selesai**, or discarded with **Batal**/Esc. **Mula perlumbaan** / **Mula latihan** proceeds to the existing pupil ready check. Selecting a year stays on Soalan; an empty topic selection cannot advance. Long detail panels and name entry with the keyboard open may scroll.
4. **Mula:** each pupil stands at the panel with their colour, symbol and name and touches their button to confirm (this doubles as a touch check), then a 3-2-1 countdown runs. **Mulakan sekarang** skips waiting.
5. **Racing:** each pupil reads the question, counts the matching picture, types the number and presses **Hantar**. Pictograph row names match their symbols; non-standard measuring questions show the named paper clips, blocks or cubes. After 2 wrong answers loose objects rearrange into rows of 5 (ten-frames) with a short hint. The small **Henti** button above the track needs a press-and-hold (or press **Esc**) to pause; **Sambung** resumes. The race also pauses if the tab is hidden.
6. **Results:** the class sees finishing order and progress. **Main Lagi** starts a fresh race with the same setup and new questions; **Persediaan Baharu** returns to the setup summary; **Eksport CSV** downloads the evidence; **Papar bukti guru** shows teacher-only counts per pupil and per SK.

### Controls

- Touch or mouse on the panels; the canvas never scrolls, zooms, selects text or opens a context menu.
- Teacher screens are fully keyboard accessible (Tab, Space/Enter, Esc closes dialogs; skip link at the top).

## Data storage and deleting it

| What                             | Where                                             | Contains                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence (sessions and attempts) | Browser IndexedDB database `mathracing-evidence`  | The session seed and settings, the nicknames you typed for that session, and one row per attempt (pack, year, topic, SK, template, level, answer, correctness, times, hint and support use, generation parameters). No surnames, IDs, birth dates, photos, audio or video. |
| Settings                         | Browser localStorage key `mathracing.settings.v1` | Classroom choices only (language, year, topics, level, mode, options, the racer picked for each seat Pemain 1-5). **Never player names.**                                                                                                                                  |

- **Delete one session:** Results → **Padam data sesi** → confirm.
- **Delete everything:** menu → **Tetapan guru** → **Padam semua data sesi** → confirm.
- **Delete from the browser itself:** Chrome/Edge → Settings → Privacy and security → Site settings → View permissions and data stored across sites → this site → Delete. Or DevTools (F12) → Application → Storage → **Clear site data**.
- CSV export is UTF-8 with a byte order mark (opens correctly in Excel), and cells that could be read as spreadsheet formulas are neutralised.
- If the browser blocks IndexedDB (some private windows), the app says so and keeps data in memory only; it is lost when the tab closes.

## Deployment

`npm run build` produces a static site in `dist/` with relative paths. Copy it to any web server or shared folder that serves it over **https or http://localhost** (service workers require a secure context), or serve `dist/` locally with `npm run preview`. Because the base path is relative it works from a sub-folder. After the first successful load, no network is needed; a new build is picked up automatically on the next online load.

### Android APK (tablets and smartboards)

`npm run apk` builds the web app, copies it into the Capacitor Android project in `android/` and writes an installable APK to `output/apk/MathRacing-<version>-<date>-debug.apk`. The whole game is inside the APK, so it runs with no network from the first launch. It opens full screen and landscape only. Needs JDK 17 and the Android SDK (platform 34); the script finds them in the usual Windows locations or through `JAVA_HOME` / `ANDROID_HOME`.

To install: copy the APK to the device (USB, Google Drive or a USB stick), open it, and allow "install unknown apps" for the app you opened it with when Android asks. With a USB cable and developer mode on, `adb install -r <apk>` also works. The APK is **debug-signed**: good for testing and sideloading, not for the Play Store. Installing a newer build over an older one keeps the settings and saved sessions, as long as it was built on the same PC (debug key).

### Release APK (signed with your own key)

A release APK is signed with a private key that only the owner keeps. **Make the key once and keep it safe**:
every later update must be signed with the same key, or Android refuses to install it over the old app. Never
commit the key or its passwords (they are git-ignored), and keep a backup copy somewhere other than this PC.

1. Create the key (keytool comes with the JDK; it asks you to choose the passwords):

   ```
   "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\keytool" -genkeypair -v -keystore C:\Users\<you>\mathracing-release.jks -alias mathracing -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `android/keystore.properties` (git-ignored) with your own values:

   ```
   storeFile=C:/Users/<you>/mathracing-release.jks
   storePassword=<the keystore password you chose>
   keyAlias=mathracing
   keyPassword=<the key password you chose>
   ```

3. Run `npm run apk:release`. The signed APK is written to `output/apk/MathRacing-<version>-<date>-release.apk`.

A release APK cannot be installed over a debug APK (they are signed with different keys): uninstall the test
build first. That removes the settings and saved sessions on that device, so export any CSV you need beforehand.
Before publishing an update, raise `versionCode` in `android/app/build.gradle`.

## Tests

- `npm test`: unit and integration tests for the seeded RNG, answer normalisation, every one of the 22 templates (1,000 generated samples per level: valid, tagged, deterministic, exactly one defensible answer, independently recomputed), curriculum registry rejection of malformed or duplicate packs, the race engine (exactly-once movement, per-player debounce, single winner and timestamp tie-break, hints, support, pause timing, practice mode, evidence log), the state machine, pointer ownership and its router, widgets, layout at 1280x720 / 1920x1080 / 3840x2160, storage (IndexedDB via `fake-indexeddb`), CSV formula-injection safety, locales, and the app controller flow with a fake game.
- `npm run test:e2e`: real Chromium against the production build: two-player race to a winner, replay and back to setup; a counting race over every Year 1 topic; five Year 2 panels at 1024x600; Year 2 in English; practice mode; pause; five-player layouts at three resolutions with screenshots; 2x display scaling; five simultaneous CDP touches with no cross-panel leakage; slide-in and slide-across rejection; CSV download and deletion after confirmation; offline boot; no remote requests. Screenshots are written to `e2e/screenshots/` (git-ignored).
- Automated tests do not replace the physical test in [docs/MANUAL-TOUCH-TEST.md](docs/MANUAL-TOUCH-TEST.md).

## Project layout

```
src/
  app/          AppController, splash, menu, setup steps, teacher settings and results screens, dialogs, stage chrome, styles
  curriculum/   schema, answer service, packs, template generators, registry, race blueprint
  game/
    core/       SeededRng, RaceEngine, state machine, pointer ownership, players (pure)
    widgets/    pure number pad model (the only way to answer)
    ui/         layout (pure) and Phaser drawing (panels, track, visuals)
    scenes/     Boot, Ready, Race
    PointerRouter.ts, SoundService.ts, createGame.ts, session.ts
  locales/      bm.ts (complete), en.ts (falls back to bm per key)
  storage/      IndexedDB + in-memory repositories, settings
  reporting/    CSV export and teacher evidence summary
  tests/        unit and integration tests
e2e/            Playwright tests and helpers
docs/           ARCHITECTURE, CURRICULUM-MAPPING (generated), DECISIONS, MANUAL-TOUCH-TEST
public/icons/   original PWA icons
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the state machine, dependency direction and multi-touch design, and [docs/DECISIONS.md](docs/DECISIONS.md) for every assumption (including what the reference video does and does not show).

## Known limitations

- **Five-touch hardware is not validated.** Simulated multi-touch passes; a real panel must be tested with the manual protocol.
- **Curriculum content is unreviewed**: packs are `draft-pending-academic-review`, SP codes are absent (not in the plan), and a few plan items are not built (see the gaps list in the curriculum mapping).
- Cooperative/team modes, a clock-setting widget, shape drawing and a Year 1 "2027 pack" are not implemented.
- The service worker cannot register in Claude's embedded browser pane; offline behaviour is verified in Playwright's Chromium.
- The Phaser bundle is about 1.4 MB (375 KB gzipped); it is loaded when the first race starts and then cached.
- `example.mp4` (the reference video, which shows real pupils) is kept on disk but deliberately not tracked by git.
