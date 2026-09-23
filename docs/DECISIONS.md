# Decisions and assumptions

Every material assumption, in the order they were made. The priority used when sources conflicted was: (1) the user's live instructions, (2) the implementation prompt, (3) the KPM game-plan PDF for curriculum and pedagogy, (4) the reference video for observed interaction mechanics only.

## What the reference video does and does not show

`example.mp4` is 14.6 s, 1920x1080, and starts mid-race. Observed: a five-lane race across the top of a large touch panel with one named racer per pupil; five equal answer panels below, each with a coloured header showing the equation, an answer field and a keypad (1-9, C, 0, Go); a winner overlay ("... MENANG!") with a "Main Lagi" button; children answering at the same time.

**Not observed, therefore decided here (not copied):** the setup flow, the countdown, what happens after a wrong answer, hints, pausing, results and any data handling. The characters in the video (ducks), their art, sounds and layout details were not reused; MathRacing uses original vector rocket-kart style vehicles, synthesised sounds and its own wording. No frames from the video are stored in the repository.

## Product decisions

1. **Wrong answers are private and gentle.** The item stays active, the keypad clears, a soft "Cuba lagi." appears in that pupil's panel only, and a low short sound plays. The racer never moves backwards and no wrong-answer count is shown to the class (plan section 8).
2. **Hint after 2 wrong attempts, support after 3.** The hint is a small conceptual sentence per template. At 3 wrong attempts the pupil first gets a picture of the problem where the template has one (no change of difficulty); a second step offers, never forces, a "Soalan lebih mudah" (simpler related item, one level lower). Both are teacher-switchable, applied to every player under the same rule, disclosed on the Setup screen and recorded as `support_used` in the evidence. This is how the "no silent easier path" rule from the prompt is met.
3. **One difficulty level per race.** All players get the same template sequence (a shared blueprint) and the same level, with different values. Topics in a mixed race are rotated evenly. No speed bonus: every correct answer moves exactly one step.
4. **Same-frame finish tie-break.** After the race is finished, submissions are frozen. The only exception is a finishing answer whose own timestamp is earlier than the declared winner's: it merely arrived late in the event queue, so it wins and the earlier "winner" becomes runner-up. Exactly one winner is ever shown. An exact timestamp tie goes to the answer processed first.
5. **Practice mode** has no winner: each pupil completes the configured number of items and the race ends when everyone is done (or the teacher ends it). Cooperative mode is architected for (the engine takes a mode and a source of questions) but not built.
6. **Ready screen doubles as a touch check.** Each pupil touches a large button in their own panel to confirm; when all have, a 3-2-1 countdown starts. The teacher can also start immediately.
7. **Pause is press-and-hold** (0.6 s) on the DOM button above the track, or Esc, so a child cannot pause by a stray touch. Answers being typed are kept and paused time is not counted in response times. The race also pauses automatically when the tab is hidden.
8. **Results are class-safe.** The class sees finishing order and progress. Teacher evidence (attempts, hints, support, per-SK counts) is behind an explicit button and is labelled evidence, never a mark or Tahap Penguasaan.
9. **Main Lagi uses a new seed** (so the questions are new). If the teacher typed a seed, the replay uses `<seed>-<n>`, which is still reproducible.
10. **Litres are written "L"**, not "l", because a lowercase l is easily misread on a classroom screen.
11. **Number pad omits a separate backspace**: it has 0-9, C (clear) and Go/Hantar, matching the layout in the video. Build-value has an Undo.

## Curriculum decisions

