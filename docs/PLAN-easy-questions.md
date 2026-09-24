# Implementation plan: easy questions (look, count, type the number, done)

Status: **proposal, not implemented.** Section 8 lists the decisions that are yours; the plan follows the
recommended answer for each. Say "proceed" to build it with those answers, or give different answers.

## 1. What is being asked

Make the questions pupils answer during a race easy: no arranging, ordering, building or multi-select mechanics.
Every question should be **look at a picture, count something, type the number, done.**

## 2. What pupils get today

77 templates (38 Year 1, 39 Year 2) use five answer mechanics:

| Mechanic     | Templates | Examples                                                            | Why it is hard in a race                                                |
| ------------ | --------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| number-pad   | 35        | count objects, 36 + 14, read a pictograph                           | fine, but many show only a bare sum (36 + 14 = ?) with nothing to count |
| choice-tiles | 29        | name a 3D shape, "what day comes after Tuesday?", match 7/10 to 0.7 | needs reading words; many are naming/recall, not counting               |
| tap-picture  | 6         | tap the bigger group, shade 3/4                                     | multi-step (select, maybe several, then Hantar); unclear when "done"    |
| order-strip  | 3         | put numbers or daily events in order                                | several taps in the right order; one slip restarts                      |
| build-value  | 4         | build 47 from tens and ones, make 70 sen from coins                 | several taps, a running total, an undo                                  |

## 3. The new rule: "Kira & taip" (count and type)

Every race question (when the new mode is on, D1) follows one pattern:

1. **A picture of things to count** (objects, coins, blocks, clock marks, chart squares), with a very short
   instruction ("Berapa semua?", "Berapa tinggal?", "Berapa sen?").
2. **One answer: a whole number**, typed on the existing number pad (0-9, C, Hantar) (D2).
3. **Done.** Correct: boost. Wrong: slow-down, try again (the race rules do not change).

What is **never** in this mode: ordering, building, selecting several pictures, reading word tiles, fractions or
decimals written as answers, bare sums without a picture.

## 4. The question set (per topic, per level)

The picture always shows the quantity, so a pupil can always count to the answer. Larger numbers are drawn in
groups that are quick to count: ten-frames (rows of 5, frames of 10) for Year 1, base-ten blocks (flats of 100,
rods of 10, cubes) for Year 2.

### Year 1

| Topic (SK as today) | Question                                                      | L1                     | L2                  | L3                | L4                 | Source                                          |
| ------------------- | ------------------------------------------------------------- | ---------------------- | ------------------- | ----------------- | ------------------ | ----------------------------------------------- |
| 1.0 Nombor Bulat    | Berapa? (count the objects)                                   | 1-5                    | 3-10                | 8-20 (ten-frames) | 20-50 (ten-frames) | `y1-num-count-objects` + ten-frames             |
|                     | Satu lagi / kurang satu (count, then one more or one fewer)   | 1-5                    | 1-10                | 1-20              | 1-20               | new `y1-easy-one-more`                          |
| 2.0 Operasi Asas    | Berapa semua? (two groups, count all)                         | sum ≤ 5                | sum ≤ 10            | sum ≤ 20          | sum ≤ 30           | new `y1-easy-add`                               |
|                     | Berapa tinggal? (some objects crossed out)                    | ≤ 5                    | ≤ 10                | ≤ 20              | ≤ 30               | new `y1-easy-sub`                               |
|                     | Kira kumpulan (equal groups of 2, 5 or 10, count all)         | 2s to 10               | 2s, 5s to 20        | 2s, 5s, 10s to 50 | 2s, 5s, 10s to 50  | new `y1-easy-groups`                            |
| 3.0 Wang            | Berapa sen? / Berapa ringgit? (coins or notes of one kind)    | 10 sen coins, ≤ 50 sen | 10/20 sen ≤ 100 sen | RM1 notes ≤ RM10  | RM1 + RM5 ≤ RM10   | new `y1-easy-money`                             |
| 4.0 Masa            | Pukul berapa? (analogue clock, whole hours; type the hour)    | 1-6                    | 1-12                | 1-12              | 1-12               | new `y1-easy-clock-hour`                        |
| 5.0 Sukatan         | Berapa klip kertas panjangnya? (count units along the object) | 2-5                    | 3-8                 | 5-12              | 5-15               | `y1-meas-unit-count`                            |
| 6.0 Ruang           | Berapa sisi? / Berapa bucu? (2D shape), berapa muka? (3D)     | sides                  | sides, corners      | + 3D faces        | + 3D faces         | new `y1-easy-shape-count` + `y1-space-3d-count` |
| 7.0 Pengurusan Data | Berapa suka epal? (count one pictograph row)                  | ≤ 5                    | ≤ 8                 | ≤ 10              | ≤ 10               | `y1-data-pictograph-read`                       |

