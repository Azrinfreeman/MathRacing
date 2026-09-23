# Implementation plan: splash screen, main menu and a touch-first race setup

Status: implemented (D1 changed: the splash moves on by itself; D2-D8 as recommended). Target: Android tablets (1024x600 to 1920x1200) and TV smartboards (1920x1080 CSS
pixels), landscape, used by a teacher and 2-5 Year 1-2 pupils standing at one screen.

## 1. What is being asked

1. A **splash screen** when the game opens.
2. A **main menu**.
3. A **revamped way to choose Year, level and number of players** (plus topic, mode and race length).

## 2. Current behaviour

- The app opens straight into `SetupScreen` (`src/app/screens/SetupScreen.ts`, 767 lines): one long form in a
  white card on a navy background. At 1920x1080 it is about 3 250 px tall, so it scrolls three screens. Everything
  is on it: year, 7 topics, level, mode, race length, players and names, 5 teacher options, seed, preview, local
  data and the PBD notice.
- The controls are small chips (about 40 px high) with text only. That works with a mouse but is small for a
  child's finger on a smartboard, and pupils cannot read "Tahap kesukaran" or "Jawapan betul untuk sampai penamat".
- `AppController.start()` calls `showSetup()`; the Phaser bundle (about 1.5 MB) loads only when the race starts.
- There is no splash; the page is blank until the JS runs.

## 3. Proposed flow

```
[Splash] --auto / tap--> [Main menu] --Main--> [Setup: 1 Tahun > 2 Topik & Tahap > 3 Pemain > 4 Sedia?] --Mula--> Ready/Race
                              |--Latihan--> same Setup, mode already set to Latihan
                              |--Tetapan guru--> [Teacher settings] --Kembali--> menu
                              '--Bantuan--> help dialog (as today)
Race "Keluar ke persediaan" -> Setup step 4 (settings kept).   Results "Main Lagi" -> unchanged.
```

Splash, menu and settings are app views inside the existing `SETUP` phase. `SessionPhase` and the race state
machine do not change (D8).

### 3.1 Splash screen

```
+--------------------------------------------------------------+
|  (sky gradient, the track band, three cars drive across)      |
|                                                               |
|                 [logo]  MathRacing                            |
|              Lumba Matematik  Tahun 1 & 2                     |
|                                                               |
|                 ( Sentuh untuk mula )   <- pulses when ready  |
|   Sedia tanpa internet (tick)                  v1.0.0 BM|EN  |
+--------------------------------------------------------------+
```

- **Instant:** the markup and critical CSS go **inline in `index.html`**, so the splash shows before any JS runs.
  `SplashScreen.ts` takes it over, then removes it.
- **Moves on** when the app is ready and at least 1.5 s have passed, or on a tap (D1). It shows once per app
  launch, not after each race.
- **Loads Phaser in the background** (`import('./game/createGame')` during the splash), so "Mula" later starts at
  once. If the preload fails, nothing breaks: the race loads it again as today.
