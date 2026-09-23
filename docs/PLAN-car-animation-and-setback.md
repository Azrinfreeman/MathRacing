# Implementation plan: car animation and "setback after 3 wrong answers"

Status: **proposal, nothing implemented yet.** Written for review; the open decisions in section 8 should be answered before work starts.

## 1. What is being asked

1. Give the racers proper **forward and backward movement animation**.
2. Make a player's car **go backward when that player answers the same question wrong 3 times**.

## 2. A rule that changes (read this first)

Today the game deliberately never moves a racer backwards:

* The implementation brief: "Each accepted answer advances exactly one step. Do not move backward for mistakes."
* KPM game plan, section 8: "No negative distance, public accuracy percentage, humiliation sound or permanent leaderboard for Year 1-2."
* `docs/DECISIONS.md` #1, the help text (`help.how.2`), the README and several tests state the same thing.

The new request reverses that. Because you (the project owner) are asking for it, it can be done, but it has a real classroom cost and should be a **deliberate, visible, switchable** feature rather than a silent change:

* The track is **shared and public**. A car sliding backwards tells the whole class who is struggling, which is the "public wrong-answer signal" the plan warns about for 6-8 year olds.
* A setback is a penalty for a child who is already stuck; it can compound frustration and push a pupil to guess faster.
* It rewards speed over understanding more than before (the plan's stated reason for equal movement).

**Mitigations built into this plan:** a teacher toggle in Setup (with a one-line explanation), a cap of one setback per question, never below the start line, neutral (non-red, non-shaming) visuals and sound, no name callout, exempt in Practice mode (recommended), and nothing about setbacks shown in the class-facing results. Section 8 lists the choices that are yours to make.

If you would rather keep every pupil's score safe, a fallback with the same visual fun is the **"slip" animation only** (the car wobbles or skids but keeps its step). It is described in section 8 as option C.

## 3. Current behaviour (what exists today)

* `game/ui/TrackView.ts` keeps a per-player `target` and `shown` progress (0..raceLength). Each frame `shown` approaches `target` with an exponential ease (`1 - exp(-dt/150)`), so it is frame-rate independent. A small vertical "bob" plays while moving, the rocket has a flame, and reduced motion snaps instantly. Wheels do not turn, the car has no lean, and there is no notion of *direction*.
* `game/core/RaceEngine.ts`: a correct answer does `progress += 1`; a wrong answer changes no progress. **Important coupling:** the next question index is `progress` (`itemIndex = progress`, `source.question(playerId, itemIndex)`), which is only safe because progress never decreases.
* Hints after 2 wrong, visual support then an offered simpler item after 3 wrong already exist (`RaceConfig.hintAfter = 2`, `supportAfter = 3`).

## 4. Part A: forward and backward animation

### 4.1 Motion model (pure, testable)

New file `game/ui/motion.ts` (no Phaser), one `CarMotion` per player:

```ts
type Direction = 'forward' | 'backward' | 'still';
class CarMotion {
  progress: number;          // displayed progress, fractional
  velocity: number;          // progress units per second (signed)
  wheelAngle: number;        // radians, advances with distance travelled
  direction: Direction;
  setTarget(target: number, reducedMotion: boolean): void;
  step(dtMs: number): void;  // frame-rate independent
}
```

* Use a **critically damped spring** (or an eased tween with fixed duration) instead of the current exponential approach so a car accelerates, cruises, then brakes. Suggested feel: forward about 450 ms with ease-out and a tiny settle; backward about 650 ms, slower and softer.
* `wheelAngle += distancePixels / wheelRadius` so wheels visibly roll forwards or backwards in proportion to real distance.
* A new target while moving simply retargets (no snapping); direction is the sign of `target - progress`.
* Reduced motion: `progress = target`, `velocity = 0`, no effects (exactly today's behaviour).

### 4.2 Visual effects (in `TrackView`, driven by the motion state)

Forward (correct answer):

* wheels spin forward; slight nose-up **lean** while accelerating, level while cruising;
* a short **puff/exhaust trail** (a few fading circles) and 2-3 **speed lines**;
* rocket flame length follows velocity (already partly there);
* a quick "boost" sparkle on the small progress tick reached.

Backward (setback):

* the car **reverses without turning around** (keeps facing right so it reads as "rolling back"), wheels spin the other way;
* a gentle **wobble/shake** (2-3 small oscillations) and a small dust puff behind the front bumper;
* neutral palette only: a soft grey/amber puff, **no red flash, no "X", no name pop-up**.

Common:

* all effects are pooled particles owned by `TrackView` (fixed-size arrays, no per-frame allocation), drawn with the existing `Graphics`;
* effects are time-based (dt), so they behave the same at 30, 60 and 144 fps;
* the **reduced-motion** switch removes lean, wobble, trails and particles, and replaces them with an instant move plus a 300 ms static highlight ring around the racer so the change is still noticeable;
* the panel's own feedback stays private and gentle (see 5.4).

### 4.3 Sound

Add `SoundName = 'setback'` in `SoundService`: two soft descending low notes at about 45% of normal volume (never a buzzer). The forward move keeps the existing `correct` chime.

### 4.4 Files touched by Part A

`game/ui/motion.ts` (new), `game/ui/TrackView.ts` (drawing, particles, use `CarMotion`), `game/SoundService.ts` (one sound), `game/scenes/RaceScene.ts` (call `track.setProgress` on both directions and trigger the effect kind).

## 5. Part B: setback after 3 wrong answers

### 5.1 Rule (recommended definition)

* When a player submits their **3rd wrong answer on the same question**, their racer moves **back one step**.
* **At most one setback per question** (further wrong answers on that question do not push the car back again; this prevents a spiral).
* **Never below 0** (the start line). At 0 there is no visible setback.
* The question **stays the same** and support continues exactly as today (hint after 2, visual support after 3, simpler item offered after a further wrong answer). The 3rd wrong answer therefore now triggers a setback **and** the existing help at once; the panel message explains both gently.
* **Practice mode: no setback** (recommended; its purpose is low-pressure practice). Quick Race: setback on when the teacher enables it.
* Switching to the simpler item does not reset the "one setback per question" flag (it is per dealt question, not per attempt counter).

### 5.2 Engine changes (`game/core/RaceEngine.ts`, `RaceState.ts`)

New config (all required, set from Setup):

```ts
RaceConfig { ...; setbackEnabled: boolean; setbackAfter: number /* 3 */; setbackSteps: number /* 1 */ }
```

Player state additions: `setbackApplied: boolean` (per dealt question), `totalSetbacks: number`.

In `submit()` incorrect branch, after logging the attempt:

```ts
if (config.setbackEnabled && config.mode === 'quick' &&
    attemptNumber === config.setbackAfter && !p.setbackApplied && p.progress > 0) {
  const before = p.progress;
  p.progress = Math.max(0, p.progress - config.setbackSteps);
  p.setbackApplied = true; p.totalSetbacks += 1;
  emit({ type: 'setback', playerId, progress: p.progress, from: before });
}
```

`SubmitResult` for `incorrect` gains `setback: boolean`. Setbacks only happen while `RACING` and never after the race is finished (frozen), so winner and tie-break logic are untouched. A pupil can never be at the finish line and be set back, because reaching the target ends their item and (in Quick Race) the race.

**Required coupling fix: decouple question index from progress.** Because progress can now go down, `itemIndex = progress` would re-deal an *earlier* question (the same one they already solved). Replace it with a monotonic `itemsDealt` counter per player:

* `dealNext()` uses `source.question(playerId, p.itemsDealt++)`.
* `QuestionSource` already supports any index (`templateAt(index % blueprint.length)`, per-item seeded streams, no-immediate-repeat check), so it needs no API change, but **prevalidation must cover more items**: in `AppController.beginRace` pre-generate `raceLength * 3` items per player (the 77 templates are already property-tested over thousands of samples, so lazy generation of later items is safe).
* Evidence `item_index` becomes the dealt index (unique per question), which is also cleaner than before.

### 5.3 Evidence and data

* `AttemptRecord` gets `stepDelta: -1 | 0 | 1` (+1 correct, -1 on the setback attempt, else 0) and `progressAfter: number`; CSV adds `step_delta` and `progress_after`. `SessionMeta` gets `setbackEnabled`.
* Teacher evidence table (behind the button) adds a **Setbacks** column per pupil. The class-facing results show progress only and **never mention setbacks**.
* Old exports remain valid (new columns are appended at the end).

### 5.4 UI and copy

* Setup, "Options" group: a new checkbox **"Undur 1 langkah selepas 3 kali salah (Lumba Pantas sahaja)"** with a note: "Kereta semua murid boleh undur; papan trek dilihat oleh seluruh kelas." (EN equivalents added). Default: see decision D1.
* Panel feedback on a setback (private, neutral colours): **"Undur 1 langkah. Lihat bantuan dan cuba lagi."**; the panel's `n / total` counter and the progress pips go down by one.
* Help dialog: replace "A wrong answer never moves it backwards" with the new rule and the toggle. Update `help.how.2/3`, `setup.support` note, README "Fair and calm" bullet, `docs/DECISIONS.md` (#1 amended, new decision recording the reversal, its reason and mitigations), `docs/ARCHITECTURE.md`.

### 5.5 Settings

`Settings.setbackEnabled: boolean` in `SettingsStore` (sanitised like the others), applied via `SetupInput` -> `RaceConfig`.

## 6. Test plan

Unit (Vitest):

* **Engine:** setback fires on the 3rd wrong attempt only; only once per question even after 6+ wrong; never below 0; not in Practice; not when disabled; not after the race is finished; independent per player; correct answer after a setback still +1; winner logic and same-frame tie-break unchanged; attempt records carry `stepDelta` and `progressAfter`; `itemsDealt` deals a **new** question after a setback (never the previously solved one) and the sequence stays deterministic for a seed.
* **Blueprint/question source:** items beyond `raceLength` generate valid, non-repeating questions; prevalidation for `raceLength * 3` passes for every topic and level.
* **Motion model (`motion.ts`):** reaches the target in the expected time forward and backward; identical end state at 30/60/144 fps; retargeting mid-move is continuous (no jump); no overshoot beyond a small bound; wheel angle sign follows direction and scales with distance; reduced motion snaps with zero velocity.
* **Settings/CSV/evidence:** new field sanitised; CSV has the new columns and stays formula-safe; evidence summary counts setbacks.
* Update the existing test "an incorrect answer never moves a racer" so it covers the *disabled* case, and add the enabled cases.

End-to-end (Playwright):

* With setback on: answer one question correctly, then wrong x3 on the same panel; read IndexedDB and assert `step_delta = -1` on the 3rd attempt and that the next dealt question differs; assert no setback with the option off and in Practice.
* Capture mid-animation screenshots (forward and backward) at 1920x1080 and 1280x720 and inspect them; verify reduced-motion produces no particles.
* Re-run all existing suites (multi-touch, slide-in, layout, offline).

## 7. Work breakdown and rough size

| Step | Work | Size |
|---|---|---|
| 1 | Engine: `itemsDealt` decoupling, config, `setback` event, records, tests | medium |
| 2 | Setup/settings/locales/help text, CSV/evidence columns, docs | small-medium |
| 3 | `motion.ts` model + tests | small |
| 4 | `TrackView` forward/backward visuals and particles, reduced motion, sound | medium |
| 5 | e2e tests, screenshot review, docs/decisions update, commit | small-medium |

Each step is a separate commit so the feature can be reverted cleanly.

## 8. Decisions needed from you

| # | Question | Recommendation |
|---|---|---|
| D1 | Should setback be **on or off by default**? | **Off by default**, one checkbox to turn on (it is a change from the KPM plan's "no negative movement"). If you want it on for every race, say so. |
| D2 | Trigger: **once per question at the 3rd wrong**, or **every 3rd wrong** (3rd, 6th, 9th)? | Once per question (avoids a spiral for children who are stuck). |
| D3 | Applies in **Practice** mode? | No, Quick Race only. |
| D4 | Step size: **1 step**, or more? | 1 step. |
| D5 | Should the 3rd wrong answer also keep showing the **help** (picture / simpler item)? | Yes, unchanged. |
| D6 | Because the track is public, is a **visible backward slide** acceptable for your classes? | If unsure, choose **option C** below for the first classroom trial. |

Option C (safe fallback): keep everyone's progress, but on the 3rd wrong answer the car does a short "slip" (a wobble and a small skid backward that snaps back to its place). Same animation work, no lost progress, no rule change.

## 9. Acceptance checklist

* [ ] Forward animation: wheels roll, lean and trail visible, identical timing at any frame rate.
* [ ] Backward animation: reverse roll and wobble, neutral colours, no red and no names.
* [ ] Setback happens exactly as defined in 5.1 and is covered by tests.
* [ ] Toggle in Setup, help text, README and DECISIONS updated to match.
* [ ] No question is ever re-dealt after a setback.
* [ ] Reduced motion still communicates the change without animation.
* [ ] Results screen shows progress only; teacher evidence shows setbacks.
* [ ] `npm run lint`, `typecheck`, `npm test`, `build`, `test:e2e` pass; screenshots reviewed.
