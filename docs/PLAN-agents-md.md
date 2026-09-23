# Implementation plan: AGENTS.md for token-efficient, non-repetitive work

Status: **implemented** (decisions D1-D6 all taken as recommended). Beyond the plan: `scripts/check-agents.mjs` (`npm run docs:agents`, part of `npm run check`) keeps AGENTS.md accurate; e2e rebuilds `dist/` only when it is older than the sources (`E2E_REBUILD=1` forces it); no LF-normalising commit was needed because the repo was already LF, only `.gitattributes` and local git config changed.

## 1. Goal

Make every future session on MathRacing cheaper and faster by giving the AI agent (and any human) one short, accurate, always-loaded briefing, plus a few small tooling changes so the _cheapest correct check_ is also the _easiest one to run_. Concretely:

1. **Fewer tokens spent re-learning the project** (structure, conventions, traps already hit).
2. **No repeated work** (re-reading big files, re-running the 5-minute suite for a one-line change, re-deriving decisions already recorded, re-fixing traps already fixed).
3. **Less noise in tool output** (long logs, CRLF warnings, file-change dumps, screenshots read for no reason).
4. **Same quality bar** (lint, typecheck, unit, e2e stay green; nothing is skipped, only run at the right time and scope).

## 2. Where the tokens and time went (observed in this project)

| #   | Waste                                                                                                                                                                                                                           | Evidence                                                                                                                        | Cost                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| W1  | Re-reading large files after a context reset, or to edit one line                                                                                                                                                               | `RaceEngine.ts` (537 lines), `TrackView.ts` (703), `SetupScreen.ts` (767), `PanelView.ts` (703) were read in full several times | thousands of tokens each time |
| W2  | Exploring by grep/glob to find where something lives                                                                                                                                                                            | e.g. locating settings, sound, evidence, CSV columns for the setback feature                                                    | 5-10 tool calls per feature   |
| W3  | Running the whole e2e suite (24 tests, ~4.7 min, includes a production build) when only one spec was relevant, or running everything after every small edit                                                                     | full run for a docs-only change is pure waste                                                                                   | minutes + output tokens       |
| W4  | Long command output pulled into context (`tail -40` of a passing run, test logs, `git` CRLF warnings on every commit)                                                                                                           | every commit prints 10+ "LF will be replaced by CRLF" lines                                                                     | steady token drip             |
| W5  | Re-hitting traps already solved: Phaser loop dying on an uncaught throw, `maxWidth` vs `maxHeight` text semantics, Phaser cannot init in jsdom, wrong-answer `-0`, port 5173 already in use, in-app browser pane cannot animate | each cost a debugging round                                                                                                     | a full debug loop each time   |
| W6  | Tooling friction: script-based file rewrites (change-notification dumps of whole files), a `cd` into `node_modules` changing the working directory, bash heredocs with nested quotes failing, Prettier run over everything      | several failed or noisy calls                                                                                                   | retries                       |
| W7  | Decisions re-litigated because the summary, not the repo, held them                                                                                                                                                             | after each context compaction the "why" had to be rebuilt                                                                       | re-derivation                 |
| W8  | Visual verification via full-page screenshots when a DOM/IndexedDB assertion would do                                                                                                                                           | screenshots are expensive to read                                                                                               | image tokens                  |

## 3. What the plan delivers

### 3.1 `AGENTS.md` (repo root), the core deliverable

Short (target **under 150 lines, about 1.5-2k tokens**) because it is loaded into every session. It states rules and points to files; it never copies code or long explanations (those live in `docs/`). Sections:

