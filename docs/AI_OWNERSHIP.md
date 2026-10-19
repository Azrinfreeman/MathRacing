# AI ownership: Claude (lead engineer) and Codex (UI/UX specialist)

Two agents work on this repository in T3 Code. This file says who owns which files, which interfaces sit
between them, and what must never break. It adds no new structure: the app is almost finished, and the
split follows the layers that already exist (`docs/ARCHITECTURE.md`, "Dependency direction").

Read with `AGENTS.md` (commands, traps, "Done means"), which both agents load. `docs/DECISIONS.md` gives
the reason behind each rule quoted here as `#n`.

## 1. What this app has (and does not have)

- No server, no API, no login, no SQL database, no migrations. It is a static offline PWA (also wrapped as
  an Android APK through Capacitor). Nothing is sent anywhere (hard rule).
- **"Database"** = IndexedDB `mathracing-evidence` (stores `sessions`, `attempts`) in
  `src/storage/IndexedDbSessionRepository.ts`, and settings in localStorage (`src/storage/settings.ts`).
  Their record shapes are `AttemptRecord` / `SessionMeta` in `src/game/core/RaceState.ts`, and the CSV
  columns in `src/reporting/exportCsv.ts`. **These shapes are frozen for this setup.**
- **"Integrations"** = the PWA service worker (`vite.config.ts`, `vite-plugin-pwa`), the Android shell
  (`android/`, `capacitor.config.json`, `scripts/build-apk.mjs`) and CSV download.
