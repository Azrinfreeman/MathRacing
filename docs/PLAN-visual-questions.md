# Implementation plan: picture-first questions (no reading)

Status: **implemented** (DECISIONS #45, extended to pictures only by #46), except the hint slide-in animation, which was left out. Prepared 2026-10-18.
Request: make questions visual so pupils answer quickly instead of reading text.

## What the panel shows today

From the owner's screenshot (two panels, Year 1 level 1):

- A line of **text or a sum** above the picture (`1 + 1 = ?`, `2 + 1 = ?`). Other templates show a words line
  instead ("Berapa semua?", "Berapa tinggal?", "Kumpulan 5. Berapa semua?", "Pukul berapa?", "Berapa cm panjangnya?").
- The picture (already vector art, DECISIONS #42).
- The answer field and number pad.
- After two wrong answers, a worded hint ("Kira lima-lima") under a rearranged picture.

So the pictures exist already. What slows a pupil down is **the words around them**: a Year 1 pupil who reads slowly
must decode a sentence before knowing what to do, and the sentence differs from template to template.

## Recommendation

Keep the number pad and the "one picture, one whole number" model (#42). Replace words with **a fixed picture
language**, so the pupil learns each symbol once and then never reads:

1. **The picture is the question.** A sum is drawn as `[group] + [group] = [?]`, a take-away as objects with some
   crossed out, equal groups as circled groups with `×`. No sentence above it.
2. **One small cue icon replaces each instruction.** A badge in the panel corner, drawn from the existing vector
   toolkit (no new assets, nothing downloaded):

   | Instruction today        | Cue shown instead                                    |
   | ------------------------ | ---------------------------------------------------- |
   | Berapa? / Berapa semua?  | a hand pointing at the objects with a `?` badge      |
   | Berapa tinggal?          | crossed-out object with a `?` badge                  |
   | Berapa sen? / ringgit?   | the unit chip already in the answer field (`sen`/RM) |
   | Pukul berapa?            | nothing: the clock face is unambiguous               |
   | cm, ml, sides, corners   | unit chip in the answer field; shape/ruler/cup alone |
   | one more / one fewer     | a `+1` or `−1` badge on the picture                  |
   | groups of N / each group | the circled groups themselves, with `×`              |

3. **Numerals stay.** `3 + 2` is a picture of numbers, not reading. Only words are removed.
4. **Hints become pictures.** The rearranged ten-frame (rows of 5) already shows the idea; the hint sentence is
   dropped from the panel and replaced by a short animation of objects sliding into the rows. The answer is still
   never shown or numbered.
5. **The picture gets the freed space.** Today a text row takes 26-34% of the question area. Without it the picture
   is larger, which helps the 5-player panels at 960x540, where counted objects are only just 6 px.

## What stays unchanged

- `prompt.text` and `hint` **stay in the question data** (both languages). They feed the teacher preview in Setup
  (`SetupScreen.ts:859`), the screen-reader label, the CSV/evidence record and the #44 audit that checks prompt,
  picture, answer and hint describe the same thing. They are simply **not drawn on the pupil panel**.
- Race engine, scoring, input ownership, storage and CSV schemas. No new `AttemptRecord`/`SessionMeta` field, so no
  fixture or CSV column decision is needed.
- Curriculum coverage, SK mapping, template ids, pack ids and versions (the data does not change).
- Offline use, and no pupil data leaves the device.

## Files to change

| Area           | File                                                                | Change                                                                                 |
| -------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Schema         | `src/curriculum/schema.ts`                                          | optional `prompt.cue` (a small enum: `count`, `left`, `plus-one`, `minus-one`, `none`) |
| Generators     | `generators/easyY1.ts`, `easyY2.ts`                                 | set `cue` per template next to the existing text                                       |
| Layout         | `src/game/ui/PanelView.ts` (`drawPrompt`)                           | drop the text row; give the picture the space; draw the cue badge                      |
| Drawing        | `src/game/widgets/` visual drawing, `ui/racerShapes.ts` not touched | cue badge shapes; `+`/`−`/`×`/`=` between groups drawn as shapes                       |
| Hint           | `PanelView.ts`                                                      | hint shown as the rearranged picture with a slide-in; no sentence                      |
| Locales        | `src/locales/bm.ts`, `en.ts`                                        | none for pupil panel; add screen-reader label strings for the cues                     |
| Tests          | `curriculum.test.ts`, `countLayout.test.ts`, `widgets.test.ts`      | every template has a cue; counted object size does not shrink; layout fits             |
| Docs           | `docs/DECISIONS.md` (#45), README and help text                     | record the change; say the pupil panel no longer shows instructions                    |
| After the work | `npm run docs:map`, `npm run docs:curriculum`                       | only if files or templates change                                                      |

Nothing else needs to move. Generated docs are not edited by hand.

## Steps (one commit each)

1. Schema `cue` field plus validator rule, and set cues in all 22 templates. Unit tests green.
2. `drawPrompt`: remove the text row, enlarge the picture, draw the cue badge and the `+ − × =` glyphs between
   groups. Layout tests prove counted objects are at least as large as today at 960x540, 1024x600, 1280x800.
3. Hint as animation, no sentence. Reduced-motion setting ("Kurangkan gerakan") shows the final rows without moving.
4. Accessibility labels for cues, docs (#45, README, help text).
5. `npm run check`, then `npm run test:e2e`, with one screenshot of a 5-player panel and one of 2 players.

## Decisions for the owner

- **D1. Remove words from the pupil panel entirely, or only shrink them?** Recommendation: remove, keeping them in
  data and the teacher preview. Shrinking still costs a glance and pupils would still try to read it.
- **D2. Keep numerals in sums (`3 + 2 = ?`)?** Recommendation: yes. Digits are recognised faster than words and the
  curriculum is teaching them.
- **D3. Spoken question (text-to-speech)?** Recommendation: **not now.** Offline voices vary a lot between Android
  tablets and some have none, and five panels speaking at once would clash. It can be a later opt-in teacher option.
- **D4. Teacher option to show the words again?** Recommendation: no. One behaviour is easier to test and explain;
  the teacher preview in Setup still shows the words.
- **D5. Cue badges: icon only, or icon plus a one-word label?** Recommendation: icon only.

## Risks

- Some templates are ambiguous without words (one more vs one fewer, coloured parts vs total parts of a shape).
  Those two pairs need a clear cue; if a cue cannot make the picture unambiguous, keep a one-word label for that
  template rather than a guess.
- A pupil who has never seen the cue icons needs the first question explained once. The Bantuan screen will show the
  cue legend, and the DECISIONS entry records this.
- Layout changes touch every question on every panel size, so the e2e fit tests at all four sizes must pass before
  commit.

## Done means

`npm run lint`, `npm run typecheck`, `npm test` and `npm run test:e2e` green; DECISIONS #45, README and help updated;
committed. Per the repository rule, this plan is committed first and **no code is changed until it is approved.**
