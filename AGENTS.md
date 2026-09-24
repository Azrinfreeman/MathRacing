# MathRacing: agent briefing

Offline-first PWA maths racing game, 2-5 pupils on one touchscreen, KSSR Year 1-2 (Malaysia).
Phaser 4.2.1 + TypeScript 6.0.3 (pinned, do not bump) + Vite 8 + Vitest 5 + Playwright 1.63.
Hard rules: works fully offline; no pupil data leaves the device; player names are never persisted in settings.
Full file list with exports: `docs/REPO-MAP.md` (generated). Rationale for every rule: `docs/DECISIONS.md`.

## Where things live (open only what the task needs)

- `src/game/core/` pure rules: `RaceEngine`, `RaceState` (types, config, events), state machine, input ownership. No Phaser/DOM.
- `src/game/ui/` drawing: `TrackView` (track, cars, particles), `PanelView` (pupil panel), `motion.ts` (car spring), layout (pure).
- `src/game/scenes/` Phaser scenes (`ReadyScene`, `RaceScene`, `StageScene`). Frames run inside `guardedFrame`.
- `src/curriculum/` schema, answers, blueprint, registry; `generators/` one file per topic group; `packs/`.
- `src/app/` `AppController` (flow, persistence), `setupState` (shared choices), `screens/` Splash, Menu, Setup (4 steps), Teacher, Results; dialogs, help, `art.ts` (inline SVG).
- `src/storage/` settings (localStorage) and evidence (IndexedDB). `src/reporting/` CSV and teacher evidence summary.
- `src/locales/` `bm.ts` (complete: write here first), `en.ts` (falls back to BM per key).
- `docs/` ARCHITECTURE, DECISIONS (append-only, numbered), CURRICULUM-MAPPING and REPO-MAP (both generated: never hand-edit), PLAN-\* (past plans).
- Task to files:
  - race rule: `RaceEngine` + `RaceState` + `raceEngine.test.ts`
  - new teacher option: `storage/settings.ts` + `setupState` + `TeacherScreen` + both locales + `storage.test.ts`
  - new attempt field: `RaceState` + `RaceEngine.log` + `reporting/exportCsv` + `storage.test.ts` fixtures
  - new template: `generators/easyY1.ts` / `easyY2.ts` (picture to count + one whole number, DECISIONS #42) + `curriculum.test.ts`, then `npm run docs:curriculum`
  - racer visuals: `ui/racerShapes.ts` (parts drawn by both `TrackView` and `app/art.ts`) + `motion.ts` + `racers.test.ts` / `motion.test.ts`; catalogue in `core/racers.ts`

## Commands: run the cheapest one that proves your change

| Changed                                      | Run                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| docs only                                    | `npx prettier --check <file>`                                                                                  |
| any code, while working                      | `npm run check:fast` (changed files only: typecheck, eslint, `vitest related`, prettier; prints only failures) |
| pure logic, storage, reporting               | `npx vitest run src/tests/<file>` then `npm run typecheck`                                                     |
| locale string                                | `npx vitest run src/tests/locales.test.ts`                                                                     |
| Phaser drawing or scenes                     | `check:fast`, then `npx playwright test e2e/<file> -g "<title>"` (at most one screenshot)                      |
| Setup/Results DOM                            | `npx vitest run src/tests/app.test.ts`, then the relevant Playwright test                                      |
| input / multi-touch                          | its unit tests + the "multi-touch" describe in `e2e/mathracing.spec.ts`                                        |
| before committing a multi-file change (once) | `npm run check` then `npm run test:e2e`                                                                        |
| added, removed or renamed a file             | `npm run docs:map`                                                                                             |

Unit tests take about 13 s; the full e2e suite about 5 min. Playwright rebuilds `dist/` only when it is older than the
sources (`E2E_REBUILD=1` forces it). Format only what you changed: `npx prettier --write <files>`, not the whole repo.

## Traps (each already cost a debug round)

- An uncaught throw inside a Phaser frame kills the game loop: keep frames in `guardedFrame`. Text with only `maxWidth` shrinks to fit; `maxHeight` wraps. Never wrap narrower than a glyph.
- Phaser cannot init in jsdom: `createGame` is dynamically imported and app tests inject a fake game.
- `RaceEngine` takes time as `atMs`; never read a clock inside it.
- The next question index is `itemsDealt`, not progress (progress drops after a setback).
- Use `0 - n`, not `-n`, when the value may be 0 (avoids `-0`).
- E2E computes questions and tap positions from the app's own pure modules (blueprint, layout, widgets). Keep them pure; do not add test hooks to the app.
- Claude's in-app browser pane cannot animate (no rAF). Use Playwright for anything timed or visual.
- Windows + Git Bash: use `/d/...` paths, never `cd` into `node_modules`, create files with the Write tool (nested-quote heredocs break).
- Dev port 5173 may be taken: `vite.config.ts` reads `PORT` and `.claude/launch.json` has `autoPort`.
- Curriculum packs are drafts: never invent SP codes. Money is integer sen.
- Adding a field to `AttemptRecord` or `SessionMeta` breaks fixtures in `storage.test.ts` and needs a CSV column decision.

## How to work (saves tokens)

- Read line ranges, not whole files. Do not re-read a file you just edited. Look in `docs/REPO-MAP.md` before grepping.
- Show command output only when it fails; report results in one or two lines.
- Screenshots only for visual changes, and read only the one that matters. Prefer DOM or IndexedDB assertions.
- Batch independent tool calls. Do not re-run a check the last green run already covered.
- "Provide md first / don't execute" means: write `docs/PLAN-<topic>.md`, commit it, and stop.
- A changed rule adds a numbered entry to `docs/DECISIONS.md` and updates README/help text.
- One commit per logical step. Never commit `example.mp4` (it shows real pupils).

## Done means

`npm run lint`, `npm run typecheck`, `npm test` green; `npm run test:e2e` green for anything user-visible; docs updated; committed.