12. **SP codes are not invented.** The plan lists SK ranges only. Templates carry the plan's SK range and an empty SP list; docs/CURRICULUM-MAPPING.md records this and the other gaps. Packs are `draft-pending-academic-review`.
13. **Bahasa Melayu is complete; English is a full UI translation** with per-key fallback to BM (never a raw key). English does not invent curriculum codes.
14. **Money is integer sen** everywhere; answers compare as exact decimal strings. Year 1 money uses 5/10/20/50 sen coins and RM1/RM5/RM10 notes; Year 2 up to RM100 uses whole-ringgit notes. Coins and notes are drawn as original abstract vector art.
15. **Year 2 times tables** are limited to 2, 3, 4, 5, 10 (and one-digit x 10). The plan's example RM48 / 6 is honoured for money division. To be confirmed by the reviewer.
16. **A remainder is asked as its own item** ("? baki 2" or "3 baki ?") because the keypad takes one number; every division template declares whether a remainder can occur.
17. **All five widgets are implemented** (number pad, choice tiles, tap picture, order strip, build value) with tap-based order/build (no drag needed). The plan's clock-picker and draw-shape widgets are not.

## Engineering decisions

18. **Stack** (all pinned in package-lock.json): Phaser 4.2.1, TypeScript 6.0.3, Vite 8.3.0, Vitest 5.0.1, Playwright 1.63.0, vite-plugin-pwa 1.3.0, ESLint 10 with typescript-eslint 8.70.1, Prettier 3.9.9. **TypeScript is 6.0.3, not the newer 7.x**, because typescript-eslint 8.70.1 declares `typescript >=4.8.4 <6.1.0`.
19. **Ten active pointers** are reserved (`input.activePointers: 10`), five for pupils and spares so accidental contacts cannot steal a slot.
20. **Pointer ownership** is pure logic (`InputOwnership`) behind a thin adapter (`PointerRouter`); a tap completes on pointer-up over the same control it started on inside its owner panel. Taps activate on release, not press, so a dragging finger never presses.
21. **Crisp rendering on scaled displays:** the canvas is sized in device pixels (capped at 2x) and shown at CSS size. Phaser's `zoom` did not do this in RESIZE mode (checked in a browser), so sizing is explicit.
22. **The Phaser engine is lazy-loaded** (dynamic import), so Setup opens from a 182 KB script and the 1.4 MB game chunk loads when a race starts. Both are precached by the service worker.
23. **Autosave after every attempt** (fire-and-forget to IndexedDB; a failure shows a warning toast rather than being swallowed). If IndexedDB is unavailable the app falls back to memory and says so.
24. **Settings never contain names.** localStorage holds only classroom-level choices; player names live in memory for the session (and are prefilled after "New Setup" while the page stays open).
25. **The end-to-end tests need no test hooks in the app.** Because sessions are seeded, the tests import the app's own pure curriculum/layout modules, compute the exact questions and control positions for a seed, and drive the real browser. Multi-touch tests use Chrome DevTools Protocol touch events.
26. **The `?diag` pointer overlay exists only in development** (`import.meta.env.DEV`).
27. **Git:** the repository was initialised after the first build. `example.mp4` is git-ignored because it shows real pupils' faces; `.gitattributes` keeps line endings consistent on Windows.
28. **The service worker cannot register in Claude's embedded browser pane** (a limitation of that pane); offline behaviour was verified in Playwright's Chromium instead.
29. **Frame errors must never freeze the screen.** Bug found in use: on a narrow or tall window with fractional display scaling (for example 1103x887 at 150%), the very large "Mula!" countdown label was wrapped into a box narrower than one letter, Phaser threw while drawing, and an uncaught exception in Phaser's loop stops the whole game, leaving the screen frozen on the countdown "1". Fixes: (a) text with only a width limit is now one line that shrinks to fit (only text with a height limit wraps); (b) `TextPool` catches Phaser's wrap error and shrinks or falls back to no wrap; (c) the countdown card and font size follow the track's width and height; (d) each scene frame runs inside `guardedFrame`, which logs the error and keeps the game running, and after 30 consecutive failing frames tells the app to stop the race and return to Setup with a message. Regression tests cover four awkward window shapes with every child confirming Ready by touch, and the abort-to-Setup path.