- **"Auth"**: none. The teacher screen has no lock (owner decision, #35). Do not add one without a decision.

## 2. Ownership by path

Legend: **C** = Claude owns (Codex does not edit), **X** = Codex owns (Claude does not edit except to fix a
failing build or test, and then says so), **S** = shared (rules in section 3).

### Claude: logic, data, platform (C)

| Path                                                                                                              | What it holds                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/game/core/`                                                                                                  | Race rules, state machine, cruise maths, input ownership, RNG, racer catalogue     |
| `src/game/core/players.ts`                                                                                        | Player colour/symbol identity + `contrastRatio` (colours are an accessibility cue) |
| `src/curriculum/` (all, incl. `visual.ts`, generators, packs, `text/vocab.ts`)                                    | Questions, answers, picture models, packs                                          |
| `src/storage/`, `src/reporting/`                                                                                  | IndexedDB, localStorage settings, CSV, teacher evidence summary                    |
| `src/app/AppController.ts`, `src/app/setupState.ts`                                                               | Screen flow, persistence, race start/stop, keyboard shortcuts                      |
| `src/game/widgets/`                                                                                               | Pure number-pad model: control ids, key layout, submit effects                     |
| `src/game/scenes/`, `src/game/createGame.ts`, `src/game/session.ts`, `src/game/PointerRouter.ts`                  | Phaser lifecycle, `guardedFrame`, pointer routing, commands                        |
| `src/game/SoundService.ts`                                                                                        | Sound playback and its on/off setting                                              |
| `src/game/ui/layout.ts`, `trackGeometry.ts`, `countLayout.ts`, `geometry.ts`                                      | Pure geometry that e2e uses to compute tap positions and that size tests check     |
| `src/locales/index.ts`, `src/main.ts`                                                                             | Translator, boot                                                                   |
| `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `package.json` | Build, PWA precache, tooling (versions pinned: do not bump)                        |
| `android/`, `capacitor.config.json`, `scripts/`                                                                   | APK build, docs generators, checks                                                 |
| `src/tests/`, `e2e/`                                                                                              | Functional tests (Codex may add visual tests; see 3.4)                             |
| `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, `README.md`                                             | Rules and architecture (Codex proposes entries; Claude appends)                    |

### Codex: look and feel (X)

| Path                                                  | What it holds                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| `src/app/styles/app.css` (+ `fonts/`)                 | All DOM styling: tokens, layout, responsive rules, transitions       |
| `src/app/art.ts`                                      | Inline SVG: menu icons, topic icons, level stars, racer SVG wrapper  |
| `src/game/ui/theme.ts`                                | Canvas colours and font                                              |
| `src/game/ui/shapes.ts`, `src/game/ui/cueIcons.ts`    | Canvas symbols, objects, the "?" badge, tick, retry, bulb            |
| `src/game/ui/TrackView.ts`                            | Track, cars, particles, countdown, celebration drawing               |
| `src/game/ui/racerShapes.ts`                          | Racer parts drawn by both the track and the DOM (constraints in 4.3) |
| `src/game/ui/motion.ts`                               | Car spring and animation feel (constraints in 4.3)                   |
| `public/icons/`, `public/fonts/`, `docs/menu-simple/` | App icons, bundled fonts (offline, licensed), design mock-ups        |

### Shared (S): UI and logic are mixed in the same file

| Path                                                            | Codex may change                                                           | Claude keeps                                                                                                                                                                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/screens/SetupScreen.ts`                                | Markup, classes, order of visual elements, icons, `render*`/`step*` bodies | `go`/`next`/`back`/`start` validation (empty topics never advance), `setYear` resetting topics, racer conflict rule in `openRacerPicker`, `editGame` save-on-Selesai/discard-on-Batal, `summarizeSetup`, `showPreview` data |
| `src/app/screens/MenuScreen.ts`                                 | Markup and styling                                                         | Callbacks, which cards exist ("Main semula" only once a setup exists)                                                                                                                                                       |
| `src/app/screens/TeacherScreen.ts`                              | Markup, grouping, switch look                                              | Which options exist and when they show (setback only when cruise is off, #36), storage/PBD notices always visible                                                                                                           |
| `src/app/screens/ResultsScreen.ts`                              | Markup, podium/standings look                                              | Standings order, `summarizeEvidence` use, export/delete flow and confirmations                                                                                                                                              |
| `src/app/screens/SplashScreen.ts`, `index.html` (inline splash) | Look and animation of the splash                                           | Timing (min 1.5 s, cap 6 s, once per tab), engine preload, `#splash` id                                                                                                                                                     |
| `src/app/StageChrome.ts`                                        | Toolbar, pause overlay look                                                | Button handlers, pause/resume/end wiring                                                                                                                                                                                    |
| `src/app/controls.ts`, `dialogs.ts`, `help.ts`                  | Visuals of switches, choices, dialogs, toasts, help                        | Focus trap, Esc/Enter behaviour, confirm results, the `role`/`aria-*` attributes                                                                                                                                            |
| `src/app/dom.ts`                                                | nothing (tiny `h()` helper)                                                | everything                                                                                                                                                                                                                  |
| `src/game/ui/PanelView.ts`                                      | `render*`, `draw*`, `darkenColor` (lines ~250-690)                         | `press`/`release`/`cancel`/`locked`/`confirmReady`/`cancelAllPresses` (lines ~186-250): the tap-completion rule is the multi-touch release blocker                                                                          |
| `src/game/ui/VisualRenderer.ts`                                 | Colours, strokes, shading, spacing inside a picture                        | **What** is drawn and **how many**: the count drawn must equal the answer (#42, #46-#49); no text on the pupil panel                                                                                                        |
| `src/game/ui/DrawContext.ts`                                    | Text styles                                                                | `TextPool` reuse (no per-frame leaks)                                                                                                                                                                                       |
| `src/locales/bm.ts`, `en.ts`                                    | Wording of labels (propose; BM first)                                      | Keys (`MessageKey`), placeholders (`{n}`), pupil-facing rules (#45-#46)                                                                                                                                                     |
| `vite.config.ts` manifest colours                               | `theme_color`, `background_color` values                                   | Everything else in the file                                                                                                                                                                                                 |

## 3. Collaboration rules

1. **One owner per change.** Before editing, check this table. Editing an **X** file is Codex's job; a
   **C** file is Claude's. For an **S** file, edit only your column; if you must touch the other column,
   stop and ask in the thread (a short "interface request": file, what, why).
2. **Branches.** Each agent works on its own branch (`ui/<topic>` for Codex, `eng/<topic>` for Claude), one
   commit per logical step, small PRs to `main`. Never both edit the same S file in parallel: the second
   agent rebases on the first.
3. **Interfaces are frozen unless agreed:** `data-testid` values, CSS classes and attributes that tests
   select (section 4.1), `Settings` keys, `AttemptRecord`/`SessionMeta`, CSV columns, `MessageKey`s,
   exported function signatures in shared files, `PanelAction`, `WidgetModel`, `RacerPart`.
4. **Tests.** Claude owns functional tests. Codex may add visual/layout tests (`layout.test.ts` contrast
   pairs, `racers.test.ts`, a Playwright fit check) and must keep every existing test green. **Never
   weaken, skip or delete a test to make a change pass**; report the failure instead.
5. **Rules change only through a decision.** A visual change that changes behaviour (what a pupil sees on
   the question, what is clickable, when something appears) needs a numbered `docs/DECISIONS.md` entry;
   Codex drafts it in the PR, Claude appends it.
6. **No new dependencies, no CDNs, no remote fonts or images.** Everything must work offline and be
   precached. Versions are pinned.
7. **Generated docs** (`docs/REPO-MAP.md`, `docs/CURRICULUM-MAPPING.md`) are never hand-edited: run
   `npm run docs:map` after adding/removing/renaming a file.
8. **Review.** Each agent reviews the other's PR for its own column: Claude checks that Codex's change kept
   behaviour, ids and tests; Codex checks that Claude's change kept the look, fit and accessibility.

## 4. Instructions for Codex: keep everything that works

### 4.1 DOM contracts that tests depend on (do not rename or remove)

- Every `data-testid` in `src/app/` (set as `dataset: { testid: ... }` or passed as an id to the
  `choice()`/`switchRow()` helpers in `controls.ts`). Examples: `menu-race`,
  `menu-practice`, `menu-teacher`, `setup-next`, `setup-home`, `step-1`..`step-3`, `year-1`/`year-2`,
  `topic-<id>`, `level-<n>`, `count-<n>`, `name-<i>`, `names-toggle`, `racer-<i>`, `racer-tile-<id>`,
  `mode-quick`/`mode-practice`, `length-<n>`, `sum-game`, `sum-questions`, `sum-players`, `game-save`,
  `start`, `skip-ready`, `pause`, `pause-overlay`, `stage`, `game-host`, `winner-banner`, `standings`,
  `evidence`, `toggle-evidence`, `delete-session`, `session-count`, `confirm-ok`, `lang-en`,
  `teacher-game`, `teacher-pupils`, `teacher-data`, `teacher-back`, `opt-<key>`, `confirm-dialog`,
  `export-csv`, `end-race`, `resume`, `again`, `new-setup`. Before and after a change, run
  `grep -rn "testid" src/app` and `grep -rhoE "getByTestId\([^)]*\)" e2e | sort -u` and check that every id
  the tests use is still produced (`src/tests/app.test.ts` selects by `[data-testid]` through its `q()`).
- Classes/attributes tests select: `.player-card`, `.racer-tile`, `.summary-racer`, `.preview-item`,
  `.toast-warn`, `.step-title` (focused on step change), `.topic-card`, `.level-card`, `.year-card`,
  `splash-still`/`splash-live`, `[data-splash-tagline]`, `[data-car]`, `[data-key]` (keeps focus after
  re-render), `input[name="topic"]`, `input[name="count"]`, `#splash`, `#game-host`, and the
  `reduce-motion` class on `<html>`.
- ARIA: keep `aria-current` (stepper), `aria-pressed`, `aria-label`, roles, heading levels and text
  ("Set up the race" heading is selected by name). Native inputs stay native (radio/checkbox) underneath any
  custom look.

### 4.2 Layout and accessibility limits

- Menu, every setup step and the teacher screen fit **without scrolling at 960x540**, and at 1024x600,
  1280x800, 1920x1080, in **BM and EN**, with 5 players and Year 2's eight topics (#41, #43).
- Text colours meet WCAG AA 4.5:1. If you change a colour pair in `app.css`, update the pairs in
  `src/tests/layout.test.ts` ("teacher-screen text and button colour pairs") and keep them passing.
- Selection is never shown by colour alone (check badge, #41). Focus ring only for keyboard focus.
- Touch targets stay large (number pad keys at least 40 px; the pad switches to 1-5 / 6-0 rows on short
  panels, which is decided in `game/widgets`, not in drawing code).
- `reduce-motion` (teacher setting, not the OS flag, #35) must stop CSS animation and canvas tweening;
  cars still move (their position is information).

### 4.3 Canvas (Phaser) limits

- The **pupil panel draws no text for the question** (#46): no words, numerals or unit labels in pictures
  or badges. `cues.test.ts` draws every picture through a recording context and fails on any text.
- The **picture is the question** (#49): the number of things drawn equals the answer. You may restyle a
  picture, but not add, remove, merge, hide or overlap counted objects, and counted things stay at least
  6 px on a 5-player panel at 960x540 (base-ten blocks 4-5 px; `countLayout.test.ts`).
- Player **colour + symbol + lane number** stay tied to the slot; animals keep natural colours with the
  player colour on scarf/badge (#39). Do not change `PLAYER_STYLES` colours without a contrast check.
- `racerShapes.ts`: the body stays within the car's reach (`CAR_TAIL`..`CAR_NOSE`) so the track marks line
  up (#34, #39); parts stay pure data (no Phaser/DOM imports) because the DOM SVG uses them too.
- `motion.ts`: time-based only (delta ms), never frame-counted; reduced motion snaps. Do not change when a
  car finishes or who wins (that is `RaceEngine`); only how it looks on the way.
- Keep frames inside `guardedFrame`; a throw kills the game loop. Reuse text through `TextPool`.
  Phaser Text with only `maxWidth` shrinks to fit; `maxHeight` wraps; never wrap narrower than a glyph.
- Do not move hit areas: e2e computes tap positions from `computeStageLayout`, `computePanelZones` and
  `createWidget`. A visual change that needs different key or panel geometry is a Claude change.

### 4.4 Never

- Persist player names, or send anything off the device.
- Add test hooks to the app (e2e reads the app's own pure modules instead).
- Change `Settings`, IndexedDB stores, `AttemptRecord`, `SessionMeta` or CSV columns.
- Commit `example.mp4` (it shows real pupils).

## 5. Regression risks (highest first)

1. **Renamed/removed `data-testid` or selected class** during a markup cleanup: breaks e2e silently until
   the 5-minute suite runs. Mitigation: the grep in 4.1, then `npx vitest run src/tests/app.test.ts`.
2. **Logic moved or dropped while rewriting a screen's markup** (Setup validation, racer conflict, dialog
   discard, setback visibility). Mitigation: edit only the `render`/`step*` bodies; `app.test.ts`.
3. **Picture count no longer equals the answer**, or text appears on the pupil panel, after restyling
   `VisualRenderer`/`shapes`. Mitigation: `cues.test.ts`, `countLayout.test.ts`, `curriculum.test.ts`.
4. **Overflow at 960x540** after a padding/font change, especially in EN and with 5 players. Mitigation:
   the "layout at classroom resolutions" e2e test.
5. **Multi-touch regressions** from touching `PanelView` input methods or hit areas. Mitigation: unit tests
   - the "multi-touch" describe in `e2e/mathracing.spec.ts`.
6. **Game loop crash** from a throw in new drawing code. Mitigation: `guardedFrame`, `watchErrors` in e2e.
7. **Offline break** from a new font/image/URL not in the precache. Mitigation: "offline and installability"
   e2e test; bundle assets locally.
8. **Contrast loss** after a palette change. Mitigation: `layout.test.ts` pairs.
9. **Track marks out of line** after racer shape changes. Mitigation: `racers.test.ts`,
   `trackGeometry.test.ts`, `e2e/cruise.spec.ts`.

## 6. Build and test commands

| When                               | Command                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| While working (changed files only) | `npm run check:fast`                                                                                                          |
| CSS / DOM screens                  | `npx vitest run src/tests/app.test.ts` then `npx playwright test e2e/mathracing.spec.ts -g "layout at classroom resolutions"` |
| Canvas pictures / badges           | `npx vitest run src/tests/cues.test.ts src/tests/countLayout.test.ts`                                                         |
| Racers / motion                    | `npx vitest run src/tests/racers.test.ts src/tests/motion.test.ts`                                                            |
| Colours                            | `npx vitest run src/tests/layout.test.ts`                                                                                     |
| Locale text                        | `npx vitest run src/tests/locales.test.ts`                                                                                    |
| Docs only                          | `npx prettier --check <file>`                                                                                                 |
| Before merging a multi-file change | `npm run check` then `npm run test:e2e`                                                                                       |
| Dev server                         | `npm run dev` (reads `PORT` if 5173 is taken)                                                                                 |

Done means: `npm run lint`, `npm run typecheck`, `npm test` green, `npm run test:e2e` green for anything
user-visible, docs updated, committed. Format only changed files: `npx prettier --write <files>`.

## 7. Recommended division of work (no refactor)

- **Now:** no code moves. The split above uses the files as they are; the mixed files are handled by the
  column rule in section 2.
- **Codex first tasks** (low risk, X files only): CSS polish in `app.css`, icon art in `art.ts` and
  `public/icons/`, canvas colours in `theme.ts`, track and celebration effects in `TrackView.ts`.
- **Claude first tasks:** logic, storage, curriculum and platform work as before; review Codex PRs for
  behaviour and test ids.
- **Only if mixed files keep causing conflicts** (not now): the smallest seams would be (a) moving
  `PanelView`'s press/release rule into a pure `panelInput.ts`, (b) moving `SetupScreen`'s step and
  validation rules into `setupState.ts`. Each would be its own plan in `docs/PLAN-<topic>.md` first.