### Year 2

| Topic                   | Question                                                    | L1               | L2             | L3            | L4             | Source                            |
| ----------------------- | ----------------------------------------------------------- | ---------------- | -------------- | ------------- | -------------- | --------------------------------- |
| 1.0 Nombor Bulat        | Berapa? (base-ten blocks)                                   | ≤ 50             | ≤ 100          | ≤ 500         | ≤ 999          | new `y2-easy-blocks`              |
| 2.0 Operasi Asas        | Berapa semua? (two block groups)                            | sum ≤ 50         | ≤ 100          | ≤ 300         | ≤ 999          | new `y2-easy-add`                 |
|                         | Berapa tinggal? (blocks crossed out, no regrouping)         | ≤ 50             | ≤ 100          | ≤ 300         | ≤ 999          | new `y2-easy-sub`                 |
|                         | Kumpulan sama (3 groups of 4: count all = 3 × 4)            | 2, 5, 10         | 2, 3, 4, 5     | 2-5, 10       | 2-5, 10        | new `y2-easy-mul`                 |
|                         | Kongsi sama rata (share into groups: how many in each?)     | ÷ 2              | ÷ 2, 5         | ÷ 2-5         | ÷ 2-5, 10      | new `y2-easy-div` (no remainders) |
| 3.0 Pecahan (fractions) | Berapa bahagian berwarna? / Berapa bahagian semua?          | halves, quarters | up to 6        | up to 8       | up to 10       | new `y2-easy-fraction-parts`      |
| 4.0 Wang                | Berapa ringgit? (notes RM1, RM5, RM10)                      | RM1 only ≤ RM10  | RM1+RM5 ≤ RM20 | + RM10 ≤ RM50 | ≤ RM100        | new `y2-easy-money`               |
| 5.0 Masa                | Pukul berapa? (hour) / Berapa minit? (count 5-minute marks) | hours            | hours          | minutes by 5  | minutes by 5   | new `y2-easy-clock`               |
| 6.0 Sukatan             | Berapa cm? (ruler) / Berapa ml? (cup)                       | ≤ 10 cm          | ≤ 20 cm        | ruler or cup  | ruler or cup   | `y2-meas-ruler`, `y2-meas-cup`    |
| 7.0 Ruang               | Berapa sisi? / berapa bucu? / berapa muka?                  | sides            | sides, corners | + faces       | + faces, edges | `y2-space-2d-sides` + shape count |
| 8.0 Data                | Berapa murid pilih mangga? (count bar squares)              | scale 1          | scale 1        | scale 2       | scale 5        | `y2-data-bar-read`                |

Every new template keeps its topic's SK range exactly as today and an empty SP list (packs are drafts; no codes are
invented). Topics with nothing countable (days and months, naming shapes, symbols, decimals, rounding, estimation,
axes) are left out of this mode (D3); the teacher can still use them by turning the mode off.

## 5. Help when a pupil is stuck (no answer given away)

- After 2 wrong answers: the picture **rearranges into rows of 5** (ten-frames), which makes counting easier but does
  not show the answer. A short hint stays ("Kira lima-lima").
- After 3 wrong answers: the existing "simpler question" support gives a smaller number of the same kind.
- Numbers are never written under the objects (that would reveal a count).

## 6. Implementation

### 6.1 Pictures (`src/curriculum/visual.ts`, `src/game/ui/VisualRenderer.ts`)

- `ObjectGroup.crossed?: number`: that many objects in the group are drawn with a grey cross (subtraction).
- New visual kinds:
  - `ten-frames`: `{ count, shape, color }`, frames of 2 x 5 cells, filled in reading order.
  - `base-ten`: `{ hundreds, tens, ones, crossed? }`: flats, rods and cubes, large enough to count on a 5-player panel.
  - `equal-groups`: `{ groups, perGroup, shape, color }`: circled groups (multiplication and sharing).
- The clock gets an optional `marks: 'fives'` (numbered 5-minute ticks) for "Berapa minit?".
- `validateVisual` checks every new kind; `describeVisual` (screen-reader text) covers them.
- Pure geometry helpers (cell positions for ten-frames, block layout) live in a new `ui/countLayout.ts` so tests can
  check that everything fits a 5-player panel at 1024x600 without drawing.

### 6.2 Templates (`src/curriculum/generators/`)

- `QuestionTemplate` gains `easy: boolean`. The validator requires, for easy templates: widget `number-pad`, a
  whole-number answer from 0 to 999, and a prompt visual.
