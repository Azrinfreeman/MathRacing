# Implementation plan: idle crawl (a car that is not being answered slows to a crawl)

Status: **implemented** (DECISIONS #37). The owner approved every recommended answer in section 6 ("proceed"). Deviation: the crawling car also keeps its rocket flame off, like a slowed car.

Original status: proposal. Builds on cruise movement (DECISIONS #36, `docs/PLAN-cruise-boost.md`). Section 6 lists the decisions that are yours; the plan follows the recommended answer for each.

## 1. What is being asked

When pupils stop answering, their cars should still move forward, but **very slowly**, so that "just wait and let the car drive" is never worth it and pupils are pushed to answer.

## 2. Why the current pace is not enough

With today's numbers a car cruises one step every 15 s. In an 8-step race, a pupil who never answers still finishes in 2 minutes. That is short enough that a pupil can reasonably sit and wait. Two ways to fix it:

| Option                           | How it works                                                                                                                                         | Downside                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A. Slower base pace for everyone | Change `cruiseStepMs` from 15 s to e.g. 45 s                                                                                                         | Cars look almost parked even while pupils are answering well; the track feels less lively. |
| **B. Idle crawl (recommended)**  | Normal cruise while the pupil keeps answering. If **that pupil** has sent no answer for 10 s, **their** car drops to a crawl until they answer again | Slightly more logic (one more speed boundary per car), all of it pure and testable.        |

B keeps the lively feel for pupils who are trying and makes waiting clearly the slowest choice. It is per car, so when both (or all) pupils idle, every car crawls. That is exactly the situation in the request.

## 3. The rule (option B)

- Each car remembers `lastAnswerAtMs`: the race start, then each submitted answer (right or wrong).
- While `atMs < lastAnswerAtMs + idleAfterMs` the car cruises normally. After that it **crawls** at `cruise × idleFactor`.
- Any submitted answer ends the crawl at once. A correct answer also boosts, as today.
- A wrong answer still applies the normal slow-down (30% for 2.5 s) and then returns to full cruise, not to the crawl. So trying always beats waiting (see the table below).
- Touching the panel without submitting does **not** count, so tapping around cannot stop the crawl.
- The crawl never reaches 0, so every race still ends.

### Proposed numbers (in `CruiseConfig`, tune after a classroom try)

| Setting       | Default | Meaning                                                |
| ------------- | ------- | ------------------------------------------------------ |
| `idleAfterMs` | 10000   | Time without an answer before the car starts crawling. |
| `idleFactor`  | 0.2     | Crawl speed: 20% of cruise (one step every 75 s).      |

What that means for an 8-step race:

| Pupil                               | Finishes in about        |
| ----------------------------------- | ------------------------ |
| Correct every 12 s                  | 53 s (unchanged)         |
| Wrong answer every 8 s, never right | ~3 min                   |
| Never answers                       | **~9.5 min** (was 2 min) |

A pupil who never answers covers the first 10 s at normal pace (0.67 steps) and the remaining 7.33 steps at 75 s each. In practice the teacher ends the race long before that, so "waiting it out" stops being a strategy.

## 4. Implementation

### 4.1 Pure maths (`src/game/core/cruise.ts`)

- `CruiseConfig` gains `idleAfterMs` and `idleFactor`. `CruiseBody` gains `idleFromMs` (= `lastAnswerAtMs + idleAfterMs`).
- `speed(t) = cruise × (slowed ? slowFactor : t >= idleFromMs ? idleFactor : 1) + boost`. While slowed, the slow-down factor is used (a wrong answer just ended the idle anyway).
- `advanceCruise` adds `idleFromMs` as one more segment boundary. Speed stays piecewise constant, so the maths is still exact and frame-rate independent, and the finish-crossing time is still exact.
- New helper `noteAnswer(body, atMs, config)` sets `idleFromMs = atMs + idleAfterMs`. `applyBoost` and `applySlow` call it.
- `SpeedState` gains `'crawl'` (priority: boost, then slow, then crawl, then cruise).

### 4.2 Engine (`RaceEngine`, `RaceState`)

- `PlayerRaceState` gains `idleFromMs`. It is set at `start(atMs)` and on every submitted answer, at the same `effectAt` the boost and slow already use.
- `resume`: shift `idleFromMs` by the paused time (like `slowUntilMs`), so a pause never counts as idling.
- `requestSimpler` (swap to an easier question) also resets the idle timer, because the pupil is engaging.
- New event `{ type: 'crawling', playerId }`, emitted once when a car starts crawling. The engine detects it in `advanceTo` when the state changes from cruise to crawl. It drives the panel nudge below.
- Evidence: nothing new in `AttemptRecord`. Idling produces no attempts, and `elapsed_ms` already shows long waits. `SessionMeta` needs no change: the numbers are constants.

### 4.3 Drawing and feedback

- `TrackView`: a crawling car keeps rolling (wheels turn slowly) with no puffs, no flame and no speed lines. Nothing shaming appears on the shared track: no colour change, no icon, no name callout.
- `PanelView`: a private, friendly nudge in that pupil's own panel while crawling. BM: "Jawab untuk memecut!" EN: "Answer to speed up!" (amber, same style as "Cuba lagi"). It disappears on the next answer.
- Reduced motion: unchanged approach. The car is placed at its exact distance, and the nudge text is the cue.
- Sound: none (a repeating idle sound would be noise in a classroom).

### 4.4 Text and docs

- Locales: `race.idle` (BM first, then EN). Update `help.how.2` and `setup.cruiseNote` to mention that a car crawls if its pupil stops answering.
- DECISIONS **#37** (amends #36), README "Fair and calm" line, ARCHITECTURE cruise paragraph.

## 5. Tests

| Where                          | What                                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tests/cruise.test.ts`     | Crawl starts exactly at `idleAfterMs`; any answer ends it; slow-down beats crawl and then returns to full cruise; frame-slicing test still exact with the idle boundary; "idling never beats trying" with the new defaults.                                                                  |
| `src/tests/raceEngine.test.ts` | Two idle cars both crawl after 10 s; one pupil answering keeps normal pace while the other crawls; `crawling` event once per idle spell; pause does not count as idle; requesting a simpler item resets the timer. Existing cruise tests set `idleAfterMs` large so they keep their numbers. |
| `src/tests/motion.test.ts`     | Follow mode reads a crawling car as moving forward (no settle snapping at crawl speed).                                                                                                                                                                                                      |
| `e2e/cruise.spec.ts`           | Idle for 12 s: the car has moved, but less than 1 step (and the panel shows the nudge); one answer brings back normal speed. One screenshot.                                                                                                                                                 |

## 6. Decisions for you (recommended answer first)

| #   | Question                                  | Recommended                                      | Alternative                                                 |
| --- | ----------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| D1  | How to make idling slow                   | B: idle crawl per car, after 10 s with no answer | A: slower base pace for everyone (e.g. 45 s per step)       |
| D2  | What ends the crawl                       | Any submitted answer (right or wrong)            | Only a correct answer (then a struggling pupil also crawls) |
| D3  | Crawl speed and delay                     | 20% of cruise after 10 s                         | Other values, e.g. 10% after 15 s                           |
| D4  | Private nudge in the panel while crawling | Yes: "Jawab untuk memecut!"                      | No message, the slow car is the only cue                    |
| D5  | Per car, or only when **all** pupils idle | Per car (all idle means all crawl)               | Crawl only when every pupil has stopped answering           |

## 7. Order of work (one commit each)

1. `cruise.ts` crawl + `cruise.test.ts`.
2. Engine (`idleFromMs`, pause shift, `crawling` event) + engine tests.
3. Panel nudge, track pose, locales, help text.
4. E2E, DECISIONS #37, README, ARCHITECTURE; `npm run check` and `npm run test:e2e`.
