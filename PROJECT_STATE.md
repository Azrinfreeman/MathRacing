# PROJECT_STATE (read this first in a new session; then AGENTS.md is auto-loaded via CLAUDE.md)

Updated 2026-09-24. Working tree clean at the time of writing; last code commit `bb79271`.

## What exists

MathRacing: offline-first PWA maths racing game (2-5 pupils, one touchscreen, KSSR Year 1-2), built from
`Claude_Code_Opus_Super_Prompt_MathRacing_JS.pdf`. Phaser 4.2.1, TS 6.0.3, Vite 8, Vitest 5, Playwright 1.63.
77 templates x 4 levels, 5 widgets, IndexedDB evidence + CSV export, PWA offline. Repo: `D:\UProject\ProjectAIVibeCode\MathRacing`.

## Verified state (last full run)

- `npm run check`: lint, typecheck, 833 unit tests, build all green.
- `npm run test:e2e`: 24/24 green (before the AGENTS.md tooling commits; only a single-test run since).
- Structure, commands, traps: `AGENTS.md`. File list: `docs/REPO-MAP.md`. Rationale: `docs/DECISIONS.md` (#1-#32).

## Features added in the latest sessions (all committed)

1. Countdown freeze fix (`guardedFrame`, text wrap rules).
2. **Setback rule** (DECISIONS #30-31): Quick Race only, 3rd wrong answer to one question = back 1 step, once per question, never below 0; ON by default, Setup checkbox `opt-setback`; Practice exempt. Engine uses `itemsDealt` for question index. CSV columns `step_delta`, `progress_after`; teacher evidence has a Setbacks column.
3. **Car animation** (#32): `src/game/ui/motion.ts` (`CarMotion`, critically damped spring), forward lean/trail/speed lines, backward wobble/dust, spinning wheels, `setback` sound, reduced-motion ring.
4. Tooling: `AGENTS.md`, `CLAUDE.md` (imports it), `docs:map`, `docs:agents`, `check:fast`, e2e rebuilds `dist/` only when stale, LF line endings, `.claude/settings.json` (allow/deny), `PORT`/`autoPort` for the dev server.

## Not running / not done

- **Dev server is not running.** Start with `npm run dev` (Vite picks a free port if 5173 is taken; read the printed URL). The user rejected the `preview_start` tool call earlier, so do not call it unless asked.
- Real five-finger hardware not validated: run `docs/MANUAL-TOUCH-TEST.md` on the target panel.
- Curriculum packs are `draft-pending-academic-review`; no SP codes exist (never invent them).
- Setback is a classroom-culture call (public track). Owner accepted it; reviewer may switch it off in Setup.
- Cooperative/team mode, clock-setting widget, shape drawing, Year 1 "2027 pack" not built.

## Owner preferences (how to work with them)

- When the owner says "provide md first / don't execute": write `docs/PLAN-<topic>.md`, commit, stop, list decisions D1..Dn.
- Wants low token use and no repeated work: follow the "cheapest check" table in `AGENTS.md`; read ranges, not whole files.
- Commits: one per logical step, message trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Commit only when asked or as part of an approved plan.
- Pronouns: use they/them unless stated.

## Likely next requests (none started)

- Start the dev server / play-test the setback and animation in a real browser.
- Run the manual touch protocol; review curriculum drafts; tune animation feel (rates `FORWARD_RATE`/`BACKWARD_RATE` in `motion.ts`).
