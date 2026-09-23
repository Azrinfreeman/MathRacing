# Curriculum mapping

> Generated from the live curriculum registry by `npm run docs:curriculum`. Do not edit by hand: change the templates and regenerate.

## Source of truth and status

- Scope and SK ranges are copied from sections 5 and 6 of `output/pdf/MathRacing_KPM_Year1_Year2_Game_Plan.pdf` (KSSR Semakan 2017, Dokumen Penjajaran Edisi 3, Matematik Tahap I).
- **The plan lists SK ranges per topic but no SP (Standard Pembelajaran) codes.** No SP code has been invented: every template carries the topic's SK range exactly as printed in the plan, and an empty SP list. A qualified reviewer must add verified SP codes (and may narrow the SK range per template) before classroom deployment.
- Every pack is marked `draft-pending-academic-review` with `reviewer: null`. Nothing here has been signed off by a Malaysian primary Mathematics educator.
- Topic titles in Bahasa Melayu are working labels for the plan's English topic names, not quotations of official KPM wording.

## KSSR (Revised 2017) - Edition 3 - Mathematics Year 1 (`kpm-ms-y1` v1.0.0)

Basis: KSSR (Semakan 2017), Dokumen Penjajaran Edisi 3, Matematik Tahap I. Effective date recorded: 2024-05-03. Templates: 38.

### 1.0 Nombor Bulat hingga 100 / Whole Numbers to 100 (SK 1.1-1.5)

Plan scope: Compare quantities; name, count and write numbers; compare groups; place value and digit value; patterns by 1, 2, 5 and 10; one-digit number combinations.

| Template                | Widget       | Scope reference (from the plan)                                 | Level 1                           | Level 2                            | Level 3                              | Level 4                                  | Remainder | Depends on |
| ----------------------- | ------------ | --------------------------------------------------------------- | --------------------------------- | ---------------------------------- | ------------------------------------ | ---------------------------------------- | --------- | ---------- |
| `y1-num-count-objects`  | number-pad   | Name, count and write numbers (count objects)                   | 1-5 objects                       | 3-10 objects                       | 8-15 objects                         | 11-20 objects                            | n/a       | -          |
| `y1-num-compare-groups` | tap-picture  | Compare quantities; compare groups (tap the larger group)       | counts 1-6, difference at least 3 | counts 1-10, difference at least 2 | counts 1-15, difference at least 2   | counts 1-20, difference at least 1       | n/a       | -          |
| `y1-num-compare-values` | choice-tiles | Compare quantities; name and compare numbers                    | numbers 1-10                      | numbers 1-20                       | numbers 1-50                         | numbers 1-100                            | n/a       | -          |
| `y1-num-tens-ones`      | number-pad   | Place value and digit value (tens and ones)                     | 10-20                             | 21-50                              | 51-99                                | 21-99                                    | n/a       | -          |
| `y1-num-digit-value`    | choice-tiles | Place value and digit value                                     | 12-19                             | 21-50 (distinct non-zero digits)   | 21-99                                | 21-99                                    | n/a       | -          |
| `y1-num-build`          | build-value  | Build 47 as 4 tens + 7 ones                                     | 10-20                             | 21-50                              | 51-99                                | 21-99                                    | n/a       | -          |
| `y1-num-pattern`        | number-pad   | Number patterns in 1s, 2s, 5s and 10s (complete 25, 30, 35, __) | counting by 1 within 10           | steps 1, 2 within 20               | steps 2, 5, 10 within 50, up or down | steps 1, 2, 5, 10 within 100, up or down | n/a       | -          |
| `y1-num-order`          | order-strip  | Compare and order numbers                                       | 3 numbers within 10               | 3 numbers within 20                | 4 numbers within 50                  | 4 numbers within 100                     | n/a       | -          |
| `y1-num-combination`    | number-pad   | One-digit number combinations (choose pairs that make 8)        | totals 3-6                        | totals 7-10                        | totals 11-14 (one-digit parts)       | totals 15-18 (one-digit parts)           | n/a       | -          |