- New file `generators/easyCount.ts` with the new templates in section 4 (Year 1 and Year 2, one per row marked
  "new"). The existing templates named in section 4 are marked `easy: true` (and those showing a bare sum get a
  picture).
- Property test (1,000 samples per template and level): **the number of things drawn equals the answer**, computed
  independently from the visual model (count objects minus crossed, blocks value, shaded parts, bar squares, etc.).

### 6.3 Choosing questions (`blueprint.ts`, `registry.ts`)

- `BlueprintConfig.easyOnly`: the blueprint only draws easy templates. `registry.templatesForTopic(pack, topic,
{ easyOnly })`.
- A test checks that every topic of both years has at least one easy template at every level (so setup never fails).

### 6.4 Teacher option (`storage/settings.ts`, `setupState.ts`, `TeacherScreen.ts`, locales)

- `Settings.easyQuestions`, default **on**. Teacher screen, group "Bantuan murid": switch **"Soalan mudah (kira &
  taip)"** with the note "Setiap soalan: kira gambar, taip nombor. Matikan untuk semua jenis soalan."
- The Topik & Tahap step and "Pratonton 5 soalan" follow the setting, so the teacher previews what pupils will get.

### 6.5 Evidence (`RaceState.SessionMeta`, `exportCsv`)

- `SessionMeta.questionStyle: 'easy' | 'full'` (missing in older sessions) and a CSV column `question_style`
  (D5). `template_id` already says which template each attempt used.

### 6.6 Panel

- No new widget. `PanelView` already lays out prompt text, picture and number pad; the new pictures use the picture
  area. The number pad shows the unit ("sen", "RM", "cm", "ml") beside the answer box as today.

## 7. Tests and checks

- `curriculum.test.ts`: easy-template validation; the drawn-count property; every topic x level has an easy
  template; the simpler variant stays easy.
- `widgets.test.ts` "widget layout across every template": runs over the new templates too (5 players at 1024x600).
- `app.test.ts`: the teacher switch saves `easyQuestions`; the preview shows only number-pad items with pictures.
- `storage.test.ts`: `easyQuestions` default and sanitising; `question_style` CSV column and fixtures.
- E2E: a race with easy questions answered through the number pad (answers computed from the app's own blueprint,
  as today) and one screenshot of 5 panels at 1024x600 to check the pictures are countable.
- `npm run docs:curriculum` regenerates the mapping with an "Easy" column.

## 8. Decisions for you (recommended answer first)

| #   | Question                                 | Recommended                                                                                   | Alternatives                                                         |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| D1  | Replace the old questions or add a mode? | **Add "Soalan mudah", on by default**; the full set stays available to switch on              | Remove the hard mechanics from the game entirely                     |
| D2  | The input                                | **Number pad for every question** (one thing to learn)                                        | Three big number buttons at Level 1 (tap one), number pad above that |
| D3  | Topics with nothing to count             | **Left out of easy mode** (days, months, naming shapes, decimals, rounding, estimation, axes) | Keep them as simple picture choices (3 tiles)                        |
| D4  | Help after 2 wrong answers               | **Rearrange the picture into rows of 5** plus a short hint                                    | Keep today's text hint only                                          |
| D5  | Record the style in evidence / CSV       | **Yes**: `question_style` column                                                              | No (the template id is enough)                                       |
| D6  | Number ranges                            | **As in section 4** (Year 1 up to 50, Year 2 up to 999 with blocks)                           | Smaller (Year 1 up to 20, Year 2 up to 100)                          |

## 9. Order of work (one commit each)

1. Pictures: crossed objects, ten-frames, base-ten blocks, equal groups, clock 5-minute marks; renderer and layout
   tests.
2. Easy templates for Year 1 and the `easy` flag on existing ones; property tests.
3. Easy templates for Year 2; property tests; `npm run docs:curriculum`.
4. `easyOnly` in the blueprint and registry; the teacher switch; preview; the rows-of-5 hint.
5. Evidence (`question_style`), e2e race and screenshot, DECISIONS #42, README and help text, release APK.

## 10. Risks

- **Coverage:** easy mode covers fewer learning standards (no days, months, shape names, decimals, rounding). The
  teacher screen note says so, and the full set is one switch away.
- **Crowded pictures on 5 small panels:** large counts are always grouped (ten-frames, blocks); the layout test fails
  if any picture gets smaller than a minimum object size on a 5-player 1024x600 panel.
- **Year 2 L4 (up to 999) may still be long to count:** blocks make it 9 + 9 + 9 things at most; if it feels slow in
  class, D6's smaller ranges are a one-line change per template.