- **Animation:** CSS only (cars built from the same shapes and colours as the track). It is off when the teacher's
  "Kurangkan gerakan" is on. The OS flag is not inherited (DECISIONS #33).
- **Accessibility:** it is a `button`, so Enter or Space also continues. It has a `role="status"` loading line and
  the real language (BM default).

### 3.2 Main menu

```
+--------------------------------------------------------------+
| [logo] MathRacing                         [BM|EN]  [?] Bantuan|
|                                                               |
|      +------------------+   +------------------+              |
|      |  (flag)  MAIN    |   | (book)  LATIHAN  |              |
|      |  Lumba Pantas    |   | Tiada pemenang   |              |
|      +------------------+   +------------------+              |
|                                                               |
|      [ Main semula: Tahun 1, 2.0 Operasi Asas, Tahap 1, 2 pemain ] |
|                                                               |
|  (gear) Tetapan guru                     3 sesi disimpan      |
+--------------------------------------------------------------+
```

- Two very large cards (at least 200 px tall on a smartboard), with an icon and a short word a Year 1 child can read.
- **"Main semula"** (repeat last race) appears only when there are saved settings: one tap to go straight to step 4.
- **Tetapan guru** (teacher settings) is small and at the bottom, so pupils go for the big buttons (D4 and D6).

### 3.3 Setup: four steps, each one screen with no scrolling (D3)

A stepper sits across the top, and each number can be tapped to jump to that step. **Kembali** (back) and
**Seterusnya** (next) are large buttons at the bottom. Every step fits 1024x600 without scrolling.

**Step 1: Tahun (Year)**: two big cards, "Tahun 1" and "Tahun 2", each with a large numeral and a short example
("5 + 3", "24 ÷ 4"). Picking one moves straight on to step 2.

**Step 2: Topik & Tahap (topic and level)**

- Topics: a grid of cards with an icon per topic group (numbers, operations, money, time, measurement, space, data),
  the topic title and the SK range in small print. "Pilih semua" and "Kosongkan" stay as buttons.
- Level: 4 large "speed" cards with 1 to 4 stars and the name (Asas, Sederhana, Mencabar, Lanjutan), plus
  "Contoh" (example) showing one sample question for the chosen topic and level. That reuses
  `previewQuestions()`, so the existing preview dialog is kept but becomes this inline sample.

**Step 3: Pemain (players)**

- 4 big number buttons, 2 to 5. Below them, one "car card" per player: that player's vehicle drawn in its colour,
  with its symbol and number (the same identity as on the track), and an optional name field. The privacy hint
  stays.
- The vehicle for each slot stays fixed (D5): colour + symbol + number is the accessibility rule, and it matches the
  panel order on screen.

**Step 4: Sedia? (ready?)**

- A summary card for each choice (Tahun 1, 2.0 Operasi Asas, Tahap 1, 2 pemain), and tapping one jumps back to its
  step.
- Mode (Lumba Pantas / Latihan) and race length (5, 8, 10, 12) are here as large segmented buttons, since the menu
  already chose the mode.
- A huge **Mula ▶** button.

### 3.4 Teacher settings (from the menu)

This moves everything a pupil should not touch off the setup path: sound, reduce motion, hints, support, setback
(with their notes), the session seed, local data (count, delete all) and the PBD notice. It uses the same controls
as today, laid out in two columns. It keeps working exactly like today: settings are saved on change, and player
names are never saved.

## 4. Visual design

- **Theme:** the track's colours: navy `THEME.night` background, sky gradient header, white cards with a 16 px
  radius, and the player colours from `PLAYER_STYLES`. There are no web fonts (offline); it uses the existing
  system font stack.
- **Touch sizes:** at least 64 px targets on tablets and 88 px on a 1080p smartboard (scaled with `clamp()` and
  `vmin`). Selected items get a thick outline and a tick, never colour alone.
- **Icons and art:** original inline SVG in a new `src/app/art.ts` (topic icons, stars, the 5 vehicles as small
  SVG). No image files, so no new assets to cache.
- **Motion:** 150-250 ms card presses and step slides (CSS). The teacher's reduce-motion setting turns them off
  through a class on `<html>`; the existing `@media (prefers-reduced-motion)` rule stays for DOM only.

## 5. Code changes

| File                                             | Change                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `index.html`                                     | inline splash markup + critical CSS                                                           |
| `src/app/screens/SplashScreen.ts` (new)          | takes over the inline splash, min time, tap, Phaser preload                                   |
| `src/app/screens/MenuScreen.ts` (new)            | main menu                                                                                     |
| `src/app/screens/SetupScreen.ts`                 | becomes the 4-step wizard; step bodies split into `src/app/screens/setup/*.ts` (one per step) |
| `src/app/screens/TeacherSettingsScreen.ts` (new) | options, seed, data, PBD notice moved here                                                    |
| `src/app/art.ts` (new)                           | inline SVG icons and vehicles                                                                 |
| `src/app/AppController.ts`                       | view routing: splash -> menu -> setup / teacher; exits go to setup step 4                     |
| `src/app/styles/app.css`                         | splash, menu, wizard and teacher screen styles                                                |
| `src/locales/bm.ts`, `en.ts`                     | new keys (`splash.*`, `menu.*`, `setup.step.*`, `teacher.*`); BM first                        |
| `src/app/help.ts`, `README.md`                   | describe the new flow                                                                         |
| `src/storage/settings.ts`                        | no new fields needed (mode, year, level and so on already exist)                              |

**Kept on purpose:** every existing `data-testid` (year-2, topic-_, level-_, mode-_, length-_, count-_, name-_,
opt-*, seed, start, preview, delete-all, ...), so the e2e helpers only learn the new navigation.

## 6. Tests

- **Unit (`src/tests/app.test.ts`):** splash -> menu -> wizard -> start builds the same `SetupInput` as today; Back
  and Next keep the choices; "Latihan" presets the mode; "Main semula" goes to step 4; step 2 cannot go on without
  a topic; teacher settings still persist and never store names; the splash skips on a tap and after its minimum
  time with a fake clock.
- **Locales:** `locales.test.ts` covers the new keys (BM complete, EN falls back per key).
- **e2e:** `support.ts` gains `openSetup(page)` (splash, then menu, then Main), and `fillSetup` clicks through the
  steps. The existing 25 tests keep their assertions. New tests:
  - the full flow at 1024x600, 1280x800 and 1920x1080 checks **no scrollbars on any step** and one screenshot per
    screen at 1920x1080;
  - offline: the splash shows with the network off (inline HTML);
  - the multi-touch and race tests do not change.

## 7. Work breakdown (one commit each)

1. Splash (inline HTML + `SplashScreen`, Phaser preload) + unit tests.
2. Main menu + controller routing + teacher settings screen (options move out of setup).
3. Setup wizard (steps 1-4, art, styles) + unit tests.
4. e2e helpers and new e2e tests; README, help, DECISIONS #35, ARCHITECTURE, REPO-MAP.

Size: medium to large, about two sessions. The riskiest part is the no-scroll layout at 1024x600 in step 2 (7 topic
cards + 4 levels); the fallback is a 2-column topic grid with smaller cards on short screens.

## 8. Decisions needed from you

- **D1 Splash timing.** Stay until ready **and at least 1.5 s, then show "Sentuh untuk mula" and wait for a tap**
  (recommended: a nice moment in class, and it unlocks audio on Android, which needs a tap before sound can play),
  or move on to the menu automatically.
- **D2 Menu buttons.** **Main (Lumba Pantas), Latihan, Tetapan guru, Bantuan, + "Main semula"** (recommended), or
  one single "Main" button with the mode chosen inside setup.
- **D3 Setup style.** A **4-step wizard** with a tappable stepper (recommended for pupils and touch), or one redesigned
  page with big controls and no steps (faster for a teacher, but it scrolls on tablets).
- **D4 Where teacher options live.** A **separate "Tetapan guru" screen from the menu** (recommended), or a
  collapsible "Lanjutan" (advanced) area on step 4.
- **D5 Pupils choose their own vehicle or colour?** **Not now: fixed per slot** (recommended: it keeps the colour,
  symbol and number rule and the panel order simple), or a picker on step 3 (a bigger change touching
  `players.ts`, the panels and the evidence).
- **D6 Protect teacher settings?** **No lock** (recommended for now), or press-and-hold 2 s on "Tetapan guru" so
  pupils do not open it by accident.
- **D7 Race length and mode placement.** **On step 4** (recommended), or as a 5th step.
- **D8 State machine.** Keep splash, menu and settings as **app views inside `SETUP`** (recommended: no change to
  the race rules or evidence), or add new `SessionPhase` values.

## 9. Acceptance checklist

- [ ] The splash appears instantly (before JS) and offline; it never blocks for more than the ready time + tap.
- [ ] From the menu, a pupil-led setup takes at most 5 taps to start with the defaults.
- [ ] No setup step scrolls at 1024x600, 1280x800 or 1920x1080; every target is at least 64 px on tablets.
- [ ] All previous behaviour is kept: settings persistence, names never stored, preview, seed, delete data, help,
      language switch.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` green; docs updated.
