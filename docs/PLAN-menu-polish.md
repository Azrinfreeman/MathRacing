# Implementation plan: a cleaner, more professional menu and setup

Status: **proposal, not implemented.** Section 7 lists the decisions that are yours; the plan follows the
recommended answer for each. Say "proceed" to build it with those answers, or give different answers.

## 1. What is being asked

The owner photographed the setup screen ("Topik & Tahap") on the Android tablet and asked for the menu to look
cleaner, more professional and nicer. "Menu" here means the teacher-facing screens around the race: the main menu,
the four setup steps and the teacher settings. The race track, answer panels and results are out of scope (D1).

## 2. What the photo shows (problems to fix)

| #   | Problem on the tablet                                                                                                                      | Cause                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | The topic list is cut off ("7.0 Pengurusan" half hidden, needs scrolling), although the 1024x600 test passes on the PC.                    | The Android navigation bar takes ~48 px, so the page is shorter than 600 px, and Android's Roboto font is wider/taller than Windows' Segoe UI. |
| P2  | Cramped and busy: every block has a border, a shadow and a different radius; buttons, cards and chips all look equally loud.               | No shared spacing, radius or elevation scale; styles grew screen by screen.                                                                    |
| P3  | The two-line draft pack notice ("Pek kurikulum aktif: KSSR (Semakan 2017) - Edisi 3 ... Versi 1.0.0.") takes prime space above the topics. | It is shown as body text on every visit.                                                                                                       |
| P4  | Selected topics are shown by a "✓" glued to the title, so titles jump sideways and wrap ("✓ 1.0 Nombor Bulat / hingga 100").               | The tick is part of the text instead of a fixed badge.                                                                                         |
| P5  | Level cards are uneven ("2 / Sederhana" wraps, the others do not).                                                                         | Width-dependent wrapping, no fixed layout for star + label.                                                                                    |
| P6  | Header buttons (Menu, Bantuan) and "Pilih semua / Kosongkan" look like primary actions; "Kembali" and "Seterusnya" differ in height.       | One button style used for everything.                                                                                                          |
| P7  | The menu is plain: big flat cards on a flat navy background, a grey strip of cars, and a lot of empty space on large screens.              | No visual identity beyond the colours.                                                                                                         |

## 3. Design direction

Clean and calm for the teacher, still friendly for Year 1-2 pupils. One consistent system for every screen:

- **Design tokens** (in `app.css` `:root`): spacing scale (4, 8, 12, 16, 24, 32 px, scaled by the existing
  `clamp` root font size), three radii (small 10 px for chips, medium 16 px for cards, large 24 px for panels),
  two elevations (card, raised), and a refined palette: navy background with a soft radial glow, white panels,
  slate text, one blue accent, orange (Main) and green (Latihan) kept as the mode colours, amber focus ring.
- **One font on every device (D2):** bundle **Nunito** (SIL Open Font License, rounded and very readable for young
  pupils) as two local `woff2` files (regular + extra-bold, ~70 KB total, precached, works offline). This makes the
  tablet look exactly like the PC and fixes the Roboto part of P1.
- **Three button levels:** primary (filled blue: Seterusnya, Mula), secondary (white with border: Kembali, Pratonton),
  quiet (text + icon on the dark header: Menu, Bantuan, BM/EN; "Pilih semua / Kosongkan" become small text buttons).
  Every button keeps a touch target of at least 48 px (56 px for pupil-facing choices) and the visible focus ring.
- **Selection is a badge, not text:** a selected card gets a blue border, a light blue fill and a round check badge
  in its top-right corner; the title never moves (P4). Same pattern for topics, levels, player counts, modes and
  race lengths.
- **Gentle feedback:** 120 ms colour/shadow transition and a slight press-down (scale 0.98) on tap; off when the
  teacher's "Kurangkan gerakan" is on (the existing `reduce-motion` class, DECISIONS #33/#35).

## 4. Screen by screen