1. **Project snapshot** (3-4 lines): what it is, stack with the pinned versions that matter, the two hard product rules (offline-first, no pupil data leaves the device).
2. **Repo map**: one line per folder/key file saying what lives there and what to open for common tasks ("add a topic template" -> `src/curriculum/generators/*` + `packs/`; "change the race rules" -> `src/game/core/RaceEngine.ts` + `RaceState.ts`; "change a setting" -> `storage/settings.ts` + `SetupScreen.ts` + both locale files). This kills W2.
3. **Commands and the "smallest sufficient check" table** (kills W3): a table mapping _what you changed_ to _the cheapest command that proves it_ (section 4).
4. **Conventions**: Prettier after edits, absolute paths, prefer `Edit`/`Write` over script rewrites, no test hooks in the app (e2e computes questions from the app's own pure modules), time is passed into the engine as `atMs`, every user-visible string exists in `bm.ts` first then `en.ts`, decisions are append-only in `docs/DECISIONS.md`.
5. **Known traps** (kills W5): a compact list, one line each, with the file that holds the fix (section 5).
6. **Token and effort rules for the agent** (kills W1, W4, W8): read ranges not whole files, quote command output only when it fails, no screenshot unless the change is visual, don't re-verify what the last green run already proved, batch independent calls, don't re-read a file you just edited.
7. **Workflow rules**: plan-first when the user says "provide md first", one commit per step with the trailer the harness gives, update `docs/DECISIONS.md` when a rule changes, never commit `example.mp4`.
8. **Definition of done**: which checks must be green for which kind of change; what to report (results, not narration).
9. **Do-not-touch / generated files**: `docs/CURRICULUM-MAPPING.md` (generated), `dist/`, `test-results/`, `e2e/screenshots/`, `example.mp4`, lockfile pins.

A full draft is in Appendix A so you can review the actual wording before anything is written.

### 3.2 `CLAUDE.md` (root, 2 lines)

Claude Code loads `CLAUDE.md`, not `AGENTS.md`, natively (`AGENTS.md` is the cross-tool convention used by other agents). To have one source of truth, `CLAUDE.md` will contain just `@AGENTS.md` (an import) plus nothing else, so there is no duplication to drift.

### 3.3 Small tooling changes that make the cheap path the easy path

All optional individually; each maps to a waste above.

| Change                                                                                                                                                                                                                                                                                                   | What                                                                                                                                                                                           | Kills  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `npm run check:fast`                                                                                                                                                                                                                                                                                     | `tsc --noEmit` + `eslint` on changed files + `vitest related` for changed files (about 10-20 s)                                                                                                | W3     |
| `npm run test:e2e:only -- <name>` docs, and `E2E_REUSE=1` support in `playwright.config.ts`                                                                                                                                                                                                              | skip the build when `dist/` is already fresh and a preview server is up; a `dist` freshness check (compare newest `src` mtime to `dist/index.html`) so a stale bundle is never tested silently | W3     |
| `npm run test:e2e:setback` style aliases are **not** added; instead the table in AGENTS.md lists `npx playwright test e2e/<file> -g "<title>"`                                                                                                                                                           | keep scripts few                                                                                                                                                                               | W3     |
| Quiet git output                                                                                                                                                                                                                                                                                         | set `core.autocrlf=false` / `core.safecrlf=false` for this repo (or add `* text=auto eol=lf` handling in `.gitattributes` and normalise once) so commits stop printing CRLF warnings           | W4     |
| `.claude/settings.json` with `permissions.allow` for the safe recurring commands (`npm run lint/typecheck/test/format`, `npx vitest`, `npx playwright test`, `npx prettier`, read-only `git` commands) and `permissions.deny` for reading `node_modules/**`, `dist/**`, `test-results/**`, `example.mp4` | fewer approval round-trips; nothing heavy read by accident                                                                                                                                     | W1, W6 |
| `docs/REPO-MAP.md` generated by `scripts/gen-repo-map.mjs` (`npm run docs:map`): every source file, its line count and its exported names                                                                                                                                                                | one cheap read replaces many greps; regenerated, never hand-edited                                                                                                                             | W2     |
| `.vscode`-free: no editor config added                                                                                                                                                                                                                                                                   | out of scope                                                                                                                                                                                   |        |

### 3.4 What is deliberately **not** included

- No auto-generated summaries of code inside `AGENTS.md` (they go stale; the repo map covers this and is regenerated).
- No rule that skips the full suite before a release/commit of risky changes. The saving comes from _scoping during work_ and running the full suite _once at the end_.
- No changes to product code.

## 4. The "smallest sufficient check" table (goes into AGENTS.md)

Measured today: `npm test` about 13 s (833 tests), full e2e about 4.7 min.

| You changed                                                    | Run                                                                                                        | Full suite needed? |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| Docs, README, comments only                                    | `npx prettier --check <file>`                                                                              | No                 |
| A locale string                                                | `npm run typecheck` + `npx vitest run src/tests/locales*`                                                  | No                 |
| Pure logic (`game/core`, `curriculum`, `storage`, `reporting`) | `npx vitest run <the matching test file>`, then `npm run typecheck` and `npm run lint`                     | No                 |
| A curriculum template                                          | `npx vitest run src/tests/templates*` (property tests) + `npm run docs:curriculum` if titles/codes changed | No                 |
| Phaser drawing (`game/ui`, `game/scenes`)                      | typecheck + lint + unit, then the single relevant Playwright spec with `-g` and **one** screenshot         | Only at the end    |
| Setup/Results DOM (`app/`)                                     | `npx vitest run src/tests/app.test.ts` then the relevant Playwright test                                   | Only at the end    |
| Input/multi-touch (`PointerRouter`, `InputOwnership`)          | its unit tests + the multi-touch describe in Playwright                                                    | Only at the end    |
| Before committing a multi-file feature                         | `npm run check` then `npm run test:e2e` once                                                               | **Yes, once**      |

## 5. Known traps to record (each is one line in AGENTS.md)

1. TypeScript is pinned at 6.0.3 (typescript-eslint caps below 6.1). Do not bump it.
2. An uncaught exception inside a Phaser frame stops the whole game loop. Scene frames must go through `guardedFrame`; never call Phaser text APIs with a wrap width narrower than a glyph (`maxWidth` only = shrink-to-fit, `maxHeight` = wrap).
3. Phaser cannot initialise in jsdom: `createGame` is imported dynamically; app tests inject a fake game.
4. Race timing is passed in (`atMs`); never read the clock inside `RaceEngine`.
5. Question index comes from `itemsDealt`, not progress (progress can go down after a setback).
6. `-0` in records: subtract from `0` (`0 - n`) rather than negating.
7. Evidence attempts in IndexedDB are ordered by `compareAttempts`; new record fields must also be added to `storage.test.ts` fixtures and the CSV columns.
8. Player names are never stored in localStorage settings.
9. E2E tests use the app's own pure modules (blueprint, layout, widgets) to compute taps: keep those modules pure and importable from Node.
10. Claude's in-app browser pane cannot animate (`document.hidden`, no rAF): use Playwright for anything visual or timed.
11. Windows + Git Bash: use `/d/...` paths in bash; do not `cd` into `node_modules`; write multi-line files with the Write tool, not nested-quote heredocs.
12. Port 5173 may already be in use; the dev server config reads `PORT` and `.claude/launch.json` has `autoPort`.
13. New wording goes into `bm.ts` first (it is the complete locale), then `en.ts` (falls back to BM per key).
14. Curriculum packs are drafts: do not invent SP codes.

## 6. Work breakdown

| Step | Work                                                                                                                                                              | Size         | Commit                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------ |
| 1    | Write `AGENTS.md` from Appendix A (adjusted by your answers); add `CLAUDE.md` import                                                                              | small        | "Add AGENTS.md agent briefing" |
| 2    | `scripts/gen-repo-map.mjs` + `npm run docs:map` + `docs/REPO-MAP.md`; add the "regenerate after adding/removing files" rule                                       | small        | "Add generated repo map"       |
| 3    | `check:fast` script (changed-file lint/typecheck/`vitest related`); e2e reuse/fresh-dist support in `playwright.config.ts`; document both in AGENTS.md and README | small-medium | "Add fast check and e2e reuse" |
| 4    | Quiet git CRLF warnings (`.gitattributes`/repo config, one normalising commit if needed)                                                                          | small        | "Normalise line endings"       |
| 5    | `.claude/settings.json` allow/deny lists (only after you approve the exact list)                                                                                  | small        | "Add Claude Code permissions"  |
| 6    | Verify: fresh session dry run (see section 8), tighten AGENTS.md to stay under the size cap                                                                       | small        | "Trim AGENTS.md after dry run" |

Each step is independent, so any can be dropped without breaking the others. Steps 1 and 2 give most of the benefit.

## 7. Decisions needed from you

| #   | Question                                                                                                                               | Recommendation                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `AGENTS.md` + a `CLAUDE.md` that just imports it, or `AGENTS.md` only?                                                                 | Both (Claude Code reads `CLAUDE.md`; other agents read `AGENTS.md`; one source).                                                                  |
| D2  | Allow me to add `.claude/settings.json` permission allow/deny rules (section 3.3)? They change what runs without asking you.           | Yes for the read-only and test commands listed; you review the exact JSON first. `deny` on `node_modules`, `dist`, `test-results`, `example.mp4`. |
| D3  | Normalise line endings to LF for the whole repo (one large "whitespace" commit) to silence git warnings?                               | Yes, one commit, done last so it does not muddy history. Alternative: only set `core.safecrlf=false` locally (no big commit).                     |
| D4  | Add `check:fast` and e2e reuse (Step 3)?                                                                                               | Yes.                                                                                                                                              |
| D5  | Language of `AGENTS.md`: English only (recommended, agents and tooling work best) or bilingual with BM?                                | English only; product strings stay BM/EN as they are.                                                                                             |
| D6  | Should AGENTS.md require a plan `.md` before any change above a size threshold (as you have asked each time), or only when you say so? | Only when you say so; otherwise just do small changes. Record your "provide md first, don't execute" phrasing as the trigger.                     |

## 8. How we will know it works

Token counts are not observable from inside the repo, so use proxies on a fixed set of three sample tasks (a locale string change, a new setting through Setup, a template tweak), before and after:

- **Tool calls to first correct edit** (target: at least 40% fewer, because the repo map and file table remove exploration).
- **Wall time of the verification step** (target: under 30 s for pure-logic changes, using `check:fast`).
- **Repeated reads of the same file in one session** (target: zero).
- **AGENTS.md size** stays under 150 lines; a script check (`scripts/check-agents.mjs`, optional) confirms every `npm run` command and file path mentioned in it exists, so it cannot silently rot.

## 9. Risks

| Risk                                                          | Mitigation                                                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| AGENTS.md goes stale and misleads                             | keep it to rules and pointers; generated repo map; optional existence-check script; review it whenever `DECISIONS.md` gets a new entry |
| "Skip the full suite" leads to a missed regression            | the table always ends with one full `check` + e2e run before a commit of a multi-file change                                           |
| Permission allow-list is too broad                            | you approve the exact list; only read-only and project-local commands                                                                  |
| Too much in the always-loaded file costs tokens every session | hard size cap, details live in `docs/` and are read on demand                                                                          |

---

## Appendix A: draft `AGENTS.md`

```markdown
# MathRacing: agent briefing

Offline-first PWA maths racing game, 2-5 pupils on one touchscreen, KSSR Year 1-2 (Malaysia).
Phaser 4.2.1 + TypeScript 6.0.3 (pinned, do not bump) + Vite 8 + Vitest 5 + Playwright 1.63.
Hard rules: works fully offline; no pupil data leaves the device; player names are never persisted in settings.

## Where things live (open only what the task needs)

- `src/game/core/` pure rules: `RaceEngine`, `RaceState` (types/config/events), state machine, input ownership. No Phaser/DOM.
- `src/game/ui/` drawing: `TrackView` (track, cars, particles), `PanelView` (pupil panel), `motion.ts` (car spring), layout (pure).
- `src/game/scenes/` Phaser scenes (`ReadyScene`, `RaceScene`, `StageScene`). `guardedFrame` wraps every frame.
- `src/curriculum/` schema, answers, blueprint, registry; `generators/` one file per topic group; `packs/`.
- `src/app/` `AppController` (flow, persistence), `screens/SetupScreen`, `ResultsScreen`, dialogs, help.
- `src/storage/` settings (localStorage), evidence (IndexedDB). `src/reporting/` CSV + teacher evidence.
- `src/locales/` `bm.ts` (complete, write here first), `en.ts` (falls back to BM per key).
- `docs/` ARCHITECTURE, DECISIONS (append-only, numbered), CURRICULUM-MAPPING (generated: never hand-edit), REPO-MAP (generated).
- Task -> files: race rule = `RaceEngine`+`RaceState`+`raceEngine.test.ts`; new setting = `storage/settings.ts`+`SetupScreen`+`AppController`+both locales+`storage.test.ts`; new template = `generators/<group>`+its test; new attempt field = `RaceState`+`RaceEngine.log`+`exportCsv`+`storage.test.ts` fixtures.

## Commands (run the cheapest one that proves your change)

| Changed                                                                                                                                           | Run                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| docs only                                                                                                                                         | `npx prettier --check <file>`                                                                    |
| pure logic / storage / reporting                                                                                                                  | `npx vitest run <test file>` then `npm run typecheck`                                            |
| Phaser drawing                                                                                                                                    | typecheck + lint + unit, then `npx playwright test e2e/<file> -g "<title>"` (one screenshot max) |
| before committing a multi-file change                                                                                                             | `npm run check` then `npm run test:e2e` (once)                                                   |
| Unit ~13 s, full e2e ~5 min. `npm run check:fast` for changed files only. Format with `npx prettier --write <changed files>`, not the whole repo. |

## Traps (each already cost a debug round)

- An uncaught throw in a Phaser frame kills the game loop. Keep frames inside `guardedFrame`. Text with only `maxWidth` shrinks to fit; `maxHeight` wraps. Never wrap narrower than a glyph.
- Phaser cannot init in jsdom: `createGame` is dynamically imported; app tests inject a fake.
- `RaceEngine` takes time as `atMs`; never read a clock inside it.
- Next question index = `itemsDealt`, not progress (progress can drop after a setback).
- Use `0 - n`, not `-n`, when the value may be 0 (avoids `-0`).
- E2E uses the app's own pure modules to compute questions/taps. Do not add test hooks to the app.
- Claude's in-app browser pane cannot animate. Use Playwright for anything timed or visual.
- Windows + Git Bash: `/d/...` paths, never `cd` into `node_modules`, write files with the Write tool (no nested-quote heredocs).
- Dev port 5173 may be taken: config reads `PORT`; `.claude/launch.json` has `autoPort`.
- Curriculum packs are drafts: never invent SP codes.

## How to work (saves tokens)

- Read line ranges, not whole files; do not re-read a file you just edited; use `docs/REPO-MAP.md` before grepping.
- Show command output only when it fails; report results in one or two lines.
- Screenshots only for visual changes, and read the one that matters. Prefer DOM/IndexedDB assertions.
- Batch independent tool calls. Do not re-run a check the last green run already covered.
- "Provide md first / don't execute" means: write `docs/PLAN-<topic>.md` and stop.
- A changed rule updates `docs/DECISIONS.md` (new numbered entry) and the README/help text.
- One commit per logical step. Never commit `example.mp4` (shows real pupils).

## Done means

`npm run lint`, `npm run typecheck`, `npm test` green; `npm run test:e2e` green for anything user-visible; docs updated; committed.
```
