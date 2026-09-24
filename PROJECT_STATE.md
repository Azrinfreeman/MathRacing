# PROJECT_STATE (read this first in a new session; then AGENTS.md is auto-loaded via CLAUDE.md)

Updated 2026-09-24. Working tree clean at the time of writing; latest feature: racer choice (DECISIONS #39).

## What exists

MathRacing: offline-first PWA maths racing game (2-5 pupils, one touchscreen, KSSR Year 1-2), built from
`Claude_Code_Opus_Super_Prompt_MathRacing_JS.pdf`. Phaser 4.2.1, TS 6.0.3, Vite 8, Vitest 5, Playwright 1.63,
Capacitor 6.2.2 (Android shell). 77 templates x 4 levels, 5 widgets, IndexedDB evidence + CSV export, PWA offline,
Android APK. Repo: `D:\UProject\ProjectAIVibeCode\MathRacing`.
Target hardware: Android tablets (1024x600 to 1920x1200) and TV smartboards (1920x1080 CSS px), landscape.

## Verified state (last full run, after the latest commits)

- `npm run check`: agents check, lint, typecheck, 1002 unit tests, build all green.
- `npm run test:e2e`: 37/37 green (about 7 min).
- `npm run apk`: builds `output/apk/MathRacing-<version>-<date>-debug.apk` (git-ignored). Last one:
  `MathRacing-1.0.0-20260924-0857-debug.apk`, sent to the owner. Not yet run on a real Android device here
  (no device or emulator connected to this PC).
- Structure, commands, traps: `AGENTS.md`. File list: `docs/REPO-MAP.md`. Rationale: `docs/DECISIONS.md` (#1-#41).

## How the race works now (DECISIONS #36-#37, plans `docs/PLAN-cruise-boost.md`, `docs/PLAN-idle-crawl.md`)

- **Cruise movement is the default** (teacher toggle `opt-cruise` / setting `cruiseEnabled`, default true). Every car
  drives forward at the same pace; answers change speed, not position. Applies to Quick Race **and** Practice
  (Practice: no winner, ends when all cars arrive).
- Numbers in `src/game/core/cruise.ts` `DEFAULT_CRUISE` (tune after a classroom try): cruise 1 step / 15 s; correct =
  boost of exactly +1 step over 1.2 s (boosts add up, cancels a slow-down); wrong = 30% speed for 2.5 s (restarts,
  never stacks, never backwards); **idle crawl**: 10 s without a submitted answer -> 20% speed until the next answer
  (any answer or asking for a simpler item ends it; pause never counts). Idle 8-step race ~9.5 min.
- Engine: `PlayerRaceState.distance` (fractional, truth) and `progress = floor(distance)`. Speed is piecewise
  constant, so `advanceCruise` is exact and gives exact crossing times; finishing happens in `tick`, earliest crossing
  wins; crossings within 1 us are a tie -> more correct, then earlier last correct, then slot order.
  Events `boost`, `slowed`, `crawling`; `engine.speedState(id)`: cruise/boost/slow/crawl/stopped.
- Step race (cruise off) is unchanged and still has the setback rule (#30, `opt-setback` shown only when cruise off).
- Visuals: `CarMotion.follow` (no settle snapping while cruising); boost = long flame, exhaust, speed lines; slow =
  nose-down + neutral dust; crawl = no flame/puffs. Private panel texts: "Betul! Laju!", "Perlahan sikit. Cuba lagi!",
  "Jawab untuk memecut!" (kept off if a hint is showing). Reduced motion still moves cars + static ring.
- Evidence: CSV column `speed_effect` (boost/slow/none); `stepDelta` +1 on correct; `progressAfter` = distance
  (2 dp) in cruise; `SessionMeta.movement`.
- BM pause wording: "Jeda" replaced by "Henti" / "berhenti" / "dihentikan seketika".

## Menu look (DECISIONS #41, `docs/PLAN-menu-polish.md`)

- Tokens (`--r-sm/md/lg`, `--shadow-card/raised`, `--line`) at the top of `app.css`; buttons `.btn` (secondary),
  `.btn-primary`, `.btn-quiet` (dark header/footer), `.btn-text`; selected cards show a corner check badge
  (`.chip-on::after`). Nunito variable font in `src/app/styles/fonts/` (precached `woff2`).
- Step 2: pack chip `pack-info` opens the full draft notice; levels are a list. Teacher: `switchRow()` in
  `controls.ts` (checkbox role switch, still `opt-*` test ids), three columns.
- Smallest no-scroll size 960x540 (owner keeps the Android nav bar). Tablet model unknown: ask for its size if a
  screen still scrolls there.

## Racer choice (DECISIONS #39, `docs/PLAN-racer-choice.md`)

- Pemain step: tap a player's racer picture -> sheet with 5 vehicles (rocket, kart, wedge, saucer, block) and
  5 animals (duck, goose, chicken, turtle, rabbit). A racer held by another active player is greyed out. Colour,
  symbol and lane number stay per slot; defaults = the old fixed vehicles.
- `core/racers.ts`: catalogue (ids are stable: saved and exported), `takenRacers`, `resolveRacers` (no clashes among
  active seats). `ui/racerShapes.ts`: every racer as pure parts drawn by `TrackView` (Phaser) and `art.ts racerSvg`.
  Animals: natural colours, player colour on a scarf + ringed badge, gait from distance travelled, wing flap on boost.
- Saved per seat in `Settings.racers` (never with names). `SessionMeta.playerRacers` (optional: older sessions lack
  it), CSV column `racer` before `parameters_json`; results and evidence show the racer.
- E2E: `fillSetup` option `racers: ['duck', ...]`; `rocketNoseX(page, geo, 'beak')` finds a duck/goose beak.

## Android APK (DECISIONS #38)

- `android/` Capacitor 6 project (committed; `android/app/src/main/assets/public`, `build/`, `local.properties` are
  git-ignored), `capacitor.config.json` (appId `my.edu.mathracing`), `scripts/build-apk.mjs` (`npm run apk`).
- Landscape (`sensorLandscape`), full screen, icon from `public/icons/icon-192.png`, navy launch colour.
- Service worker is not registered inside the native app (`window.Capacitor.isNativePlatform()` in `src/main.ts`).
- Build PC: JDK 17 at `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`, SDK at
  `C:\Users\azrin\AppData\Local\Android\Sdk` (platform 34, build-tools 34). Traps: `local.properties` needs forward
  slashes; the shell does not search the current folder, so `gradlew.bat` is called by full path.
- Release (DECISIONS #40): `npm run apk:release` signs with `android/keystore.properties` (owner-made, git-ignored;
  README "Release APK"). Release key created 2026-09-24 at
  `C:/Users/azrin/mathracing-release.jks` (alias `mathracing`, CN=MathRacing, SHA-256 `a26b10a3...63d`); the password
  is only in `android/keystore.properties`. First release APK: `MathRacing-1.0.0-20260924-2053-release.apk`.
  Owner must back up both files off this PC.
- `npm audit`: `tar` in `@capacitor/cli` (build-PC only, not in the APK); fix = Capacitor 8 (needs SDK 36, JDK 21).

## App flow (DECISIONS #35, `docs/PLAN-splash-menu-setup.md`)

Splash -> Main menu (Main / Latihan, "Main semula", "Tetapan guru", BM/EN, Bantuan) -> Setup in 4 steps (Tahun,
Topik & Tahap, Pemain, Sedia?) or Teacher settings (sound, reduce motion, hints, support, cruise, setback when cruise
off, seed, local data, PBD notice). Shared in-memory `SetupState`; only `Settings` saved, never names or seed.
E2E helper `fillSetup` applies `options` in order: pass `cruise: false` **before** `setback` (the setback option only
appears when cruise is off). Step-race e2e tests pin `options: { cruise: false }`; `rocketNoseX` in `e2e/support.ts`
finds player 1's car nose for position checks. New spec: `e2e/cruise.spec.ts`.

## Not running / not done

- **Dev server is not running.** Start with `npm run dev`. Claude's in-app browser cannot animate: check animation
  in real Chrome or via Playwright.
- Owner has not reported results from the APK on a tablet/smartboard yet. Possible follow-ups: navigation bar still
  visible on some devices (immersive mode), keep-screen-on, pace tuning of `DEFAULT_CRUISE`.
- Real five-finger hardware not validated: run `docs/MANUAL-TOUCH-TEST.md` on the target panel.
- Curriculum packs are `draft-pending-academic-review`; no SP codes exist (never invent them).
- Cooperative/team mode, clock-setting widget, shape drawing, Year 1 "2027 pack" not built. No animal sounds (owner: no).

## Owner preferences (how to work with them)

- "Provide md first / don't execute": write `docs/PLAN-<topic>.md`, commit, stop, list decisions D1..Dn with a
  recommendation. "proceed"/"start" = implement with the recommended options (or the answers given).
- Wants low token use and no repeated work: follow the "cheapest check" table in `AGENTS.md`; read ranges, not whole files.
- Commits: one per logical step, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Cares that animation is visible on tablets/smartboards; verify visual changes with Playwright screenshots.
- Deliver test builds as an APK (`npm run apk`), sent as a file.
- Pronouns: use they/them unless stated.

## Likely next requests (none started)

- Feedback from testing the APK on the tablet and smartboard; tuning pace, sizes, colours.
- Release signing / Play Store or managed install; Capacitor 8 upgrade.
- Manual touch protocol; curriculum review.
