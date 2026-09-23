# Implementation plan: cruising cars, boost on correct, slow-down on wrong

Status: **approved** (see DECISIONS #36). The owner answered section 9 as follows, and the build follows them:

| #   | Decision taken                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------- |
| D1  | A teacher toggle keeps the step race available; **cruise is the default from now on**.                      |
| D2  | **Practice cruises too** (no winner; the race ends when every car has reached the finish).                  |
| D3  | Cruise replaces the setback: a wrong answer only makes the trip to the finish slower. Setback is step-only. |
| D4  | Section 3 numbers, tuned after a classroom try.                                                             |
| D5  | A car may finish on cruise alone; answering correctly is the only way to go faster.                         |

The original proposal follows. Where it says Practice stays step-based (4.3, 4.4, D2), D2 above overrides it.

## 1. What is being asked

1. Every car **drives forward on its own at the same steady pace** from the start line to the finish.
2. A **correct answer gives that car a short boost** (it goes faster for a moment).
3. A **wrong answer slows that car down** for a moment (it never stops and never goes backward).
4. **Doing nothing** keeps the car moving at the normal steady pace.

## 2. What changes compared with today

Today a car only moves when its pupil answers correctly: each correct answer moves it exactly one step (DECISIONS #3), and the 3rd wrong answer to a question moves it back one step (the setback, #30). Cars stand still between answers.

With this change the car is **always moving** during Quick Race. Answers change its **speed**, not its position:

| Event                  | Today                       | New ("cruise" movement)                                 |
| ---------------------- | --------------------------- | ------------------------------------------------------- |
| Nothing happens        | Car stands still            | Car cruises at the shared base speed                    |
| Correct answer         | Car jumps forward 1 step    | Boost: extra speed that adds exactly 1 step over ~1.2 s |
| Wrong answer           | Nothing (3rd wrong: back 1) | Slow-down: 30% speed for 2.5 s; never backward          |
| Several wrong in a row | One setback per question    | The slow timer restarts; it never gets slower than 30%  |
| Correct while slowed   | n/a                         | Cancels the slow-down, then boosts                      |

Because a boost is worth exactly one step, the old promise "every correct answer is worth the same" (#3) still holds; the drift is shared equally by everyone.

**Classroom check.** Doing nothing must never beat trying. With the numbers below, one wrong answer costs about 0.12 steps and one correct answer gains 1 step, so a pupil who gets 1 of 6 attempts right is still ahead of a pupil who does nothing. Every race also now has a guaranteed end: even with no correct answers the cars reach the line.

## 3. Proposed numbers (all in `RaceConfig`, tuned after a classroom try)

| Setting        | Default | Meaning                                                                     |
| -------------- | ------- | --------------------------------------------------------------------------- |
| `cruiseStepMs` | 15000   | Base pace: one step every 15 s. An 8-step race takes 2 min with no answers. |
| `boostSteps`   | 1       | Extra distance one correct answer gives.                                    |
| `boostMs`      | 1200    | Time over which that extra distance is delivered.                           |
| `slowFactor`   | 0.3     | Speed multiplier while slowed.                                              |
| `slowMs`       | 2500    | How long a slow-down lasts (restarts on each wrong answer).                 |

What that means for an 8-step race:

| Pupil                            | Finishes in about |
| -------------------------------- | ----------------- |
| Correct every 12 s               | 53 s              |
| Correct every 20 s               | 69 s              |
| 1 correct and 2 wrong every 20 s | 76 s              |
| Does nothing                     | 120 s             |

## 4. Engine design (`src/game/core/`)

### 4.1 Distance is continuous, progress stays whole

- `PlayerRaceState` gains **`distance: number`** (fractional steps, 0..raceLength), which is where the car really is.
- **`progress` stays an integer** = `Math.floor(distance)` (the finish counts as `raceLength`). Everything that reads progress today (panel step counter and pips, results, `progress` events, question dealing via `itemsDealt`) keeps working unchanged.
- A `progress` event fires each time a car crosses a whole step, so the panel still redraws only when needed.
- In step movement (Practice, or cruise switched off) `distance === progress` always, so the old behaviour is untouched.

### 4.2 Speed is piecewise constant, so the maths is exact

New pure module **`src/game/core/cruise.ts`** (no Phaser, no clock):

- Per player it keeps `slowUntilMs` and `boostUntilMs` (plus boost speed), and the engine keeps one shared `integratedToMs`.
- `speed(t) = cruise * (slowed ? slowFactor : 1) + (boosting ? boostSteps / boostMs : 0)`.
- `advanceCruise(state, fromMs, toMs, config)` integrates distance over `[fromMs, toMs]`, splitting the interval at every boost/slow boundary. Between boundaries the speed is constant, so distance and the **exact finish-crossing time** are simple arithmetic.
- The result is identical at 30, 60 or 144 fps and after a stalled frame (the same property #32 gave the car spring).

### 4.3 `RaceEngine` changes

- `tick(atMs)`: advance every racing player from `integratedToMs` to `atMs` (still deals the next question after the success delay, as today).
- **Finishing moves from `submit` to `tick`.** When one or more cars cross the line in the same tick, the winner is the **earliest computed crossing time**, not the order of processing. On an exact tie: more correct answers, then the earlier last correct answer, then slot order. This replaces the late-submit rule (#4) for cruise movement. `lateSubmit` stays for step movement.
- `submit`, correct: cancel any slow-down and start a boost. The success delay and question dealing are unchanged. The car keeps moving while the next question loads.
- `submit`, wrong: start or restart the slow-down. The hint (after 2 wrong) and support (after 3 wrong) are unchanged. **The setback rule does not apply in cruise movement** (see D3).
- Trap: a pointer event time can be earlier than the last tick. Effects start at `max(atMs, integratedToMs)`, so already-integrated distance is never rewritten.
- `pause` / `resume`: while paused nothing is integrated. On resume `integratedToMs`, `slowUntilMs` and `boostUntilMs` shift by the paused time, like `itemShownAtMs` does today.
- A car that crosses the line while a question is open records it as `unsolved`, using the existing `closeOpenItem`.
- `endRace` (teacher stops early) and `result()` rank unfinished racers by `distance`, not `progress`.
- New events: `{ type: 'boost', playerId }` and `{ type: 'slowed', playerId }`, for sound and panel feedback. Visuals read speed each frame from a new `engine.speedState(playerId): 'cruise' | 'boost' | 'slow' | 'stopped'`.
- Practice mode: **unchanged** (step movement, no drift; see D2).

### 4.4 Config

`RaceConfig` gains `movement: 'cruise' | 'steps'` and the five numbers in section 3 (`DEFAULT_CRUISE` next to `DEFAULT_RACE_TIMING`). `movement` is forced to `'steps'` in Practice.

## 5. Drawing (`src/game/ui/`, `src/game/scenes/RaceScene.ts`)

- `RaceScene.frame`: after `engine.tick`, call `track.setDistance(id, p.distance, engine.speedState(id))` for each racer. The `progress`/`setback` event handlers stay for step movement.
- `CarMotion` (`motion.ts`) gains a **follow mode**: the spring target is updated every frame to the engine distance. The spring's lag at cruise speed is a few pixels, and it smooths the change in speed when a boost starts or ends. `direction` in follow mode comes from the speed state, not from the gap to the target (otherwise a cruising car would always look like it is accelerating).
- `TrackView` pose and effects by speed state:
  - **cruise**: wheels turn, a small puff now and then, no lean, short flame on the rocket.
  - **boost**: the existing forward effects (nose-up lean, speed lines, exhaust puffs, long flame).
  - **slow**: slight nose-down, a few neutral grey dust puffs (the setback colour, never red), no flame.
- **Reduced motion**: the car still moves, because its position is information and not decoration. It is placed exactly at the engine distance each frame with no spring, lean or particles, and the existing 320 ms static ring shows a boost or slow-down.
- `PanelView`: short private feedback in the pupil's own panel: "Laju!" on a boost (the existing correct flash), and for a slow-down an amber "Perlahan sikit, cuba lagi" in place of "cuba lagi" (neutral, no names, same style as the setback message).
- Sound: boost reuses `correct` with a short whoosh added. Slow-down reuses `gentle` (no new low "failure" sound).

## 6. Settings, evidence and text

- **Teacher option** (`storage/settings.ts`, `setupState`, `TeacherScreen`, both locales): "Kereta bergerak sendiri" / "Cars drive on their own", **on by default**. Off = today's step race (with the setback checkbox, which is shown only when cruise is off). A stored `revision` bump is not needed: an unknown key falls back to the default.
- **Attempt records** (`RaceState`, `RaceEngine.log`, `exportCsv`, `storage.test.ts` fixtures):
  - New field `speedEffect: 'boost' | 'slow' | 'none'` → CSV column `speed_effect`.
  - `stepDelta` stays: +1 for a correct answer (the boost is worth one step), 0 for wrong in cruise, -1 for a step-mode setback.
  - `progressAfter` becomes the car's `distance` at the moment of the attempt, rounded to 2 decimals (whole numbers in step mode).
- **SessionMeta** gains `movement: 'cruise' | 'steps'`. The CSV session header shows it.
- Teacher evidence view: a "Perlahan" count (wrong answers while cruising) beside the existing Setbacks column. Class-facing results never mention it.
- Text: `help.how.1-4` (BM first, then EN), README "How to play", DECISIONS **#36** (new rule, amends #3, #4 and #30 for cruise movement), ARCHITECTURE (engine section), `npm run docs:map` for the new file.

## 7. Tests

| Where                                           | What                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tests/cruise.test.ts` (new)                | Integration across boundaries; exact crossing time; frame-rate independence (1 big step = 1000 small steps); slow restart doesn't stack; boost cancels slow.                                                                                                                                                                 |
| `src/tests/raceEngine.test.ts`                  | Existing tests pinned to `movement: 'steps'` through the config helper. New: idle cars all move equally; winner by earliest crossing within one tick; tie-break order; pause freezes distance and shifts effects; event time before the last tick; car crossing with an open question → `unsolved`; Practice ignores cruise. |
| `src/tests/motion.test.ts`                      | Follow mode tracks a moving target without overshoot; reduced motion is exact.                                                                                                                                                                                                                                               |
| `src/tests/storage.test.ts`                     | Fixtures gain `speedEffect` / `movement`; the CSV column; the setting defaults and round-trip.                                                                                                                                                                                                                               |
| `src/tests/app.test.ts`                         | The teacher toggle, and the setback checkbox hidden while cruise is on.                                                                                                                                                                                                                                                      |
| `src/tests/locales.test.ts`                     | New keys in both locales.                                                                                                                                                                                                                                                                                                    |
| `e2e/cruise.spec.ts` (new)                      | Cars move with no input; one correct answer puts the car ahead of an idle rival; a wrong answer leaves it behind an idle rival; answering everything wins; reduced motion still moves. Assert with IndexedDB `progressAfter` and the car x from `trackGeometry`. One screenshot.                                             |
| `e2e/mathracing.spec.ts`, `e2e/setback.spec.ts` | Step-based tests pass `cruise: false` through `e2e/support.ts` options; the winner and multi-touch flows are checked once with cruise on.                                                                                                                                                                                    |

## 8. Order of work (one commit each)

1. `cruise.ts` + `cruise.test.ts` (pure maths).
2. Engine integration + engine tests (existing tests pinned to steps).
3. Evidence fields, CSV, session meta, storage fixtures.
4. Teacher option + locales + help text.
5. Scene, `CarMotion` follow mode, `TrackView` effects, panel feedback, sound.
6. E2E (new spec, existing specs pinned), DECISIONS #36, README, ARCHITECTURE, REPO-MAP; `npm run check` and `npm run test:e2e`.

## 9. Decisions for you (recommended answer first)

| #   | Question                                                 | Recommended                                                                                                           | Alternative                                                         |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| D1  | Can the teacher switch back to the old step race?        | Yes, one toggle, cruise on by default                                                                                 | Cruise always on; delete step movement for Quick Race               |
| D2  | Does Practice mode cruise too?                           | No: Practice stays one step per correct answer, no winner                                                             | Cruise in Practice as well                                          |
| D3  | What happens to the setback (back 1 step after 3 wrong)? | Replaced by the slow-down in cruise; kept only for the step race                                                      | Keep both (slow-down and setback) in cruise                         |
| D4  | Speed values                                             | The section 3 numbers, adjusted after one classroom try                                                               | A teacher "Pace: slow / normal / fast" choice now                   |
| D5  | Can a car win on cruise alone (no correct answers)?      | Yes, but only if every other car is slower, which with these numbers takes about 9 wrong answers for each correct one | Require a correct answer on the final step before the car can cross |