### 2.0 Operasi Asas / Basic Operations (SK 2.1-2.5)

Plan scope: Meaning and symbols of +, - and =; addition and subtraction within 100; repeated addition by 2, 5 and 10; repeated subtraction by 2, 5 and 10.

| Template             | Widget       | Scope reference (from the plan)                  | Level 1               | Level 2                       | Level 3                         | Level 4                                 | Remainder | Depends on               |
| -------------------- | ------------ | ------------------------------------------------ | --------------------- | ----------------------------- | ------------------------------- | --------------------------------------- | --------- | ------------------------ |
| `y1-op-symbol`       | choice-tiles | Recognise +, - and = (choose the correct symbol) | results within 10     | results within 20             | results within 50               | results within 100                      | n/a       | -                        |
| `y1-op-add`          | number-pad   | Addition within 100 (solve 36 + 14)              | sums within 10        | sums within 20                | sums within 50                  | sums within 100, regrouping included    | n/a       | -                        |
| `y1-op-sub`          | number-pad   | Subtraction within 100 (solve 46 - 25)           | minuend within 10     | minuend within 20             | minuend within 50               | minuend within 100, regrouping included | n/a       | -                        |
| `y1-op-missing`      | number-pad   | Missing values in addition and subtraction       | addition within 10    | addition and a - ? within 20  | all four forms within 50        | all four forms within 100               | n/a       | `y1-op-add`, `y1-op-sub` |
| `y1-op-repeated-add` | number-pad   | Repeated addition in 2s, 5s and 10s              | 2s, 2-4 terms (max 8) | 2s and 5s, 2-4 terms (max 20) | 2s, 5s, 10s, 3-5 terms (max 50) | 2s, 5s, 10s, 5-6 terms (max 60)         | n/a       | `y1-op-add`              |
| `y1-op-repeated-sub` | number-pad   | Repeated subtraction in 2s, 5s and 10s           | 2s, start within 10   | 2s and 5s, start within 20    | 2s, 5s, 10s, start within 50    | 5s and 10s, start within 100            | n/a       | `y1-op-sub`              |

### 3.0 Wang / Money (SK 3.1-3.2)

Plan scope: Recognise Malaysian coins and notes; represent and exchange sen to RM1 and ringgit to RM10; add and subtract money within RM10.

| Template            | Widget       | Scope reference (from the plan)                          | Level 1                           | Level 2                              | Level 3                                  | Level 4                                  | Remainder | Depends on          |
| ------------------- | ------------ | -------------------------------------------------------- | --------------------------------- | ------------------------------------ | ---------------------------------------- | ---------------------------------------- | --------- | ------------------- |
| `y1-money-identify` | choice-tiles | Recognise Malaysian coins and notes                      | coins 5-50 sen                    | coins and RM1                        | coins, RM1 and RM5                       | coins and notes up to RM10               | n/a       | -                   |
| `y1-money-compare`  | tap-picture  | Compare the value of Malaysian money                     | one coin each                     | 1-3 coins each, totals within RM1.50 | 1-2 coins/notes each, totals within RM10 | 1-3 coins/notes each, totals within RM10 | n/a       | `y1-money-identify` |
| `y1-money-build`    | build-value  | Build 70 sen; choose an equivalent set for RM6           | 20-50 sen with 10/20/50 sen coins | 15-95 sen with 5/10/20/50 sen coins  | RM2-RM7 with RM1 and RM5 notes           | RM6-RM10 with RM1, RM5, RM10 notes       | n/a       | `y1-money-identify` |
| `y1-money-exchange` | number-pad   | Exchange money from sen to RM1 and ringgit notes to RM10 | sen coins to smaller sen coins    | RM1 to sen coins                     | RM5/RM10 notes to smaller notes          | RM10/RM5 to RM1; RM1 to 20 sen           | n/a       | `y1-money-identify` |
| `y1-money-add`      | number-pad   | Add money within RM10 (calculate RM5 + RM3)              | sen in tens, total within 50 sen  | sen in fives, total within 100 sen   | two RM values, total within RM10         | three RM values, total within RM10       | n/a       | `y1-op-add`         |
| `y1-money-sub`      | number-pad   | Subtract money within RM10 (find change from RM10)       | sen in tens within 100 sen        | sen in fives within 100 sen          | RM within RM10                           | RM within RM10, change from a purchase   | n/a       | `y1-op-sub`         |

