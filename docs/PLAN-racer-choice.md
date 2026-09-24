# Implementation plan: pupils choose their racer (vehicles or animals such as a duck or goose)

Status: **proposal, not implemented.** Section 7 lists the decisions that are yours; the plan follows the
recommended answer for each. Say "proceed" to build it with those answers, or give different answers.

## 1. What is being asked

Today each slot has a fixed vehicle (slot 1 rocket, 2 kart, 3 wedge, 4 saucer, 5 block; DECISIONS #35 "Vehicles
stay fixed per slot"). The owner wants each pupil to **choose the object that runs to the finish line**, and the
choice should include **animals such as a duck (itik) or a goose (angsa)**, not only cars.

## 2. What stays the same

- **Colour, symbol and number stay tied to the slot.** They are the accessibility cue (never colour alone) and they
  match the pupil's answer panel. Only the _shape_ of the racer becomes a choice.
- Race rules, cruise/boost/slow/crawl, evidence, CSV: unchanged. The racer is a costume, not a rule.
- Default racer for each slot = today's vehicle, so a class that ignores the picker sees exactly today's game.
- Every racer keeps the white symbol badge on its body, so two pupils with the same racer are still told apart by
  colour + symbol + lane number.

## 3. The racer catalogue

New pure module `src/game/core/racers.ts`:

```ts
export type RacerId =
  | 'rocket'
  | 'kart'
  | 'wedge'
  | 'saucer'
  | 'block' // vehicles (today's five)
  | 'duck'
  | 'goose'
  | 'chicken'
  | 'turtle'
  | 'rabbit'; // animals (D1)
export type RacerKind = 'vehicle' | 'animal';
export const RACERS: readonly { id: RacerId; kind: RacerKind; name: { bm: string; en: string } }[];
export function defaultRacerForSlot(slot: number): RacerId;
export function isRacerId(v: unknown): v is RacerId;
```

| id      | BM             | EN            | kind    |
| ------- | -------------- | ------------- | ------- |
| rocket  | Roket          | Rocket        | vehicle |
| kart    | Kart           | Kart          | vehicle |
| wedge   | Kereta laju    | Sports car    | vehicle |
| saucer  | Piring terbang | Flying saucer | vehicle |
| block   | Van            | Van           | vehicle |
| duck    | Itik           | Duck          | animal  |
| goose   | Angsa          | Goose         | animal  |
| chicken | Ayam           | Chicken       | animal  |
| turtle  | Penyu          | Turtle        | animal  |
| rabbit  | Arnab          | Rabbit        | animal  |

`PlayerStyle.vehicle` is renamed `defaultRacer` (type `RacerId`); `VehicleId` is removed. The layout test "5
distinct vehicles" becomes "5 distinct default racers".

## 4. One drawing, two renderers (removes today's duplication)

Today every vehicle is drawn twice: Phaser `Graphics` in `TrackView.drawRacer` and SVG in `art.ts vehicleSvg`.
Adding five animals that way would double the duplication. Instead:

- New pure module `src/game/ui/racerShapes.ts`:
  `racerParts(racer: RacerId, style: PlayerStyle, pose: Pose): RacerPart[]`, where a part is one of
  `poly | circle | ellipse | line | badge`, in the existing vehicle-space coordinates (unit = half the car size,
  facing right, centre at 0,0) with fill/stroke colours. No Phaser, no DOM.
- `TrackView.drawRacer` becomes a small loop that maps parts to `Graphics` calls, applying the lean transform it
  already has. Shadow, particles and speed lines stay in `TrackView`.
- `art.ts racerSvg(style, racer)` maps the same parts to SVG with the still pose (replaces `vehicleSvg`).
- `Pose` moves from `TrackView` into `racerShapes.ts` (it is already pure data).
- Hard bound, unit-tested for every racer and several poses: every point lies within `x ∈ [-1.0, 1.1]` (the
  `CAR_TAIL` / `CAR_NOSE` reach in `trackGeometry.ts`), so start-line, step-mark and finish alignment (#34) holds for
  animals too. The **nose** (beak, snout, head) is the right-most point at about `x = 1.05`, like the rocket's.

Step 1 of the work moves the five existing vehicles into `racerParts` with **no visual change** (checked with one
Playwright screenshot before/after at 1024x600).

## 5. How the animals move (same motion data, different body language)

`CarMotion` already gives each racer `direction`, `speedState` (cruise/boost/slow/crawl/stopped), `velocity`,
`lean` and `travelled`. Animals use the same data; nothing in `motion.ts` or the engine changes.

| Motion input        | Vehicles (today)                 | Animals (new)                                                                                 |
| ------------------- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| distance travelled  | wheels turn                      | **gait phase**: feet/legs step (duck/goose waddle, chicken runs, rabbit hops, turtle paddles) |
| speed               | flame length                     | body bob height and step rate                                                                 |
| boost               | long flame, exhaust, speed lines | **wings flap** (duck, goose, chicken), ears back (rabbit), head out (turtle) + speed lines    |
| slow (wrong answer) | nose down, dust                  | head down, short steps, neutral dust (same as today)                                          |
| crawl (idle)        | no flame/puffs                   | slow waddle, wings folded, no puffs                                                           |
| reduced motion      | still pose + static ring         | still pose + static ring (same)                                                               |

- Gait phase = `travelled × stepPx / strideLength`, the same trick as `wheelAngle`, so the feet never slide and it
  is frame-rate independent. The rabbit's hop height is `|sin(phase)|`, capped so it stays inside its lane.
- Animals get dust puffs, never exhaust smoke. The rocket-only flame stays rocket-only.
- Body colour = the player's colour (a blue duck, an orange goose), with a natural orange beak/feet and the white
  symbol badge on the wing or shell (D2). Outline = `style.dark`, as today.

## 6. Choosing the racer (Setup step 3, "Pemain")

- Each player card already shows its racer picture above the name field. The picture becomes a **button**
  ("Tukar" / "Change" under it). Tapping it opens a picker sheet for that player (D3):
  two labelled rows, **Kenderaan** and **Haiwan**, five large tiles each (≥ 64 px, picture + name), the current
  choice ticked. One tap chooses and closes. The sheet fits 1024x600 without scrolling.
- The card picture updates at once; the "Sedia?" summary step shows each player's racer picture.
- Two pupils may choose the same racer (D4).
- `SetupState` gains `racers: RacerId[]` (length `MAX_PLAYERS`, defaults from `defaultRacerForSlot`).
  `buildSetupInput` passes `racers` for the active players; `AppController` builds
  `TrackPlayer = { id, name, style, racer }` (and the same for Ready and Results screens where a racer is shown).
- **Not saved** in `Settings` (D5): like names, it lives in memory for the app session, so "Main semula" and "New
  setup" keep it, and a page reload returns to the slot defaults. `sanitizeSettings` is unchanged;
  `storage.test.ts` gains an assertion that no racer key is written.
- Not recorded in evidence or CSV (D6): it is not learning evidence. `AttemptRecord` and `SessionMeta` unchanged.
- Menu and splash keep showing the default vehicles (optionally add a duck to the splash parade later).

## 7. Decisions for you (recommended answer first)

| #   | Question                            | Recommended                                                                                  | Alternatives                                                           |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1  | Which animals in the first version? | **Duck, goose, chicken, turtle, rabbit** (5, so the picker is a neat 5 + 5 grid)             | Only duck and goose; or other animals you name                         |
| D2  | Animal colour                       | **Player colour body**, orange beak/feet, white symbol badge (colour cue stays on the track) | Natural colours (white goose, yellow duck) + coloured scarf with badge |
| D3  | Picker style                        | **Tap the picture -> sheet with all 10 racers**                                              | ◀ ▶ arrows on each card (smaller, but children see one at a time)      |
| D4  | Same racer for two pupils?          | **Allowed** (colour + symbol + number still differ)                                          | Taken racers greyed out                                                |
| D5  | Remember the choice?                | **Memory only for the app session** (like names; nothing about a pupil is stored)            | Save per slot in Settings                                              |
| D6  | Record racer in evidence/CSV?       | **No**                                                                                       | Add a `racer` column                                                   |
| D7  | Animal sounds (quack on boost)?     | **Not in this step**; the boost sound is the same for all racers                             | Add short original sounds per animal                                   |

## 8. Files touched

| File                                                                           | Change                                                                                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game/core/racers.ts` (new)                                                | catalogue, names, `defaultRacerForSlot`, `isRacerId`                                                                                   |
| `src/game/core/players.ts`                                                     | `vehicle` -> `defaultRacer: RacerId`; drop `VehicleId`                                                                                 |
| `src/game/ui/racerShapes.ts` (new)                                             | `Pose`, `racerParts` for all 10 racers, gait maths                                                                                     |
| `src/game/ui/TrackView.ts`                                                     | `TrackPlayer.racer`; `drawRacer` renders parts; gait phase in `poseOf`; animal dust                                                    |
| `src/app/art.ts`                                                               | `vehicleSvg` -> `racerSvg(style, racer)` from parts                                                                                    |
| `src/app/setupState.ts`                                                        | `racers` in state and `SetupInput`                                                                                                     |
| `src/app/screens/SetupScreen.ts` (+ CSS)                                       | picture button, picker sheet, summary pictures                                                                                         |
| `src/app/AppController.ts`, Menu, Splash, Results                              | pass `racer`; menu/splash use defaults                                                                                                 |
| `src/locales/bm.ts`, `en.ts`                                                   | 10 racer names, "Tukar", "Pilih pelumba", "Kenderaan", "Haiwan"; help text wording                                                     |
| `src/tests/racers.test.ts` (new)                                               | catalogue unique, names in both languages, parts inside reach for every racer/pose, nose right-most, gait phase frame-rate independent |
| `src/tests/layout.test.ts`, `setup*.test.ts`, `app.test.ts`, `storage.test.ts` | defaults, picker changes racer, summary, racer never saved                                                                             |
| `e2e/setup.spec.ts` (or `mathracing.spec.ts`)                                  | pick duck for P1 and goose for P2, start, one screenshot mid-race at 1024x600 and 1920x1080; nose-on-mark check with the duck          |
| `docs/DECISIONS.md`                                                            | #39 racer choice (amends #35 "vehicles fixed per slot")                                                                                |
| README, help text, `PROJECT_STATE.md`, `docs/REPO-MAP.md` (`npm run docs:map`) | updated                                                                                                                                |

Note: `rocketNoseX` in `e2e/support.ts` finds player 1's nose from pixels; the nose check keeps the default rocket
and one extra check uses the duck.

## 9. Order of work (one commit each)

1. `racers.ts` + `racerShapes.ts` with the five existing vehicles; `TrackView` and `art.ts` render from parts.
   No visual change (unit tests + one before/after screenshot).
2. The five animals: shapes, gait, boost/slow/crawl body language; unit tests for bounds and gait.
3. Setup picker, `SetupState.racers`, plumbing to track/ready/results, locales, app tests.
4. E2E test, DECISIONS #39, help/README/PROJECT_STATE, `npm run docs:map`; full `npm run check` + `npm run test:e2e`;
   `npm run apk` for a tablet test.

## 10. Risks

- **Readability on a smartboard:** thin legs and necks can vanish at small lane heights (5 players on 1024x600).
  Parts use minimum stroke widths like the wheels do, and the step-2 screenshot at 1024x600 with 5 players is the
  check.
- **Children spending the lesson in the picker:** one tap to choose and close; the teacher can skip the step, the
  defaults are already set.
- **Bigger `TrackView`:** drawing moves out into `racerShapes.ts`, so `TrackView` gets smaller, not larger.
