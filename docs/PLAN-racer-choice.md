# Implementation plan: pupils choose their racer (vehicles or animals such as a duck or goose)

Status: **decisions answered, not implemented.** The owner answered D1-D7 (section 7); every section below
follows those answers. Say "proceed" to build it.

## 1. What is being asked

Today each slot has a fixed vehicle (slot 1 rocket, 2 kart, 3 wedge, 4 saucer, 5 block; DECISIONS #35 "Vehicles
stay fixed per slot"). The owner wants each pupil to **choose the object that runs to the finish line**, and the
choice should include **animals such as a duck (itik) or a goose (angsa)**, not only cars.

## 2. What stays the same

- **Colour, symbol and number stay tied to the slot.** They are the accessibility cue (never colour alone) and they
  match the pupil's answer panel. Only the _shape_ of the racer becomes a choice.
- Race rules and cruise/boost/slow/crawl: unchanged. The racer is a costume, not a rule. Evidence and CSV only
  gain a record of which racer each pupil used (D6).
- Default racer for each slot = today's vehicle, so a class that ignores the picker sees exactly today's game.
- Two pupils can never pick the same racer (D4), and every racer still carries the slot's colour and white symbol
  badge (on animals: a scarf in the player colour, see section 5), so colour + symbol + lane number + shape still
  tell pupils apart.

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
- **Natural colours (D2).** Each animal has fixed natural colours, the same for every slot:

  | Animal  | Body                                | Details                         |
  | ------- | ----------------------------------- | ------------------------------- |
  | Duck    | yellow (`#facc15`)                  | orange beak and feet            |
  | Goose   | white (`#f8fafc`)                   | orange beak and feet, grey wing |
  | Chicken | light brown (`#d6a36a`)             | red comb, yellow beak and legs  |
  | Turtle  | green shell (`#4d7c0f`), olive skin | darker shell plates             |
  | Rabbit  | light grey (`#d1d5db`)              | pink inner ears, white tail     |

  The player's identity is carried by a **scarf (or saddle cloth on the turtle) in the player colour** with the
  white symbol badge on it, so the colour cue stays on the track. The scarf is large (the badge is the same size
  as on a vehicle) and tails out behind while moving. Outlines use a dark neutral (`#1f2937`) so a white goose
  and a grey rabbit stay visible on the grey road (checked in the 5-player screenshot).

- Unit test: the animal body colours are fixed, the scarf colour always equals `style.color`, and the badge is
  present for every racer and pose.

## 6. Choosing the racer (Setup step 3, "Pemain")

- Each player card already shows its racer picture above the name field. The picture becomes a **button**
  ("Tukar" / "Change" under it). Tapping it opens a picker sheet for that player (D3):
  two labelled rows, **Kenderaan** and **Haiwan**, five large tiles each (≥ 64 px, picture + name), the current
  choice ticked. One tap chooses and closes. The sheet fits 1024x600 without scrolling.
- The card picture updates at once; the "Sedia?" summary step shows each player's racer picture.
- **Taken racers are greyed out (D4).** In the sheet, a racer used by another _active_ player is dimmed, shows that
  player's small symbol badge ("dipilih oleh Pemain 2"), and cannot be tapped. With 10 racers and at most 5
  players there is always a free choice. Pure helper `takenRacers(racers, playerCount, exceptSlot)` in
  `setupState.ts` (unit-tested). If the player count grows and a hidden slot's saved racer clashes with a visible
  one, the newly shown slot gets its default racer, or the first free one if that is taken
  (`resolveRacers(racers, playerCount)`, run on every count change and on load).
- `SetupState` gains `racers: RacerId[]` (length `MAX_PLAYERS`, defaults from `defaultRacerForSlot`).
  `buildSetupInput` passes `racers` for the active players; `AppController` builds
  `TrackPlayer = { id, name, style, racer }` (and the same for Ready and Results screens where a racer is shown).
- **Saved on the device (D5).** `Settings` gains `racers: RacerId[]` (one per **slot**, 5 entries), saved with the
  other classroom choices in localStorage, so the next lesson on the same tablet starts with the same picks. This
  is tied to the seat (Pemain 1-5), never to a pupil's name, so the hard rule "player names are never persisted"
  still holds; names stay memory-only. `sanitizeSettings`: unknown ids -> slot default, then `resolveRacers` makes
  them unique. Old stored settings without `racers` get the defaults (no revision bump needed). The teacher screen
  gains no new option; the choice is made in Setup.
- **Recorded in evidence and CSV (D6).** `SessionMeta` gains `playerRacers: RacerId[]` (parallel to
  `playerNames`), and the CSV gains a `racer` column (the racer's stable id, e.g. `duck`, so it does not change
  with the UI language), filled per attempt row from the player's slot. The teacher evidence view shows the racer
  picture next to each name. Old sessions in IndexedDB without `playerRacers` export an empty `racer` cell.
  `storage.test.ts` fixtures and the CSV header test are updated (AGENTS.md trap).
- No new sounds (D7): the boost/slow sounds are the same for every racer.
- Menu and splash keep showing the default vehicles (optionally add a duck to the splash parade later).

## 7. Decisions (answered by the owner)

| #   | Question                            | Answer                                                                                   |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| D1  | Which animals in the first version? | **All five: duck, goose, chicken, turtle, rabbit**                                       |
| D2  | Animal colour                       | **Natural colours**, identity on a player-colour scarf with the symbol badge (section 5) |
| D3  | Picker style                        | **Tap the picture -> sheet with all 10 racers**                                          |
| D4  | Same racer for two pupils?          | **No: taken racers are greyed out** (section 6)                                          |
| D5  | Remember the choice?                | **Saved on the device**, per slot, in `Settings` (never tied to a name)                  |
| D6  | Record racer in evidence/CSV?       | **Yes**: `SessionMeta.playerRacers` and a CSV `racer` column                             |
| D7  | Animal sounds?                      | **No**                                                                                   |

## 8. Files touched

| File                                                                           | Change                                                                                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game/core/racers.ts` (new)                                                | catalogue, names, `defaultRacerForSlot`, `isRacerId`                                                                                   |
| `src/game/core/players.ts`                                                     | `vehicle` -> `defaultRacer: RacerId`; drop `VehicleId`                                                                                 |
| `src/game/ui/racerShapes.ts` (new)                                             | `Pose`, `racerParts` for all 10 racers, gait maths                                                                                     |
| `src/game/ui/TrackView.ts`                                                     | `TrackPlayer.racer`; `drawRacer` renders parts; gait phase in `poseOf`; animal dust                                                    |
| `src/app/art.ts`                                                               | `vehicleSvg` -> `racerSvg(style, racer)` from parts                                                                                    |
| `src/app/setupState.ts`                                                        | `racers` in state and `SetupInput`; `takenRacers`, `resolveRacers`; to/from `Settings`                                                 |
| `src/storage/settings.ts`                                                      | `racers` per slot, sanitised (valid ids, unique)                                                                                       |
| `src/game/core/RaceState.ts`, `RaceEngine`, `src/reporting/exportCsv.ts`       | `SessionMeta.playerRacers`; CSV `racer` column; teacher evidence shows the racer                                                       |
| `src/app/screens/SetupScreen.ts` (+ CSS)                                       | picture button, picker sheet, summary pictures                                                                                         |
| `src/app/AppController.ts`, Menu, Splash, Results                              | pass `racer`; menu/splash use defaults                                                                                                 |
| `src/locales/bm.ts`, `en.ts`                                                   | 10 racer names, "Tukar", "Pilih pelumba", "Kenderaan", "Haiwan"; help text wording                                                     |
| `src/tests/racers.test.ts` (new)                                               | catalogue unique, names in both languages, parts inside reach for every racer/pose, nose right-most, gait phase frame-rate independent |
| `src/tests/layout.test.ts`, `setup*.test.ts`, `app.test.ts`, `storage.test.ts` | defaults, picker changes racer, taken racers disabled, summary, racers saved per slot and sanitised, CSV `racer` column, old sessions  |
| `e2e/setup.spec.ts` (or `mathracing.spec.ts`)                                  | pick duck for P1 and goose for P2, start, one screenshot mid-race at 1024x600 and 1920x1080; nose-on-mark check with the duck          |
| `docs/DECISIONS.md`                                                            | #39 racer choice (amends #35 "vehicles fixed per slot")                                                                                |
| README, help text, `PROJECT_STATE.md`, `docs/REPO-MAP.md` (`npm run docs:map`) | updated                                                                                                                                |

Note: `rocketNoseX` in `e2e/support.ts` finds player 1's nose from pixels; the nose check keeps the default rocket
and one extra check uses the duck.

## 9. Order of work (one commit each)

1. `racers.ts` + `racerShapes.ts` with the five existing vehicles; `TrackView` and `art.ts` render from parts.
   No visual change (unit tests + one before/after screenshot).
2. The five animals: shapes, gait, boost/slow/crawl body language; unit tests for bounds and gait.
3. Setup picker with taken racers greyed out, `SetupState.racers`, saved `Settings.racers`, plumbing to
   track/ready/results, locales, app and storage tests.
4. Evidence: `SessionMeta.playerRacers`, CSV `racer` column, teacher evidence picture; fixtures updated.
5. E2E test, DECISIONS #39, help/README/PROJECT_STATE, `npm run docs:map`; full `npm run check` + `npm run test:e2e`;
   `npm run apk` for a tablet test.

## 10. Risks

- **Readability on a smartboard:** thin legs and necks can vanish at small lane heights (5 players on 1024x600).
  Parts use minimum stroke widths like the wheels do, and the step-2 screenshot at 1024x600 with 5 players is the
  check.
- **Children spending the lesson in the picker:** one tap to choose and close; the teacher can skip the step, the
  defaults are already set.
- **Natural colours on a grey road:** a white goose or grey rabbit could blend in; dark outlines plus the
  player-colour scarf are the fix, and the screenshots check it.
- **Saved racers and the "no pupil data" rule:** only racer ids per seat are stored, never names; DECISIONS #39
  says so explicitly.
- **Bigger `TrackView`:** drawing moves out into `racerShapes.ts`, so `TrackView` gets smaller, not larger.