### 4.0 Masa / Time (SK 4.1-4.2)

Plan scope: Order daily events; days of the week; months of the year; hour and minute hands; tell and write hour, half-hour and quarter-hour on an analogue clock.

| Template              | Widget       | Scope reference (from the plan)                                      | Level 1                 | Level 2                     | Level 3                                  | Level 4                           | Remainder | Depends on           |
| --------------------- | ------------ | -------------------------------------------------------------------- | ----------------------- | --------------------------- | ---------------------------------------- | --------------------------------- | --------- | -------------------- |
| `y1-time-sequence`    | order-strip  | Order daily events; days of the week; months of the year             | 3 daily events in order | all 4 daily events in order | 3 consecutive days of the week (no wrap) | 4 consecutive months (no wrap)    | n/a       | -                    |
| `y1-time-days`        | choice-tiles | Days of the week (what day comes after Tuesday?)                     | the day after           | the day after or before     | one or two days after or before          | one or two days after or before   | n/a       | -                    |
| `y1-time-months`      | choice-tiles | Months of the year                                                   | the month after         | the month after or before   | one or two months after or before        | one or two months after or before | n/a       | -                    |
| `y1-time-clock-read`  | choice-tiles | Tell and write hour, half-hour and quarter-hour on an analogue clock | on the hour             | hour and half hour          | hour, half and quarter hours             | hour, half and quarter hours      | n/a       | -                    |
| `y1-time-clock-match` | choice-tiles | Match '2:30' to a clock                                              | on the hour             | hour and half hour          | hour, half and quarter hours             | hour, half and quarter hours      | n/a       | `y1-time-clock-read` |

### 5.0 Sukatan / Measurement (SK 5.1)

Plan scope: Measure and compare length, mass and liquid volume using non-standard units and comparative language.

| Template                 | Widget       | Scope reference (from the plan)                                      | Level 1            | Level 2                    | Level 3                            | Level 4                                     | Remainder | Depends on |
| ------------------------ | ------------ | -------------------------------------------------------------------- | ------------------ | -------------------------- | ---------------------------------- | ------------------------------------------- | --------- | ---------- |
| `y1-meas-unit-count`     | number-pad   | Measure length using non-standard units (how many paper clips long?) | 2-5 units          | 4-8 units                  | 6-10 units                         | 8-12 units                                  | n/a       | -          |
| `y1-meas-compare-length` | tap-picture  | Compare length using comparative language                            | ratio at least 1.8 | ratio at least 1.5         | ratio at least 1.3                 | ratio at least 1.15 (difference at least 2) | n/a       | -          |
| `y1-meas-compare-words`  | choice-tiles | Compare mass, liquid volume and length using comparative language    | 2 objects, mass    | 2 objects, mass and volume | 3 objects, mass, volume and length | 4 objects, mass, volume and length          | n/a       | -          |

### 6.0 Ruang / Space (SK 6.1-6.2)

Plan scope: Name and describe 3D and 2D shapes; count faces, sides, vertices, corners and curves; continue shape patterns; combine shapes.