### 4.1 Main menu

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [logo] MathRacing                                   [BM|EN]  (?) Bantuan │  quiet header
│        Lumba matematik untuk Tahun 1 dan Tahun 2                          │
│                                                                          │
│     ┌───────────────────────┐      ┌───────────────────────┐             │
│     │  (flag in a circle)   │      │ (target in a circle)  │             │
│     │  MAIN                 │      │  LATIHAN              │  mode cards: softer gradient,
│     │  Lumba Pantas: ...    │      │  Tiada pemenang ...   │  icon in a white circle,
│     └───────────────────────┘      └───────────────────────┘  title + one-line description
│              [ ↻ Main semula: Tahun 1 · 2.0 Operasi · 2 pemain ]         │  shown once a setup exists
│ ───────── road with dashed centre line: racers (2 vehicles + 3 animals) drive slowly across ───────── │
│ ⚙ Tetapan guru                                     0 sesi disimpan       │  quiet footer
└──────────────────────────────────────────────────────────────────────────┘
```

- Background: navy with a soft radial glow behind the cards and a faint pattern of maths symbols (+ − × = at 4%
  opacity, pure CSS/SVG, no image files).
- The racer road shows a mix of vehicles and animals (D5) so pupils see that animals exist; they drive slowly
  across (CSS animation, stopped by "Kurangkan gerakan").
- "Main semula" becomes a wide pill under the cards that also says what it repeats (year, topic, player count).

### 4.2 Setup (all four steps)

- **Header:** "⌂ Menu" (quiet), title "Sediakan perlumbaan", "Bantuan" (quiet). One row, 48 px tall.
- **Stepper:** a slim progress bar: four numbered dots joined by a line; done = green dot with a tick, current = white
  pill with the step name, later = outlined dot with the name. On screens under 1100 px wide only the current step
  shows its name (the others show the number), which saves ~20 px of height and all the wrapping.
- **Panel:** one white panel with 24 px padding and the large radius; no nested borders inside it.
- **Footer:** "◀ Kembali" (secondary) and "Seterusnya ▶" / "Mula ▶" (primary), same height, pinned to the bottom.

Step 2 (the one in the photo), sized for a 960x540 page:

```
┌ Topik ─────────────────────────── Pilih semua · Kosongkan ┐┌ Tahap kesukaran ───────┐
│ [123] 1.0 Nombor Bulat hingga 100   (✓)│[+−] 2.0 Operasi Asas (✓) ││ ★☆☆☆  1 Asas        (✓) │
│ [RM ] 3.0 Wang                         │[⏲ ] 4.0 Masa               ││ ★★☆☆  2 Sederhana       │
│ [📏 ] 5.0 Sukatan                      │[△○] 6.0 Ruang              ││ ★★★☆  3 Mencabar        │
│ [📊 ] 7.0 Pengurusan Data              │                            ││ ★★★★  4 Lanjutan        │
│ ⓘ KSSR 2017 · Draf v1.0.0                                          ││ [Pratonton 5 soalan]    │
└────────────────────────────────────────────────────────────────────┘└─────────────────────────┘
```

- Topic cards: one line high (title; the SK range in small grey text on the same line when it fits, under it
  otherwise), a coloured icon tile per topic group, the check badge on the right. Seven topics fit in four rows.
- Levels become a vertical list of four rows (stars left, number + name right), so every label has the same
  width and nothing wraps (P5).
- The pack notice becomes one small chip "ⓘ KSSR 2017 · Draf v1.0.0" (D4); tapping it opens the full text in a
  dialog. The draft status stays visible on screen, as the curriculum rules require.

Steps 1, 3 and 4 get the same card, badge, spacing and button treatment. Step 3 keeps the racer pictures from
DECISIONS #39; step 4's summary tiles get the icon tile + value + "Tukar" link layout.

### 4.3 Teacher settings

- Same header and panel. Options grouped under three headings (Permainan, Bantuan murid, Data) with switch-style
  toggles instead of checkboxes, each with its one-line explanation in grey underneath. The PBD notice becomes an
  info box with an icon at the bottom.

## 5. Fitting the tablet (P1)

- New minimum target: **960x540** CSS px (a 1024x600 tablet with the navigation bar, or with display zoom). Every
  menu, setup and teacher screen must fit without scrolling at 960x540, 1024x600, 1280x800 and 1920x1080.
- **Android full screen (D6):** hide the navigation bar in the app (sticky immersive mode in `MainActivity.java`;
  a swipe from the edge shows it briefly). That gives the game the whole 600 px on the tablet in the photo and
  also helps the race screen.
- Below 960x540 (phones, split screen) the panel may scroll, as today.

## 6. Tests and verification

- `e2e/mathracing.spec.ts` "fit without scrolling": add 960x540 to the viewport list; check the menu, all four
  steps and the teacher screen (today the teacher screen is not measured).
- Playwright screenshots (before and after) of the menu and step 2 at 960x540 and 1920x1080, shared with the owner.
- Unit tests: `app.test.ts` keeps working because every `data-testid` stays the same; add a test that the pack
  chip opens the full pack notice.
- Fonts: check that the `woff2` files are in the service-worker precache (`globPatterns` gains `woff2`) and that the
  offline e2e test still passes.
- Contrast: every text/background pair in the new palette at least 4.5:1 (checked with `contrastRatio` in a unit
  test for the tokens that are used for text).
- Release APK (`npm run apk:release`) for the owner to try on the tablet.

## 7. Decisions for you (recommended answer first)

| #   | Question                  | Recommended                                                                               | Alternatives                                                                |
| --- | ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| D1  | Which screens?            | **Main menu, the four setup steps, teacher settings** (race, results unchanged for now)   | Also restyle results and the help dialog in the same pass                   |
| D2  | Font                      | **Bundle Nunito** (rounded, friendly, identical on every device, works offline, +~70 KB)  | Keep the device's system font (no download, looks different on each device) |
| D3  | Overall look              | **Keep the navy background**, white panels, refined orange/green mode cards               | A light theme (white/very light background everywhere)                      |
| D4  | Draft pack notice         | **One small "ⓘ KSSR 2017 · Draf v1.0.0" chip**, tap for the full text                     | Keep the full two-line text on screen                                       |
| D5  | Racers on the menu road   | **A mix of vehicles and animals, driving slowly across** (stops with "Kurangkan gerakan") | Keep the five default vehicles standing still                               |
| D6  | Android navigation bar    | **Hide it (sticky immersive full screen)**                                                | Keep it visible and only design for the shorter screen                      |
| D7  | Tablet size to design for | **960x540 as the smallest no-scroll size**                                                | Tell me the tablet model or its exact size, and I design for that           |

## 8. Files touched

| File                                                                                                        | Change                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/app/styles/app.css`                                                                                    | design tokens; buttons; cards and check badge; header, stepper, panel, footer; menu; teacher toggles; small-screen rules |
| `public/fonts/nunito-*.woff2` (new), `app.css`, `index.html`                                                | `@font-face` with `font-display: swap`; the splash uses the same font                                                    |
| `vite.config.ts`                                                                                            | precache `woff2`                                                                                                         |
| `src/app/screens/MenuScreen.ts`                                                                             | header/footer markup, mode card icon circles, "Main semula" summary pill, mixed racer road                               |
| `src/app/screens/SetupScreen.ts`                                                                            | stepper markup, check badges instead of "✓" text, level list, pack chip + dialog, summary tiles                          |
| `src/app/screens/TeacherScreen.ts`                                                                          | grouped options with switch toggles, PBD info box                                                                        |
| `src/app/controls.ts`                                                                                       | `choice()` renders the check badge; a `switchControl()` for the teacher toggles                                          |
| `src/app/art.ts`                                                                                            | topic icon tiles with a colour per group; small maths-symbol pattern for the menu                                        |
| `src/locales/bm.ts`, `en.ts`                                                                                | pack chip text, teacher group headings, "Main semula" summary                                                            |
| `android/app/src/main/java/.../MainActivity.java`                                                           | sticky immersive full screen                                                                                             |
| `e2e/mathracing.spec.ts`, `src/tests/app.test.ts`                                                           | 960x540 fit, teacher screen fit, pack chip test                                                                          |
| `docs/DECISIONS.md` (#41), README, `PROJECT_STATE.md`, `docs/REPO-MAP.md`, `public/`licence note for Nunito | docs                                                                                                                     |

## 9. Order of work (one commit each)

1. Tokens, font, buttons, cards with check badges, header/stepper/panel/footer (every screen picks these up).
2. Main menu layout and the racer road.
3. Setup steps: topic grid, level list, pack chip, summary tiles; 960x540 fit.
4. Teacher settings: grouped switches.
5. Android immersive mode; e2e sizes and screenshots; docs; full `npm run check` + `npm run test:e2e`; release APK.

## 10. Risks

- **A new look could confuse teachers who already know the screens:** layout, order and wording stay the same;
  only the styling and a few positions change.
- **Hidden navigation bar:** some teachers use the Back button; Android shows the bar again with a swipe from the
  edge, and the app's own "Menu" / "Kembali" buttons cover every way back.
- **Font licence:** Nunito is SIL OFL 1.1, which allows bundling; the licence file ships next to the fonts.
