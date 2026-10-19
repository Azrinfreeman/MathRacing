# Implementation plan: replace the confusing "one more / one fewer" badge

Status: **implemented (DECISIONS #49; the owner asked for every badge to change, not only one more / one fewer)**. Prepared 2026-10-20.
Request: the screenshot (Pemain 1, five purple stars, a white box with an orange dot and a dash) "is too complicated for
the kid, even the adult tester; we don't understand what this question means. If you can come up with something better,
or remove them entirely, that is good for Tahap 2."

## Assumptions to confirm

1. The screenshot is **Year 1, level 2, "one fewer"** (`y1-easy-one-more`, band `one-fewer`): the group of stars is the
   start, and the badge (`minus-one`: one orange dot and a minus sign) is supposed to mean "take one away". Its twin
   `plus-one` is the same box with a plus sign. The five stars are the start, so the expected answer is 4: the
   picture shows what to start from, not the result.
2. "Tahap 2" is **level 2** (the same reading as `PLAN-tahap1-direct.md`). The badge is also drawn at levels 3 and 4,
   where it is just as unclear, so the fix covers levels 2 to 4. Level 1 is already plain (DECISIONS #47) and stays.
3. "These type of question" means a question whose meaning is carried only by a small abstract icon in a box. The fix
   below is for the one in the screenshot. The other icon boxes are listed in "Other badges" for a separate decision.

## Why it is confusing

The pupil panel has no words (DECISIONS #46), so the question "what is one fewer than 6?" is squeezed into one icon:
a dot and a dash. A child has to know that the dot is "one thing" and that the dash is "take away", and then do the
sum in their head from a picture that shows the **start**, not the result. Nothing on screen shows the change. The
other picture questions work because the picture is the thing to count, and the "?" says "how many".

## Options

| Option                                                                                                         | Verdict                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A. **Draw the change in the picture** (below). Remove the badge; the cue becomes the plain "?"                 | **Recommended.** The pupil sees what happens and counts; no symbol to decode                                  |
| B. Remove the template at levels 2 to 4                                                                        | Loses "one more, one fewer" from SK 1.1-1.5 and leaves `y1-numbers` with one template; needs a per-level rule |
| C. Keep the badge but draw it larger or add an arrow                                                           | Still a symbol; the adult tester would still ask what it means                                                |
| D. Show the equation always on these two ("6 - 1 = ?"), picture alone is then a counting question with a badge | Equation is already drawn on about half at level 2 (#48); making it every time removes the picture-only mix   |

## The change (option A)

At levels 2, 3 and 4 the question becomes an ordinary "how many" picture, built from pictures that already exist:

- **One more** (`more = true`): the start group in its colour, then **one extra object in a different colour** after
  the drawn "+" (the picture kind `objects` / `ten-frames` with `join: 'plus'`, the same drawing as `y1-easy-add`
  with the second part equal to 1). The pupil counts every object.
- **One fewer** (`more = false`): the start group with **one object crossed out** (`crossed: 1`, the same drawing as
  `y1-easy-sub`). The pupil counts the ones not crossed out.
- The badge is the plain "?" (`cue: 'count'`). `plus-one` and `minus-one` are no longer produced.
- The Tahap 2 equation line from #48 keeps working: `4 + 1 = ?` / `6 - 1 = ?` over the picture on about half.
- The answer does not change: `count + 1` or `count - 1`. The sampled params (`count`, `more`, `shape`, `colorIdx`,
  `eq`) and their draw order do not change, so a seeded session keeps the same numbers and shapes; only the picture
  and the badge differ. `recompute` is unchanged.
- The help after two wrong answers matches the picture: "Count all of them" for one more, "Count only the ones not
  crossed out" for one fewer (the same strings `y1-easy-add`/`y1-easy-sub` use); the ten-frames rearrangement stays.
- The band names `one-more` / `one-fewer` stay, so the teacher evidence keeps its groupings.

Level 1 is untouched: it already draws the result as a plain group (#47).

## Other badges (for a separate decision, not in this change)

These are the remaining icon boxes on a pupil panel. The picture itself is the thing named in each, so I would keep
them, but they are the next candidates if testers find them unclear:

| Badge (`Cue`)                   | Where                                        | What the picture shows                       |
| ------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `each` (ring with three dots)   | `y2-easy-div` at levels 2-4                  | groups in rings, "how many in each group"    |
| `shaded` / `parts` (cell bar)   | `y2-easy-fraction-parts`                     | a pie or bar; the badge repeats which to ask |
| `sides` / `corners` (square)    | `y1-easy-shape-count`, `y2-easy-shape-count` | one flat shape                               |
| `hour` / `minute` (small clock) | `y1-easy-clock-hour`, `y2-easy-clock`        | a clock; the badge marks the hand to read    |

`each` is the most likely to confuse (a division with no sum on half the questions). If you want it changed too, the
same approach fits: draw the groups and ring only the first one in orange with the others faded, with the plain "?".
Say so and I will add it as a second step; it is not assumed here.

## Data and code touched

| File                                        | Change                                                                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curriculum/generators/easyY1.ts`           | `oneMore.build` at levels 2+: two-part picture with `join: 'plus'` or one crossed out; `cue: 'count'`; new hints                                                                          |
| `curriculum/schema.ts`                      | remove `plus-one` and `minus-one` from `Cue` and `CUES`                                                                                                                                   |
| `game/ui/cueIcons.ts`                       | remove the dot-and-sign branch; keep `drawSign` only if something else uses it (the picture code does)                                                                                    |
| `tests/cues.test.ts`                        | replace "one more needs +1 / one fewer needs -1" with: every level 2-4 one-more/one-fewer has the `?` cue; the level 1 "no badge" check drops the two removed cues                        |
| `tests/curriculum.test.ts`                  | `expectPictureMatchesQuestion`: one-more picture total plus or minus one is no longer needed; the picture total (counting crossed as not counted) must equal the answer, like add and sub |
| `curriculum/packs/kpm-ms-y1-v1.ts`          | version 2.2.0 to 2.3.0 (content changed; SK and SP mapping unchanged)                                                                                                                     |
| `docs/DECISIONS.md`, `README.md`            | entry #49 (amends #46 and #48); the README sentence about badges                                                                                                                          |
| `docs/CURRICULUM-MAPPING.md`, `REPO-MAP.md` | regenerated (`npm run docs:curriculum`, `npm run docs:map`)                                                                                                                               |

No change to storage, evidence, CSV columns, settings, the number pad or the layout. No new files are expected.

## Tests

- `cues.test.ts`: over 400 samples per level, every `y1-easy-one-more` question at levels 2 to 4 has the `?` cue, a
  picture with exactly one extra object (`more`, `join: 'plus'`, second part count 1) or exactly one crossed out
  (`!more`), and the answer equals the visible count (crossed ones not counted).
- `cues.test.ts`: no question at any level produces `plus-one` or `minus-one` (and the cue type no longer has them).
- `countLayout.test.ts`: the "one more" start groups up to 20 at levels 3 and 4 still meet the counted-thing size
  floor with the plus picture (two parts) on a 5-player 960x540 panel.
- One Playwright screenshot of a level 2 one-fewer and a one-more question at 1280x800 with 2 players (temporary spec,
  deleted afterwards), then `npm run check` and `npm run test:e2e` once.

## DECISIONS entry to append (#49)

"The change is drawn, not signed (owner request; amends #46 and #48). The 'one more / one fewer' badge (a dot and a
plus or minus) was not understood by pupils or adult testers. At levels 2 to 4 'one more' now draws the group and one
extra object in another colour after a plus, and 'one fewer' draws the group with one object crossed out, both with
the plain '?' badge; the pupil counts what is shown. The `plus-one` and `minus-one` cues are removed. Levels,
numbers, answers, band names, evidence and CSV are unchanged. Pack 2.3.0."

## Risks and notes for the reviewer

- **The picture now repeats `y1-easy-add` / `y1-easy-sub` with the second number fixed at 1.** That is the honest
  picture of "one more" and "one fewer", and `y1-numbers` and `y1-operations` are separate topics. If you would rather
  not have two templates that look alike, option B removes this one, at the cost of the curriculum point.
- **Easier than before.** Levels 2 to 4 of this template become counting, like add and sub; the reasoning step
  ("what comes before 6?") disappears. That is the intent of the request (quick, no decoding), but a teacher who wants
  the number-sense skill will see it as counting. The equation line at level 2 still shows the idea on half.
- **Not changed:** levels 1, the other templates, Year 2, the number pad, feedback marks, Setup, Results, Teacher.

## Order of work (one commit each)

1. `easyY1.ts` picture and hints, `schema.ts` and `cueIcons.ts` cue removal, with the `cues` and `curriculum` tests.
2. Pack version, DECISIONS #49, README, `npm run docs:curriculum`, `npm run docs:map`, `npm run check`,
   `npm run test:e2e`.