| Template              | Widget       | Scope reference (from the plan)                                    | Level 1                             | Level 2                   | Level 3                                     | Level 4                                    | Remainder | Depends on         |
| --------------------- | ------------ | ------------------------------------------------------------------ | ----------------------------------- | ------------------------- | ------------------------------------------- | ------------------------------------------ | --------- | ------------------ |
| `y1-space-name-3d`    | choice-tiles | Name and describe 3D shapes (name a cylinder)                      | sphere, cylinder, cone, cube        | + pyramid                 | + cuboid                                    | + cuboid                                   | n/a       | -                  |
| `y1-space-name-2d`    | choice-tiles | Name common 2D shapes                                              | triangle, square, rectangle, circle | same                      | same                                        | same                                       | n/a       | -                  |
| `y1-space-find-shape` | choice-tiles | Describe 2D shapes (which shape has three sides?)                  | three sides / no corners            | + four equal sides        | same as level 2                             | same as level 2                            | n/a       | `y1-space-name-2d` |
| `y1-space-3d-count`   | number-pad   | Count faces, vertices and edges of 3D shapes (count cube vertices) | flat surfaces of 4 solids           | flat surfaces of 5 solids | vertices (corners) of cube, cuboid, pyramid | edges and vertices                         | n/a       | -                  |
| `y1-space-pattern`    | choice-tiles | Continue shape patterns                                            | AB patterns, one colour             | AAB or ABB patterns       | ABC patterns                                | AAB or ABC patterns with different colours | n/a       | -                  |

### 7.0 Pengurusan Data / Data Management (SK 7.1-7.2)

Plan scope: Collect, classify and arrange everyday data; read pictographs where one picture represents one value.

| Template                  | Widget       | Scope reference (from the plan)                                         | Level 1                 | Level 2                 | Level 3                 | Level 4                  | Remainder | Depends on                |
| ------------------------- | ------------ | ----------------------------------------------------------------------- | ----------------------- | ----------------------- | ----------------------- | ------------------------ | --------- | ------------------------- |
| `y1-data-pictograph-read` | number-pad   | Read a pictograph where one picture represents one item (count symbols) | 3 rows, up to 5 symbols | 3 rows, up to 7 symbols | 4 rows, up to 9 symbols | 4 rows, up to 10 symbols | n/a       | -                         |
| `y1-data-pictograph-most` | choice-tiles | Read the most popular choice from a pictograph                          | 3 rows, up to 5 symbols | 3 rows, up to 7 symbols | 4 rows, up to 9 symbols | 4 rows, up to 10 symbols | n/a       | `y1-data-pictograph-read` |
| `y1-data-more-fewer`      | number-pad   | One more / one fewer questions on data                                  | difference within 5     | difference within 7     | difference within 9     | difference within 10     | n/a       | `y1-data-pictograph-read` |
| `y1-data-classify`        | tap-picture  | Classify everyday data (sort by shape)                                  | 4 items, 3 kinds        | 6 items, 3 kinds        | 8 items, 4 kinds        | 8 items, 4 kinds         | n/a       | -                         |

## KSSR (Revised 2017) - Edition 3 - Mathematics Year 2 (`kpm-ms-y2` v1.0.0)

Basis: KSSR (Semakan 2017), Dokumen Penjajaran Edisi 3, Matematik Tahap I. Effective date recorded: 2024-05-03. Templates: 39.

### 1.0 Nombor Bulat hingga 1 000 / Whole Numbers to 1,000 (SK 1.1-1.5)

Plan scope: Name, count and write numbers; compare two values; ascending/descending sequences; place and digit value; patterns; reasonable estimation; round to the nearest ten and hundred.

