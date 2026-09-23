# Implementation plan: start line, step marks and finish line that fit every screen

Status: implemented (D1-D3, D5 as recommended; D4 kept the thin marks). Target screens: Android tablets (1280x800, 1920x1200) and TV smartboards
(1920x1080 CSS pixels, often 3840x2160 at 2x), plus desktop windows.

## 1. What is being asked

On bigger screens the start line, the step marks ("dots") along each lane and the finish line drift away from where
the cars actually are. They should be placed from the same numbers the cars use, so the marks line up with the cars
on any screen size and with any number of players.

## 2. Current behaviour and the cause

Everything is in `src/game/ui/TrackView.ts`: `lanes()` (lines 177-197), `racerGeometry()` (200-216) and the drawing
in `render()` (317-385). Three different formulas place the three things:

| Thing               | Formula today                                                       | Scales with           |
| ------------------- | ------------------------------------------------------------------- | --------------------- |
| Start line (dashes) | `startX - laneH * 0.35`, where `startX = rect.x + rect.w * 0.085`   | width AND lane height |
| Step marks          | spread from `startX` to `finishX - checkerW`                        | width                 |
| Car at step s       | spread from `startX + size*0.5` to `finishX - checkerW - size*0.55` | width AND car size    |
| Finish chequer      | `rect.x + rect.w * 0.925`, width `rect.w * 0.02`                    | width                 |

Measured in your screenshot (2000 px wide track, 2 players, 8 steps):

- the start line is at x = 96, but the car's nose at step 0 is at about 340: a 250 px gap;
- the step marks are 205 px apart, starting at 375; the car's steps are 183 px apart;
- after one correct answer the car's nose is at about 525, **150 px past** the first mark; the error changes at every
  step and only disappears at the finish;
- the start line runs through the lane badges, because it is pulled left by a lane-height amount.

A taller lane (fewer players or a bigger screen) makes the car and the `laneH * 0.35` offset bigger, while the marks
only follow the width. That is why it looks fine at 1920x1080 with 5 players and wrong on a large 2-player screen.

## 3. Proposed design

### 3.1 One pure geometry function (new file `src/game/ui/trackGeometry.ts`)

```ts
export type TrackGeometry = {
  top: number;
  laneH: number;
  badge: { cx: number; r: number }; // lane badge (colour + symbol + number)
  carSize: number;
  startLineX: number; // x of the start line = nose position at step 0
  finishLineX: number; // left edge of the chequer = nose position at the last step
  checkerW: number;
  noseAt(steps: number): number; // fractional steps allowed (the car is moving)
  markXs: number[]; // step marks 1..raceLength-1, equal to noseAt(s)
};
export function computeTrackGeometry(
  rect: Rect,
  playerCount: number,
  raceLength: number,
): TrackGeometry;
```

Pure, no Phaser, like `layout.ts`, so unit tests and e2e can use it. `TrackView.lanes()` and `racerGeometry()` are
replaced by it; `render()` only draws what it returns.

### 3.2 Placement rules

1. **The car's nose is the reference point** (D1). The step marks, the start line and the finish line are all
   positions of the nose, so a car "arrives" exactly on a mark and "crosses" the finish line on the last answer.
   Car centre = `noseAt(s) - carSize * 0.55` (the current nose offset in the car drawing).
2. **Left edge, built from the inside out, in pixels derived from lane height** (D3), not from width percentages:
   `pad` (screen edge) -> lane badge -> small gap -> the car's full length -> **start line**. At step 0 the car sits
   just behind the line, nose touching it (D2).
3. **Right edge:** `finishLineX = rect right - pad - checkerW`. The chequer width comes from the lane height, not
   from the width.
4. **Steps:** `noseAt(s) = startLineX + (finishLineX - startLineX) * s / raceLength`. The marks are
   `noseAt(1..raceLength-1)`: they are the car positions by construction.
5. **Clamps**, so very large or very small screens stay sensible (starting values, tuned during work):
   `pad = clamp(w * 0.01, 8, 24)`, badge radius `clamp(laneH * 0.3, 12, 44)`, `checkerW = clamp(laneH * 0.2, 14, 44)`,
   car size unchanged (`min(laneH * 0.78, w * 0.085)`).
6. **Labels** ("MULA", "PENAMAT") are centred over the start line and the chequer.
7. Wheel spin keeps using the pixels per step, now `(finishLineX - startLineX) / raceLength`.

Nothing else changes: lane heights, the lane dividers, the motion spring, the particles and the panels are untouched.

## 4. Tests

- **New `src/tests/trackGeometry.test.ts`**, run over these combinations: widths/heights 1280x800, 1920x1200,
  1920x1080, 2560x1440, 3840x2160, 1024x600; 2 to 5 players; race lengths 5, 8, 10 and 12. It checks that:
  - `markXs[s-1] === noseAt(s)` and the gaps between marks are equal;
  - `noseAt(0) === startLineX` and `noseAt(raceLength) === finishLineX`;
  - at step 0 the car's tail is to the right of the lane badge (no overlap), and the start line does not cross the
    badge;
  - the chequer and every car at the last step stay inside the track rectangle;
  - the space between steps is at least one car length × 0.5 on every target screen (still readable at 12 steps on
    a 1280 px tablet).
- `motion.test.ts` needs no changes (motion works in steps, not pixels).
- **Playwright:** the existing "layout at classroom resolutions" tests, plus one screenshot at 2560x1440 with 2
  players after one correct answer, to check by eye that the nose sits on mark 1.

## 5. Files touched

| File                                    | Change                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| `src/game/ui/trackGeometry.ts` (new)    | pure geometry, section 3                                         |
| `src/game/ui/TrackView.ts`              | use it; delete `lanes()` / `racerGeometry()` maths               |
| `src/tests/trackGeometry.test.ts` (new) | section 4                                                        |
| `e2e/mathracing.spec.ts`                | one screenshot step in the layout describe                       |
| `docs/DECISIONS.md`                     | #34: the track marks are car positions; margins from lane height |
| `docs/ARCHITECTURE.md`                  | one line on `trackGeometry`                                      |
| `docs/REPO-MAP.md`                      | regenerate (`npm run docs:map`)                                  |

Size: small to medium, about one session. Two commits: (1) geometry + unit tests, (2) TrackView switch + e2e +
docs.

## 6. Decisions needed from you

- **D1 Reference point.** The marks show where the car's **nose** arrives (recommended: it reads as "reached the
  line"), or where its **centre** is.
- **D2 Car at the start.** The car waits **behind** the start line with its nose on it (recommended, like a real
  grid), or it straddles the line.
- **D3 Margins.** Margins scale with **lane height, with px limits** (recommended: stays tight on big screens), or
  keep width percentages and only fix the alignment (smaller change, but still wide gaps on very wide screens).
- **D4 Step marks look.** Keep the thin vertical marks, or change them to round dots (you called them "dots"). This
  is a style choice only; the plan works either way.
- **D5 Where step 0 and the last step are marked.** Only by the start line and the chequer (recommended, as today),
  or also by a mark.

## 7. Acceptance checklist

- [ ] On every screen in section 4, after each correct answer the nose sits on the next mark (±1 px).
- [ ] The start line never crosses a lane badge; the car at step 0 is fully between badge and start line.
- [ ] The finish chequer sits near the right edge of the track on 1280 to 3840 px wide screens.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` green; DECISIONS #34 added; repo map
      regenerated.
