# Implementation plan: Tahap 2 shows the equation on some questions

Status: **implemented** (DECISIONS #48; Year 1 equal groups was left out, see the decision). Prepared 2026-10-19.
Request: "for level 2 questions make it the same as well, only visual, but this time include the text for the equation
like 1 + 1 = ?, and make it like that randomly, with visual only."

## Assumptions to confirm

1. "Level 2" is **difficulty level 2, "2 Sederhana"**, in both Year 1 and Year 2 (the same reading as Tahap 1 in
   `PLAN-tahap1-direct.md`). Levels 1, 3 and 4 do not change.
2. "Randomly with visual only" means: on level 2 each question that has a sum **randomly** either shows the picture with
   the equation line above it, or shows the picture alone (as today). About half and half, chosen by the seeded random
   generator, so a session with a given seed always gives the same mix.
3. "Only visual" still holds for everything else: no sentence, no instruction, no unit label. The **only** text on a
   level 2 pupil panel is the equation line, and only when it was randomly chosen.

## What level 2 shows today

After #46 and #47, level 2 is picture-only. The data already carries the equation for six templates (it is how the
Setup preview and the teacher view show a question), but the pupil panel does not draw it:

| Template                | Equation already in the data | Level 2 picture today                       |
| ----------------------- | ---------------------------- | ------------------------------------------- |
| `y1-easy-add`           | `a + b = ?`                  | two groups with a drawn "+"                 |
| `y1-easy-sub`           | `a - b = ?`                  | objects, the last few crossed out           |
| `y2-easy-add`           | `a + b = ?`                  | two sets of blocks with a "+"               |
| `y2-easy-sub`           | `a - b = ?`                  | blocks, some crossed out                    |
| `y2-easy-mul`           | `groups x size = ?`          | equal groups in rings                       |
| `y2-easy-div`           | `total / groups = ?`         | groups in rings and the "each" badge        |
| `y1-easy-one-more`      | none                         | one group and a +1 / -1 badge               |
| `y1-easy-groups`        | none                         | circled groups (repeated addition)          |
| everything else (count, | none                         | one picture to count; nothing to write as a |
| money, clock, ...)      |                              | sum, so these never get an equation line    |

The layout code (`computePromptLayout` with `hasExpression`, an equation strip taking the top 26% of the prompt zone)
and its tests were kept when #46 removed the line, so the room for it already exists.

## The change

On level 2 only, when a question has a sum, the generator **randomly marks it "show the equation"**. The pupil panel
then draws:

```
   3 + 2 = ?          <- equation strip, large bold numerals and operator (font text)
   [ picture ]        <- the same picture as today, in the remaining 74% of the zone
```

and, because the "?" is now in the equation, the small cue badge is not drawn beside the picture for that question
(`computePromptLayout` already does this). A question not chosen looks exactly as it does today.

Equation text per template (the symbols already used by `MINUS`, `TIMES`, `DIVIDE`):

- Y1 add `3 + 2 = ?`, Y1 sub `5 - 2 = ?`, Y2 add `23 + 14 = ?`, Y2 sub `35 - 12 = ?`, Y2 mul `3 x 4 = ?`, Y2 div
  `12 / 3 = ?`: all exist already.
- **New** for Y1 one more / one fewer: `4 + 1 = ?` or `4 - 1 = ?` (the picture shows the start group).
- **New** for Y1 equal groups: repeated addition `2 + 2 + 2 = ?` (Year 1 is not taught the times sign).

The help after two wrong answers is unchanged (a lightbulb and the rearranged picture); the equation stays on screen.

## Data and code touched

| File                                            | Change                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `curriculum/schema.ts`                          | `PromptModel.showExpression?: boolean`; validator: it may only be true when `expression` is set                  |
| `curriculum/generators/builders.ts`             | `numberBuilt` accepts and passes `showExpression`                                                                |
| `curriculum/generators/easyShared.ts`           | `EQUATION_CHANCE = 0.5` and `equationShown(rng, level)`: true only at level 2, and it draws from `rng` only then |
| `curriculum/generators/easyY1.ts`               | add, sub, one-more, groups: a sampled `eq` param, the new expressions, `showExpression: p.eq`                    |
| `curriculum/generators/easyY2.ts`               | add, sub, mul, div: a sampled `eq` param, `showExpression: p.eq`                                                 |
| `game/ui/PanelView.ts`                          | `drawPrompt`: `hasExpression: q.prompt.showExpression === true`; draw the equation strip as bold ink text        |
| `curriculum/packs/kpm-ms-y1-v1.ts`, `...-y2-v1` | version 2.1.0 to 2.2.0 (content changed, SK and SP mapping unchanged)                                            |
| `docs/DECISIONS.md`, `README.md`                | entry #48; one sentence in the README (and the help text if it says "no text")                                   |