| Template             | Widget       | Scope reference (from the plan)                  | Level 1                          | Level 2                          | Level 3                              | Level 4                                             | Remainder | Depends on           |
| -------------------- | ------------ | ------------------------------------------------ | -------------------------------- | -------------------------------- | ------------------------------------ | --------------------------------------------------- | --------- | -------------------- |
| `y2-num-words`       | choice-tiles | Name and write numbers (match 430 to words)      | 21-100                           | 101-300                          | 301-600                              | 601-1000                                            | n/a       | -                    |
| `y2-num-compare`     | choice-tiles | Compare two values (compare 294 and 315)         | 11-100                           | 101-300                          | 301-600, same hundreds digit         | same hundreds and tens digits                       | n/a       | -                    |
| `y2-num-order`       | order-strip  | Ascending and descending order                   | 3 numbers within 100             | 3 numbers within 300             | 4 numbers within 600                 | 4 numbers within 1000                               | n/a       | -                    |
| `y2-num-place-value` | number-pad   | Place value and digit value (decompose 136)      | 11-99                            | 101-300                          | 301-600                              | 101-999, value or digit                             | n/a       | -                    |
| `y2-num-build`       | build-value  | Build 136 with place-value blocks                | 21-99                            | 101-300                          | 301-600                              | 601-999 (digit sum at most 16)                      | n/a       | -                    |
| `y2-num-pattern`     | number-pad   | Number patterns (complete a sequence)            | steps 2, 5, 10 within 100        | steps 5, 10, 20 within 300       | steps 10, 20, 50, 100 within 600     | steps 10, 20, 50, 100 within 1000                   | n/a       | -                    |
| `y2-num-estimate`    | choice-tiles | Reasonable estimation (estimate against 100)     | nearest of three tens within 100 | nearest of three tens within 300 | nearest of three hundreds within 600 | nearest of three hundreds within 1000               | n/a       | -                    |
| `y2-num-round`       | number-pad   | Round to the nearest ten and hundred (round 347) | nearest ten, 11-99, no ties      | nearest ten, 101-999, no ties    | nearest hundred, 101-999, no ties    | nearest ten or hundred, ties included (5 rounds up) | n/a       | `y2-num-place-value` |

### 2.0 Operasi Asas / Basic Operations (SK 2.1-2.4)

Plan scope: Add up to three numbers and subtract up to three numbers within 1,000; multiplication facts and one-digit x 10; division facts including remainders and two-digit / 10.

| Template              | Widget     | Scope reference (from the plan)                         | Level 1                     | Level 2                                  | Level 3                                | Level 4                                    | Remainder                      | Depends on  |
| --------------------- | ---------- | ------------------------------------------------------- | --------------------------- | ---------------------------------------- | -------------------------------------- | ------------------------------------------ | ------------------------------ | ----------- |
| `y2-op-add`           | number-pad | Add up to three numbers within 1000 (115 + 20 + 30)     | two numbers, sum within 100 | two numbers, sum within 1000, regrouping | three numbers, sum within 1000         | three numbers, sum within 1000, regrouping | n/a                            | -           |
| `y2-op-sub`           | number-pad | Subtract up to three numbers within 1000 (850 - 167)    | two numbers within 100      | two numbers within 1000, regrouping      | three numbers within 1000              | three numbers within 1000, regrouping      | n/a                            | -           |
| `y2-op-mul`           | number-pad | Multiplication facts and one-digit x 10 (3 x 2; 8 x 10) | tables 2 and 5              | tables 3 and 4                           | tables 10, 2 and 5                     | tables 2, 3, 4, 5, 10 mixed                | n/a                            | -           |
| `y2-op-div`           | number-pad | Division facts and two-digit / 10 (60 / 10)             | divide by 2 or 5            | divide by 3 or 4                         | divide two-digit multiples of 10 by 10 | mixed, exact division only                 | exact division only            | `y2-op-mul` |
| `y2-op-div-remainder` | number-pad | Division with remainders (share 17 into groups of 5)    | divide by 2                 | divide by 2 or 3                         | divide by 2-5, quotient up to 6        | divide by 2-5, quotient up to 9            | asked as quotient or remainder | `y2-op-div` |

### 3.0 Pecahan dan Perpuluhan / Fractions and Decimals (SK 3.1-3.3)

