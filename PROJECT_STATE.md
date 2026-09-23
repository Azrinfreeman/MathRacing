# PROJECT_STATE (read this first in a new session; then AGENTS.md is auto-loaded via CLAUDE.md)

Updated 2026-09-24. Working tree clean at the time of writing; last code commit `fcf7c3b`.

## What exists

MathRacing: offline-first PWA maths racing game (2-5 pupils, one touchscreen, KSSR Year 1-2), built from
`Claude_Code_Opus_Super_Prompt_MathRacing_JS.pdf`. Phaser 4.2.1, TS 6.0.3, Vite 8, Vitest 5, Playwright 1.63.
77 templates x 4 levels, 5 widgets, IndexedDB evidence + CSV export, PWA offline. Repo: `D:\UProject\ProjectAIVibeCode\MathRacing`.
Target hardware: Android tablets (1024x600 to 1920x1200) and TV smartboards (1920x1080 CSS px), landscape.

## Verified state (last full run, after the latest commits)

- `npm run check`: agents check, lint, typecheck, 943 unit tests, build all green.
- `npm run test:e2e`: 29/29 green (about 5 min).
- Structure, commands, traps: `AGENTS.md`. File list: `docs/REPO-MAP.md`. Rationale: `docs/DECISIONS.md` (#1-#35).

## App flow now (DECISIONS #35, `docs/PLAN-splash-menu-setup.md`)

Splash (inline in `index.html`, `screens/SplashScreen.ts`; preloads Phaser; moves on by itself after >= 1.5 s,
6 s cap, once per tab) -> Main menu (`MenuScreen`: Main / Latihan cards, "Main semula" when a setup exists,
"Tetapan guru" corner, BM/EN, Bantuan) -> Setup in 4 steps (`SetupScreen`: Tahun, Topik & Tahap, Pemain, Sedia?;
stepper jumps to any step) or Teacher settings (`TeacherScreen`: sound, reduce motion, hints, support, setback,
seed, local data, PBD notice; no lock). All share one in-memory `SetupState` (`app/setupState.ts`); only
`Settings` are saved, never names or the seed. Exits from a race / "Persediaan Baharu" return to setup step 4.
These are app screens inside the `SETUP` phase; the race state machine is unchanged.
E2E helper `fillSetup` walks menu -> teacher (seed, `options`) -> 4 steps; ends on step 4 with `start` visible.
All old `data-testid`s were kept; new ones: `menu-race|practice|again|teacher`, `menu-sessions`, `step-1..4`,
`setup-next|back|home`, `teacher-back`, `sum-*`.

## Features added in the latest sessions (all committed)

1. Countdown freeze fix (`guardedFrame`, text wrap rules).
2. **Setback rule** (DECISIONS #30-31): Quick Race only, 3rd wrong answer = back 1 step, once per question, never below 0; on by default (now in Tetapan guru, `opt-setback`).
3. **Car animation** (#32): `motion.ts` spring. `FORWARD_RATE` raised 12 -> 16 (snappier), `BACKWARD_RATE` 7.
4. **Animation on by default** (#33): the OS reduced-motion flag is no longer inherited (it silently disabled animation on the owner's PC); old saved settings get the flag reset once (settings `revision: 2`). #35 extends this to the page CSS: the teacher's setting (`html.reduce-motion`) is the only switch.
5. **Track geometry** (#34): `game/ui/trackGeometry.ts` (pure). Start line, step marks and finish chequer are positions of the car's nose; margins from lane height with px limits. E2E checks the nose on mark 1 at 2560x1440.
6. **Splash, main menu, 4-step setup, teacher screen** (#35), inline SVG art in `app/art.ts` (same vehicle coordinates as `TrackView`).
7. Tooling: `AGENTS.md`, `CLAUDE.md`, `docs:map`, `docs:agents`, `check:fast`, e2e rebuilds `dist/` only when stale.

## Not running / not done

- **Dev server is not running.** Start with `npm run dev`. The owner rejected `preview_start` earlier, so do not call it unless asked. Claude's in-app browser cannot animate: check animation in real Chrome or via Playwright.
- The owner has not yet looked at the new splash/menu/setup in a real browser or on a tablet/smartboard.
- No native Android build (APK/TWA/Capacitor); it is a PWA installable from Chrome. Offer a plan if asked.
- Real five-finger hardware not validated: run `docs/MANUAL-TOUCH-TEST.md` on the target panel.
- Curriculum packs are `draft-pending-academic-review`; no SP codes exist (never invent them).
- Cooperative/team mode, clock-setting widget, shape drawing, pupil-chosen vehicles, Year 1 "2027 pack" not built.

## Owner preferences (how to work with them)

- "Provide md first / don't execute": write `docs/PLAN-<topic>.md`, commit, stop, list decisions D1..Dn with a recommendation. "start" = implement with the recommended options (or the answers given).
- Wants low token use and no repeated work: follow the "cheapest check" table in `AGENTS.md`; read ranges, not whole files.
- Commits: one per logical step, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only when asked or as part of an approved plan.
- Cares that animation is visible on tablets/smartboards; verify visual changes with Playwright screenshots.
- Pronouns: use they/them unless stated.

## Likely next requests (none started)

- Feedback on the new menu/setup look after trying it; tuning sizes/colours on the real smartboard.
- Android packaging (TWA or Capacitor) for tablets / TV smartboards.
- Manual touch protocol; curriculum review; animation feel (`FORWARD_RATE` / `BACKWARD_RATE` in `motion.ts`).
