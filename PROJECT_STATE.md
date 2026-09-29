# PROJECT_STATE (read this first in a new session; then AGENTS.md is auto-loaded via CLAUDE.md)

Updated 2026-09-29. Latest change: question/picture/hint consistency audit (DECISIONS #44). Version 1.3.1
(Android versionCode 5) is packaged as a signed release APK.

## What exists

MathRacing: offline-first PWA maths racing game (2-5 pupils, one touchscreen, KSSR Year 1-2), built from
`Claude_Code_Opus_Super_Prompt_MathRacing_JS.pdf`. Phaser 4.2.1, TS 6.0.3, Vite 8, Vitest 5, Playwright 1.63,
Capacitor 6.2.2 (Android shell). 22 counting templates x 4 levels (number pad only), IndexedDB evidence + CSV export, PWA offline,
Android APK. Repo: `D:\UProject\ProjectAIVibeCode\MathRacing`.
Target hardware: Android tablets (1024x600 to 1920x1200) and TV smartboards (1920x1080 CSS px), landscape.

## Verified state (question consistency, 2026-09-29)

- `npm run check`: agents check, lint, typecheck, 559 unit tests and production/PWA build green.
- `npm run test:e2e`: 44/44 browser tests green, including the new Year 1 pictograph/measurement check at
  1024x600. Installed Chrome was used via `PLAYWRIGHT_CHANNEL=chrome`; run outside the restricted sandbox for
  clean preview-server teardown on this PC. The measuring-unit screenshot was visually inspected.
- Both languages fit at 960x540, 1024x600, 1280x800 and 1920x1080, including Year 2's eight topics and five players.
  One 960x540 question-screen screenshot was visually inspected; actual Android keyboard/navigation-bar testing
  and five-finger hardware validation remain outstanding.
- `npm run apk:release` produced `output/apk/MathRacing-1.3.1-20260929-1204-release.apk` (3,340,671 bytes;
  SHA-256 `3def7b7021df544e9e064231929bf34688d507a48b2f4c795c0d701905192183`). `apksigner` verified v1/v2
  signatures with the recorded release-key certificate; `aapt` verified package `my.edu.mathracing`, versionCode 5,
  versionName 1.3.1 and target SDK 34. Not yet installed on a physical Android device.
- Structure, commands, traps: `AGENTS.md`. File list: `docs/REPO-MAP.md`. Rationale: `docs/DECISIONS.md` (#1-#44).

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

## Questions: "Kira & taip" (DECISIONS #42, `docs/PLAN-easy-questions.md`)

- Every question = a picture to count + one whole number (0-999) on the number pad. Templates in
  `curriculum/generators/easyY1.ts` (10) and `easyY2.ts` (12), shared bits in `easyShared.ts`; packs 2.0.1.
  Old generators and the tiles/tap/order/build widgets are deleted.
- New visuals: `ten-frames`, `base-ten`, `equal-groups`, `ObjectGroup.crossed`, clock `fives`; layout in
  `game/ui/countLayout.ts`; `visualTotal()` in `visual.ts`. `hintVisual` (ten-frames) replaces the picture once the
  hint shows (PanelView). Number pad goes 1-5 / 6-0 / C+Hantar on short panels.
- Evidence: `SessionMeta.questionStyle='easy'`, CSV `question_style`.
- #44: Year 1 pictograph row names now match their drawn shape symbols; measurement prompts name the paper
  clips/blocks/cubes actually drawn; money hints mention only visible denominations. Curriculum property tests
  compare question, picture, answer and hint across all 22 templates in BM and EN.
- Known tight spot: Year 2 levels 3-4 block pictures on a 5-player small tablet (blocks ~4-5 px). If pupils struggle,
  lower `ARITH_HUNDREDS` in `easyY2.ts` or the blocks range.

## Menu look (DECISIONS #43, `docs/PLAN-simple-menus.md`)

- Tokens (`--r-sm/md/lg`, `--shadow-card/raised`, `--line`) at the top of `app.css`; buttons `.btn` (secondary),
  `.btn-primary`, `.btn-quiet` (dark header/footer), `.btn-text`; selected cards show a corner check badge
  (`.chip-on::after`). Nunito variable font in `src/app/styles/fonts/` (precached `woff2`).
- Compact navy headers, light content, static home menu, one primary next action. Setup: Soalan / Pemain / Sedia.
  Soalan combines year, short topic labels and a horizontal four-level selector. `pack-info` opens formal topic
  titles/codes/SK ranges and the full draft/version notice; Draf stays visible. Year 2 retains all eight topics.
- Pemain: `names-toggle` reveals optional name fields; entered names remain in memory only. Sedia has
  `sum-questions`, `sum-players`, `sum-game`; row edits return directly to review. `sum-game` opens a mode/length
  dialog; `game-save` applies, Batal/Esc discards changes. Existing racer selection and race behaviour remain.
- Teacher: `teacher-game`, `teacher-pupils`, `teacher-data` select one section at a time. Existing `opt-*` controls
  persist immediately; seed and local data are under Data & lanjutan. Storage warnings/PBD stay visible.
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
- Build PC: JDK 17 at `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`. The former SDK at
  `C:\Users\azrin\AppData\Local\Android\Sdk` is missing; use Unity's bundled SDK at
  `D:\Program Files\Unity\2022.3.62f3\Editor\Data\PlaybackEngines\AndroidPlayer\SDK` (platform 34, build-tools 34) by setting `ANDROID_HOME` for the release-build command. `local.properties` needs forward slashes; the shell
  does not search the current folder, so `gradlew.bat` is called by full path.
- Release (DECISIONS #40): `npm run apk:release` signs with `android/keystore.properties` (owner-made, git-ignored;
  README "Release APK"). Release key created 2026-09-24 at
  `C:/Users/azrin/mathracing-release.jks` (alias `mathracing`, CN=MathRacing, SHA-256 `a26b10a3...63d`); the password
  is only in `android/keystore.properties`. Owner must back up both files off this PC.
- Every release: raise `version` in `package.json` and `versionCode`/`versionName` in `android/app/build.gradle`
  (history: 1.0.0/1, 1.1.0/2 menu look, 1.2.0/3 Kira & taip, 1.3.0/4 simple menus, 1.3.1/5 question
  consistency), then `npm run apk:release`.
- `npm audit`: `tar` in `@capacitor/cli` (build-PC only, not in the APK); fix = Capacitor 8 (needs SDK 36, JDK 21).

## App flow (DECISIONS #35/#43)

Splash -> Main menu (Perlumbaan / Latihan, "Main semula", "Tetapan guru", BM/EN, Bantuan) -> Setup in 3 steps
(Soalan, Pemain, Sedia) or Teacher settings (sound, reduce motion, hints, support, cruise, setback when cruise
off, seed, local data, PBD notice). Shared in-memory `SetupState`; only `Settings` saved, never names or seed.
E2E helper `fillSetup` opens the required teacher section and the game edit dialog, and reveals names when needed.
It applies `options` in order: pass `cruise: false` **before** `setback` (the setback option only
appears when cruise is off). Step-race e2e tests pin `options: { cruise: false }`; `rocketNoseX` in `e2e/support.ts`
finds player 1's car nose for position checks. New spec: `e2e/cruise.spec.ts`.

## Not running / not done

- No dev server was started for this menu update; browser tests use a temporary preview server. Start development
  with `npm run dev`. Claude's in-app browser cannot animate: check animation
  in real Chrome or via Playwright.
- Owner has tested on a small Android tablet (photo of setup step 2, which led to #41) but has not reported on races
  with the new questions yet. Tablet model/size unknown; the owner keeps the Android navigation bar visible (no
  immersive mode). Possible follow-ups: keep-screen-on, pace tuning of `DEFAULT_CRUISE`, smaller Year 2 block ranges.
- Real five-finger hardware not validated: run `docs/MANUAL-TOUCH-TEST.md` on the target panel.
- Curriculum packs are `draft-pending-academic-review`; no SP codes exist (never invent them).
- Cooperative/team mode, clock-setting widget, shape drawing, Year 1 "2027 pack" not built. No animal sounds (owner: no).

## Owner preferences (how to work with them)

- "Provide md first / don't execute": write `docs/PLAN-<topic>.md`, commit, stop, list decisions D1..Dn with a
  recommendation. "proceed"/"start" = implement with the recommended options (or the answers given).
- Wants low token use and no repeated work: follow the "cheapest check" table in `AGENTS.md`; read ranges, not whole files.
- Commits: one per logical step, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Cares that animation is visible on tablets/smartboards; verify visual changes with Playwright screenshots.
- Deliver builds as a signed release APK (`npm run apk:release`), sent as a file.
- Pronouns: use they/them unless stated.

## Likely next requests (none started)

- Feedback from races on the tablet and smartboard: question difficulty and ranges, keypad size, pace, colours.
- Restyling the race and results screens to match the simpler menus (#43 covered menu screens only).
- Play Store or managed install; Capacitor 8 upgrade.
- Manual touch protocol; curriculum review.