Plan scope: Halves and quarters; proper fractions with numerator 1-9 and denominator up to 10; compare fractions; tenths as decimals 0.1-0.9; represent and compare decimals.

| Template                  | Widget       | Scope reference (from the plan)                                             | Level 1                                          | Level 2                           | Level 3                                           | Level 4                                                         | Remainder | Depends on              |
| ------------------------- | ------------ | --------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- | --------- | ----------------------- |
| `y2-frac-name`            | choice-tiles | Halves, quarters and proper fractions with denominator up to 10 (shade 3/4) | halves and quarters                              | denominators 2-5                  | denominators 3-8                                  | denominators 5-10                                               | n/a       | -                       |
| `y2-frac-shade`           | tap-picture  | Represent fractions (shade 3/4)                                             | halves and quarters                              | denominators 2-4                  | denominators 3-8                                  | denominators 5-8                                                | n/a       | `y2-frac-name`          |
| `y2-frac-compare`         | tap-picture  | Compare fractions (choose the larger fraction)                              | same denominator 4 or 5                          | same denominator 5, 6 or 8        | same numerator, different denominators            | different numerators and denominators, difference at least 0.12 | n/a       | `y2-frac-name`          |
| `y2-frac-decimal-match`   | choice-tiles | Tenths as decimals 0.1 to 0.9 (match 7/10 to 0.7)                           | fraction to decimal, other tenths as distractors | decimal to fraction, other tenths | fraction to decimal with 0.0k and k.0 distractors | either direction with common misconceptions                     | n/a       | -                       |
| `y2-frac-decimal-compare` | choice-tiles | Compare decimals exactly (compare 0.6 and 0.8)                              | two decimals                                     | three decimals                    | three decimals, smallest or largest               | three values mixing decimals and tenths fractions               | n/a       | `y2-frac-decimal-match` |

### 4.0 Wang / Money (SK 4.1-4.5)

Plan scope: Recognise and determine Malaysian money to RM100; add and subtract up to three money values; multiply and divide money within RM100.

| Template         | Widget      | Scope reference (from the plan)                                         | Level 1                          | Level 2                        | Level 3                            | Level 4                                      | Remainder           | Depends on     |
| ---------------- | ----------- | ----------------------------------------------------------------------- | -------------------------------- | ------------------------------ | ---------------------------------- | -------------------------------------------- | ------------------- | -------------- |
| `y2-money-build` | build-value | Recognise and determine Malaysian money to RM100 (make RM20 three ways) | RM6-RM25                         | RM26-RM60                      | RM61-RM99                          | RM20-RM100                                   | n/a                 | -              |
| `y2-money-add`   | number-pad  | Add up to three money values within RM100 (RM29 + RM13)                 | two values, total within RM30    | two values, total within RM100 | three values, total within RM100   | three values, total within RM100, regrouping | n/a                 | -              |
| `y2-money-sub`   | number-pad  | Subtract money and find change (change from RM54)                       | change from RM10                 | change from RM50               | change from RM100                  | change from RM100 after two purchases        | n/a                 | `y2-money-add` |
| `y2-money-mul`   | number-pad  | Multiply money within RM100 (RM5 x 5)                                   | RM1, RM2, RM5 x 2-5, within RM30 | RM2-RM10 x 2-5, within RM50    | up to RM10 x 3-10, within RM100    | RM2-RM20 x 2-10, within RM100                | n/a                 | `y2-op-mul`    |
| `y2-money-div`   | number-pad  | Divide money within RM100 (RM48 / 6)                                    | RM50 or less shared by 2, 5, 10  | RM60 or less shared by 2-5, 10 | RM100 or less shared by 2-6, 8, 10 | RM100 or less shared by 2-10                 | exact division only | `y2-op-div`    |

### 5.0 Masa / Time (SK 5.1-5.2)

Plan scope: Read, write and record hours and minutes; relate 1 hour to 60 minutes and 1 day to 24 hours.

