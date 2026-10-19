# Implementation plan: Tahap 1 shows plain pictures, no operators

Status: **proposed, not implemented**. Prepared 2026-10-19.
Request: "for tahap 1 questions, make the questions more direct and not complicated. Just display images that kids
understand easily, instead of trying to show the operator in a visual form."

## Assumption to confirm

"Tahap 1" is read as **difficulty level 1, "1 Asas"** in Setup (the `setup.level` choices: 1 Asas, 2 Sederhana,
3 Mencabar, 4 Lanjutan), for both Year 1 and Year 2. Levels 2-4 stay as they are (DECISIONS #46).
If "Tahap 1" meant **Tahun 1**, say so: the same rules would then apply to every level of the Year 1 pack only
(see "Alternatives" below).

## What Tahap 1 shows today

After #46 a level 1 question is already picture-only, but five Tahap 1 templates still draw an **operation**, not just
a thing to count:

| Template               | What the pupil sees now (level 1)                          | The operator in the picture                 |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `y1-easy-add`          | two groups with a drawn **+** between them                 | the plus sign                               |
| `y1-easy-sub`          | objects, the last few **crossed out**                      | the cross marks                             |
| `y1-easy-one-more`     | one group and a **+1 / -1** badge                          | the +1 / -1 badge                           |
| `y1-easy-groups`       | circled groups of 2 (repeated addition)                    | the rings that mean "groups of"             |
| `y2-easy-add` / `-sub` | two sets of blocks with a **+**; or blocks **crossed out** | the plus sign, the cross marks              |
| `y2-easy-mul` / `-div` | circled equal groups; the "each" badge on sharing          | the rings and the "each" badge              |
| `y2-easy-blocks`       | rods **and** cubes (place value: 3 rods + 4 cubes = 34)    | none, but it needs tens-and-ones thinking   |
| pictograph, bar chart  | three or four rows or bars, one of them pointed at         | none, but the eye must find the pointed row |

Everything else at level 1 (count, coins, hour, units, sides, ruler, cup, fractions, RM1 notes) is already one picture
and one count and **does not change**.

## Principle

At Tahap 1 **the picture is a thing to look at and count, never a sum to work out.** A pupil never has to learn a
symbol (+, crossed out, +1, rings) to know what to do: they see some things, count them, type the number. Every Tahap 1
question uses the "?" badge (or none), never an operator badge.

## Changes at level 1 (the template keeps its id, topic, SK range and number pad)

Year 1:

- **add** (sums 2-5): one **single row** of objects with no plus and no gap; the two parts are only different colours.
  "How many altogether?" is just counting the row. Answer is still `a + b`.
- **sub** (from 2-5): draw **only the things that are left**, no crossed-out objects. Answer is still `a - b`.
  New hint: "Kira semua gambar." (the old hint mentioned crossed-out objects and would now be wrong, DECISIONS #44).
- **one more / one fewer**: draw **only the resulting group**, "?" badge, no +1 / -1 badge. Band becomes
  `count-after` so evidence does not claim a "one more" skill was shown.
- **equal groups** (2s, up to 10): two to five **pairs side by side with a small gap, no rings**; "?" badge.
  Answer is still `groups x size`.
- **count, money (10 sen coins), hour (1-6), units, sides, pictograph**: unchanged, except the pictograph below.

Year 2:

- **blocks** (10-49): **whole tens only** (1-5 rods, answer 10-50), no loose cubes; the pupil counts rods.
- **add / sub** (10-49): whole-ten rods only, two colours in one row with no plus; sub shows only the rods that are left.
  The answer is the number of rods times 10, so the pupil counts in tens (a Year 2 skill).
- **mul** (groups of 2 or 3, 2-4 groups, at most 12 things): spaced clusters, no rings. Level 1 of the multiplication
  template is now a counting question.
- **div** (share into 2 groups, 1-5 each): unchanged except the "each" badge becomes "?"; two identical groups are
  drawn and the pupil counts either one.
- **clock, ruler, cup, fractions, money, shape sides**: unchanged.

Both years:

- **pictograph and bar chart** at level 1: the rows or bars that are **not** asked about are drawn faded (35% alpha).
  The pointer stays. The pupil's eye lands on the one row to count. A new optional `dimOthers` field on the visual
  (set only at level 1) switches this on; levels 2-4 keep the current look.

## Code touched

| File                                            | Change                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `curriculum/visual.ts`                          | `dimOthers?: boolean` on pictograph and bar chart; validator unchanged otherwise                   |
| `curriculum/generators/easyY1.ts`               | level 1 branches for add, sub, one-more, groups, pictograph; new hints and bands                   |
| `curriculum/generators/easyY2.ts`               | level 1 branches for blocks, add, sub, mul, div, bar chart; `levelNotes` rewritten                 |
| `curriculum/generators/easyShared.ts`           | `countPicture` accepts "merged colours" (no `join`, no gap); a small helper for level 1 groups     |
| `game/ui/VisualRenderer.ts`                     | faded rows and bars when `dimOthers`; merged-colour row for objects and blocks; no ring at level 1 |
| `curriculum/packs/kpm-ms-y1-v1.ts`, `...-y2-v1` | version 2.0.1 to 2.1.0 (content changed, SK and SP mapping unchanged)                              |
| `docs/DECISIONS.md`                             | new entry #47 (below); `docs/CURRICULUM-MAPPING.md` regenerated with `npm run docs:curriculum`     |

No new files are expected; if one is added, run `npm run docs:map`. No change to storage, evidence or CSV columns.
Levels 2-4 draw exactly what they draw today.

## Tests

- `curriculum.test.ts`: for every template at level 1 (1,000 samples), the visual has **no `join`, no `crossed`, no
  ring**, the cue is `count`, `sides`, `corners`, `hour` or `none`, never `plus-one`, `minus-one` or `each`, and the
  answer still equals what is drawn (count of drawn things, or rods times 10).
- Existing #44 cross-check (text, picture, answer, hint agree) must stay green; the new sub hint is the case to watch.
- `cues.test.ts`: the "draws no text" test keeps passing; add one test that a level 1 pictograph and bar chart fade the
  other rows and leave the asked one at full strength.
- Counted-thing size tests (6 px on a 5-player panel from 960x540) stay; a single merged row of up to 10 is within them.
- One Playwright screenshot of level 1 add and one of the pictograph at 1280x800 with 2 players to check the look.
  Then `npm run check` once and `npm run test:e2e` once (the e2e computes questions from the app's own modules, so a
  changed level 1 sample needs no test edits unless a fixture hard-codes a sum).

## DECISIONS entry to append (#47)

"Tahap 1 shows plain pictures, no operators (owner request; amends #45 and #46). At level 1 (1 Asas) in both years,
addition is one row of two colours with no plus, take-away shows only what is left with nothing crossed out, one more /
one fewer shows the result group, equal groups and sharing have no rings, Year 2 place value uses whole-ten rods, and
the pictograph and bar chart fade every row but the asked one. The questions are counting questions with the same
answers as before. Levels 2-4 are unchanged. Coverage consequence: the idea of an operation (join, remove, equal
groups) is first drawn at level 2; at level 1 the learning standards for operations are met only as counting.
Packs 2.1.0."

## Risks and notes for the reviewer

- **Curriculum coverage.** At level 1, "add", "take away", "one more" and "groups" become counting. A class that uses
  only level 1 will not see an operation drawn at all. This is what was asked, and it is the main thing the reviewer of
  the draft packs should know. Teachers who want operations pick level 2.
- **Sub and one-more look like plain counting.** A pupil may meet the same picture type in several topics. That is
  intended; the topic and band in the evidence still say which template made it.
- **Same pictures as Year 1.** Year 2 level 1 is now as easy as a Year 1 count (tens instead of ones).
- **Not changed:** the number pad, the feedback marks, Setup, Results and Teacher screens, levels 2-4.

## Alternatives (not recommended unless you say so)

1. **All levels, not only Tahap 1.** Remove operators everywhere. Simpler code (delete `join`, `crossed` and the
   `plus-one` / `minus-one` / `each` cues), but then no level teaches adding or taking away. Not chosen because #46 was
   accepted with operators at levels 2-4.
2. **"Tahap 1" means Tahun 1.** Apply the same rules to all four levels of the Year 1 pack, leave Year 2 untouched.
3. **Ghost slots for what was taken away** (empty outlines where objects were) instead of removing them. Rejected: the
   outlines add clutter and a pupil may count them.

## Order of work (one commit each)

1. Visual model and renderer: `dimOthers`, merged-colour row, no rings at level 1, with tests.
2. Year 1 level 1 templates, hints and bands, with tests.
3. Year 2 level 1 templates, with tests.
4. Pack versions, `npm run docs:curriculum`, DECISIONS #47, `npm run check`, `npm run test:e2e`.