Notes:

- `equationShown` only touches the random stream on level 2, so seeded questions at levels 1, 3 and 4 do not change.
- The new sampled param is not used by `recompute` (the answer does not depend on it), so the #44 recompute check
  stays valid.
- No new files are expected; if one is added, run `npm run docs:map`. No change to storage, evidence or CSV columns.
- The e2e suite computes the questions and tap positions from the app's own modules, so it follows the new samples
  without edits. The number pad is the only widget and does not move.

## Tests

- `curriculum.test.ts`: over 1,000 samples per template at level 2, `showExpression` is true for between 40% and 60%
  of questions; at levels 1, 3 and 4 it is never true; when true, `expression` exists, ends in `= ?` and evaluates to
  the accepted answer (parse `+`, `-`, `x`, `/` in the test, one rule for all eight templates).
- `curriculum.test.ts`: the same seed gives the same mix twice (reproducible sessions).
- `cues.test.ts`: the "draws no text" recording-context test is relaxed in exactly one way: the only text call allowed
  is the equation, and only when `showExpression` is true. Every other draw (all pictures, hint pictures, badges) must
  still record no text. A second test checks that a question with an equation gets no cue badge and the layout's
  `visual` rect still passes the counted-thing size rule.
- `countLayout.test.ts`: already has the `hasExpression` case; extend it to the level 2 questions that will show the
  line (6 px counted things on a 5-player panel from 960x540 must still hold with the picture 26% shorter). If a
  picture is too tight, fall back to **not** showing the equation for that sample rather than shrinking the picture.
- One Playwright screenshot of a level 2 add question with the equation and one without, at 1280x800 with 2 players.
  Then `npm run check` once and `npm run test:e2e` once.

## DECISIONS entry to append (#48)

"Tahap 2 may show the equation (owner request; amends #46 for level 2). At level 2 ('2 Sederhana') in both years, a
question that has a sum randomly (about half, from the session seed) draws the equation above the picture, such as
'3 + 2 = ?', in large numerals; the other half stay pictures only. It is the only text on a pupil panel, and the small
'?' badge is left out when the equation is shown. Year 1 one more / one fewer and equal groups gain an equation
('4 + 1 = ?', '2 + 2 + 2 = ?'). Levels 1, 3 and 4 are unchanged. Evidence, CSV and settings are unchanged: the attempt
does not record whether the equation was shown. Packs 2.2.0."

## Risks and notes for the reviewer

- **Level 2 is the first place the symbols are read.** Level 1 (plain counting) now leads into level 2 (picture and
  symbol together), which is the order a Year 1-2 class meets them. That is the reason for choosing level 2.
- **Reading load.** A numeral and a sign are the minimum text for an equation. Each is large, and the line is at most
  `23 + 14 = ?` (nine characters), so it fits the panel at all five-player sizes.
- **The picture and the equation both say "plus".** At level 2 the drawn "+" and the written "+" appear together on
  purpose: the pupil sees the symbol and the thing it means.
- **Evidence cannot tell which questions had an equation.** Adding that would add a field to `AttemptRecord` and a CSV
  column (a separate decision). A seeded session can be regenerated to find out.
- **Not changed:** the number pad, feedback marks, Setup, Results, Teacher screens, levels 1, 3 and 4.

## Alternatives (not recommended unless you say so)

1. **Every level 2 sum shows the equation** (no random mix). Simpler and more predictable, but there is no "visual only"
   practice at this level.
2. **Levels 2, 3 and 4 all get the random equation.** Same code with `level >= 2`; the cost is more reading at the hard
   levels. Say so if "level 2 onwards" was meant.
3. **Fifty-fifty guaranteed rather than random.** Alternate by question index instead of chance. More even for a short
   race, but a pupil can predict it, and it needs the index passed into `sample`.
4. **Record the choice** in the difficulty band (for example `sum-10-eq`) so the teacher evidence can separate the two.
   Possible without a schema change, but it splits the per-band counts in two.

## Order of work (one commit each)

1. Schema, builder, shared helper and the panel drawing (equation strip), with the cues and layout tests.
2. Year 1 templates (add, sub, one-more, groups), with tests.
3. Year 2 templates (add, sub, mul, div), with tests.
4. Pack versions, DECISIONS #48, README, `npm run docs:curriculum`, `npm run check`, `npm run test:e2e`.