| Template              | Widget       | Scope reference (from the plan)                     | Level 1                            | Level 2                                | Level 3                                    | Level 4                                           | Remainder | Depends on           |
| --------------------- | ------------ | --------------------------------------------------- | ---------------------------------- | -------------------------------------- | ------------------------------------------ | ------------------------------------------------- | --------- | -------------------- |
| `y2-time-clock-read`  | choice-tiles | Read 7:10 on an analogue clock (hours and minutes)  | hour and half hour                 | quarter hours                          | five-minute intervals                      | any minute (distractors at least 4 minutes apart) | n/a       | -                    |
| `y2-time-clock-match` | choice-tiles | Match a written time to an analogue clock           | hour and half hour                 | quarter hours                          | five-minute intervals                      | any minute                                        | n/a       | `y2-time-clock-read` |
| `y2-time-units`       | number-pad   | Relate 1 hour to 60 minutes and 1 day to 24 hours   | 1 hour or 1 day                    | up to 2 hours or 2 days                | up to 3 hours or 3 days                    | 2 to 5 hours or days                              | n/a       | -                    |
| `y2-time-duration`    | number-pad   | Record a school timetable event (how many minutes?) | 15, 30 or 45 minutes from the hour | multiples of 5 minutes within the hour | multiples of 5 minutes, may cross the hour | longer than 1 hour, in minutes                    | n/a       | `y2-time-units`      |

### 6.0 Sukatan / Measurement (SK 6.1-6.3)

Plan scope: Recognise, measure and estimate length in cm/m, mass in g/kg and liquid volume in ml/l using suitable instruments.

| Template              | Widget       | Scope reference (from the plan)              | Level 1                            | Level 2                             | Level 3                            | Level 4                            | Remainder | Depends on |
| --------------------- | ------------ | -------------------------------------------- | ---------------------------------- | ----------------------------------- | ---------------------------------- | ---------------------------------- | --------- | ---------- |
| `y2-meas-choose-unit` | choice-tiles | Choose cm or m; choose a sensible unit       | two units of the same kind         | plus one unit of another kind       | plus one unit of another kind      | plus two units of other kinds      | n/a       | -          |
| `y2-meas-ruler`       | number-pad   | Read a ruler (measure length in centimetres) | 2-10 cm                            | 3-15 cm                             | 4-20 cm                            | 6-20 cm                            | n/a       | -          |
| `y2-meas-cup`         | number-pad   | Read a measuring cup (millilitres)           | multiples of 100 ml, cup to 500 ml | multiples of 100 ml, cup to 1000 ml | multiples of 50 ml, cup to 1000 ml | multiples of 50 ml, cup to 1000 ml | n/a       | -          |
| `y2-meas-compare`     | choice-tiles | Compare measurements in the same unit        | 2 values up to 20                  | 3 values up to 100                  | 3 values up to 999                 | 4 values up to 999                 | n/a       | -          |

### 7.0 Ruang / Space (SK 7.1-7.2)

Plan scope: Identify 3D shapes from properties and nets; identify and draw 2D shapes from properties.

| Template            | Widget       | Scope reference (from the plan)                                           | Level 1                             | Level 2            | Level 3           | Level 4          | Remainder | Depends on          |
| ------------------- | ------------ | ------------------------------------------------------------------------- | ----------------------------------- | ------------------ | ----------------- | ---------------- | --------- | ------------------- |
| `y2-space-props-3d` | choice-tiles | Identify 3D shapes from properties (choose a shape with a curved surface) | curved surfaces (sphere, cylinder)  | + cone, cube faces | + five flat faces | + eight vertices | n/a       | -                   |
| `y2-space-net`      | choice-tiles | Identify 3D shapes from nets (which solid matches this net?)              | nets of cube, cylinder, cone        | + pyramid          | same as level 2   | + cuboid         | n/a       | `y2-space-props-3d` |
| `y2-space-2d-sides` | number-pad   | Identify 2D shapes from properties (count the sides)                      | triangle, square, rectangle         | + pentagon         | + hexagon         | + octagon        | n/a       | -                   |
| `y2-space-2d-match` | choice-tiles | Identify 2D shapes from properties                                        | triangle, circle, square properties | + five sides       | + six sides       | + eight sides    | n/a       | `y2-space-2d-sides` |

### 8.0 Pengurusan Data / Data Management (SK 8.1-8.2)

Plan scope: Collect, classify and arrange everyday data; read bar charts and answer contextual questions.

| Template           | Widget       | Scope reference (from the plan)                             | Level 1                       | Level 2                       | Level 3                     | Level 4                     | Remainder | Depends on         |
| ------------------ | ------------ | ----------------------------------------------------------- | ----------------------------- | ----------------------------- | --------------------------- | --------------------------- | --------- | ------------------ |
| `y2-data-bar-read` | number-pad   | Read a bar chart (how many pupils chose mango?)             | 3 bars, scale 1, up to 10     | 4 bars, scale 2, up to 20     | 5 bars, scale 5, up to 50   | 5 bars, scale 10, up to 100 | n/a       | -                  |
| `y2-data-bar-diff` | number-pad   | Find the difference between two categories on a bar chart   | 3 bars, scale 1               | 4 bars, scale 2               | 5 bars, scale 5             | 5 bars, scale 10            | n/a       | `y2-data-bar-read` |
| `y2-data-bar-most` | choice-tiles | Answer contextual questions from a bar chart (most popular) | 3 bars                        | 4 bars                        | 5 bars                      | 5 bars                      | n/a       | `y2-data-bar-read` |
| `y2-data-axes`     | choice-tiles | Identify the horizontal and vertical axes                   | which axis is marked (3 bars) | which axis is marked (4 bars) | what an axis shows (5 bars) | what an axis shows (5 bars) | n/a       | -                  |

## Coverage summary

- Templates in total: **77** (Year 1: 38, Year 2: 39).
- Templates per widget: number-pad 35, tap-picture 6, choice-tiles 29, build-value 4, order-strip 3.
- Every template has 4 explicit difficulty levels, at least one worked fixture and an entry in the test suite that generates 1,000 samples per level (arithmetic) or 250 per level (other) and checks validity, determinism and a single defensible answer.

## Difficulty levels

The teacher chooses one level (1-4) for the whole race; every player gets the same level. For Year 1 number topics the levels follow the plan's recommended progression (within 10, 20, 50, then 100). The level a question was generated at is stored with every attempt.

## Known gaps and assumptions

- **SP codes:** not present in the plan; left empty (see above).
- **Year 1 composition of shapes** ("choose shapes used to build a robot"): not implemented. It needs a composite-figure visual; the shape-naming, shape-property, counting and pattern templates are implemented.
- **Clock picker and shape drawing widgets** from the plan's widget table are not implemented. Time is covered by reading a clock and matching a written time to a clock (choice tiles); 2D properties by choice and counting.
- **Year 2 decimals on a number line** and **mass scale / estimation against 800 g** are not implemented. Tenths are covered by matching fractions and decimals and by comparing exactly.
- **Year 2 multiplication tables** are limited to 2, 3, 4, 5 and 10 (plus one-digit x 10) in the number-pad templates, and division likewise; money division allows divisors up to 10. This is an assumption to confirm with the reviewer.
- **Year 2 2D shapes** include pentagon, hexagon and octagon with straight-side counts of 5, 6 and 8; the plan does not list the exact shape names, so this is an assumption.
- **Measurement estimation** is covered by choosing a sensible unit and comparing measurements, not by estimating against a reference object.
- **Litres** are shown as "L" (capital) because a lowercase "l" is easily read as the digit 1 or a capital I on a classroom screen.
- **Year 1 2027 pack:** deliberately not created. The plan says to add it only after KPM publishes and validates the Year 1 documents.
