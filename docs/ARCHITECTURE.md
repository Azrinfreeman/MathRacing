# Architecture

MathRacing is a static, offline-first web app. The splash, menu, setup steps, teacher settings, results, help and pause screens are plain accessible DOM. The live race is a Phaser 4 canvas that exists only for the Ready and Race screens. All rules and curriculum logic live in framework-independent TypeScript.

## Screen flow and state machine

```
SETUP --start--> READY --countdown/skip--> RACING <--pause/resume--> PAUSED
  ^                 |                         |                        |
  |                 v (cancel)                v (winner / all done     v (end / exit)
  +-----------------+                            / teacher ends)      FINISHED --> (exit) SETUP
  ^                                              FINISHED --> RESULTS --Main Lagi--> READY
  +---------------------------------------------------------- RESULTS --New Setup--> SETUP
```

`SessionStateMachine` (`src/game/core/RaceState.ts`) is the single source of truth for the phase: `SETUP, READY, RACING, PAUSED, FINISHED, RESULTS`. Illegal transitions throw and are unit-tested. `AppController` owns it and passes it to `RaceEngine`, which performs READY→RACING, RACING↔PAUSED and →FINISHED.

## Dependency direction

```
locales, storage, reporting          (no game or DOM knowledge except types)
        ^
curriculum  (schema, answers, packs, generators, registry, blueprint)   <- depends only on SeededRng
        ^
game/core   (SeededRng, RaceEngine, RaceState, InputOwnership, players)  <- pure, no Phaser, no DOM
        ^
game/widgets (pure widget models)    game/ui/layout + geometry (pure)
        ^
game/PointerRouter (adapter over a minimal event-source interface)
        ^
game/ui (Phaser drawing) -> game/scenes (Phaser scenes) -> game/createGame
        ^
app  (AppController, screens, dialogs, StageChrome) -> main.ts
```

Rules that keep this honest: scenes and views render engine state and send intents; they never hold the only copy of a race or question rule. Every submission goes through one domain function, `evaluateAnswer`. Nothing in `curriculum/` or `game/core/` imports Phaser or touches the DOM, so those layers are unit-tested without a browser.

## Curriculum

- **Data model** (`curriculum/schema.ts`): `CurriculumPack` (versioned, with basis, status, reviewer, source note) → `CurriculumTopic` (year, code, SK range) → `QuestionTemplate`. A template declares its widget, SK/SP tags, four explicit level ranges, prerequisites, whether a remainder can occur, worked fixtures and (for arithmetic) an independent `recompute`.
- **Question contract:** `GeneratedQuestion` carries pack/version, year, topic, SK, SP, template, difficulty band and level, language, prompt (text, expression, unit, picture), widget, accepted answer, options, hint, support picture and JSON metadata sufficient to reproduce the item.
- **Validation:** `validatePack` runs at registry construction (malformed or duplicate packs throw `CurriculumError`; `main.ts` shows a safe message in production and rethrows in development). `validateGeneratedQuestion` runs on every generated item and the generator retries with a fresh stream if a sample is invalid; templates also throw on duplicate distractors.
- **Determinism:** all randomness comes from `SeededRng`. A session seed forks into a shared **blueprint** (one template per item index, identical for all players, topics rotated evenly) and per-player, per-item streams (`fork('player:<id>')`, `fork('item:<n>')`), so the same configuration and seed reproduce the same content regardless of timing. A pupil never gets the same item twice in a row.
- **Answers:** number answers are exact normalised decimal strings (`normalizeDecimal`), money is integer sen. Choice/tap/order/build answers are checked by option id, set, sequence or count.

## Race engine (`game/core/RaceEngine.ts`)

Time is passed in (`atMs`), so every rule is deterministic and testable.

- `submit()` validates through the answer service, logs the attempt atomically, and locks that one player during the success animation (per-player debounce). `tick()` then deals the next item.
- **Cruise movement** (default, `movement: 'cruise'`): `core/cruise.ts` (pure) keeps each car's fractional `distance`. Speed is piecewise constant (base pace, times `slowFactor` while slowed, plus a boost rate while boost distance is left), so `advanceCruise` integrates exactly and returns the exact finish-crossing time. `tick(atMs)` moves every car, emits `progress` on each whole step (`progress = floor(distance)`), and finishes cars in order of their crossing times, so frame boundaries never change the winner (DECISIONS.md #36). A correct answer queues a one-step boost and cancels a slow-down; a wrong answer (re)starts the slow-down. Scenes read `distance` and `speedState()` every frame.
- **Step movement** (`movement: 'steps'`): a correct answer advances a racer **exactly one step**; two finishing answers close together are resolved by timestamp against the finished flag (see DECISIONS.md #4): one winner, runner-up progress kept.
- Hints (after 2 wrong), visual support then an offered simpler item (after 3 wrong) are tracked per player.
- Pause shifts timers so paused time is not counted; `endRace()` records open items as `unsolved` and declares no winner.

## Multi-touch ownership (a release blocker)

`InputOwnership` (pure) binds a pointer id to the panel under its **first contact** until up/cancel:

- a touch that starts outside every panel has no owner and can never act on a panel by sliding in;
- a touch that starts in panel A and is released over panel B still belongs to A and is reported as "not inside", so it cannot press a control in B;
- ownership is released on up, cancel, pause, resume, visibility loss, window blur and race finish, with a per-frame reconcile against Phaser's `isDown` as a safety net;
- a stale binding (missed pointer-up) is replaced and cancelled on the next down.

`PointerRouter` adapts Phaser's `pointerdown/up/upoutside` events to those rules through a small `PointerEventSource` interface (so it is tested with a fake source, no Phaser). `PanelView` then completes a tap only if the release is inside its own panel on the same control the press started on. Each `PanelView` owns its own `WidgetModel`; no input state is shared between players. Phaser is configured with `input.activePointers: 10`.

## Widgets

Pure models (`game/widgets`) hold input state and lay out their controls; `PanelView` draws them. Number pad and choice tiles are the primary widgets; tap-picture, order-strip and build-value are implemented with tap-only interaction. Widgets never validate answers.

## Screens

`index.html` holds the launch splash inline (it shows before any script); `screens/SplashScreen` takes it over while the game engine preloads, then `AppController` shows `MenuScreen`. From the menu: `SetupScreen` (four steps: Tahun, Topik & Tahap, Pemain, Sedia?) or `TeacherScreen` (options, seed, local data, PBD notice). All three share one in-memory `SetupState` (`app/setupState.ts`); only classroom-level fields are saved as `Settings`, never names or the seed. These screens live inside the `SETUP` phase; the race state machine is unchanged. Inline SVG art (vehicles, topic icons, stars) comes from `app/art.ts`, drawn with the same vehicle coordinates as `TrackView`.

## Rendering

`TextPool` reuses Phaser Text objects by key (no per-frame leaks), `VisualRenderer` draws every question picture (clock, money, shapes, nets, fractions, ruler, measuring cup, pictograph, bar chart, pattern) as original vector art, and `TrackView` draws lanes, racers with five distinct silhouettes, countdown and celebration. All motion is time-based (delta ms), so it is frame-rate independent; reduced motion snaps instead of animating. In cruise, `CarMotion.follow` trails the engine's distance with the same spring, and the speed state picks the effects (boost: flame, exhaust, speed lines; slowed: nose-down and neutral dust). The layout (`game/ui/layout.ts`) is computed from the real viewport and player count: the track takes 42-46% of the height and the panels split the rest equally. Inside the track, `game/ui/trackGeometry.ts` (pure) places the lane badges, start line, step marks and finish chequer as positions of the car's nose, with margins from the lane height, so the marks line up with the cars on every screen.

## Persistence and reporting

`SessionRepository` has an IndexedDB implementation (`mathracing-evidence`: `sessions` and `attempts`, indexed by session) and an in-memory fallback. Each attempt is appended as it happens; the session record is updated when the race ends. `exportCsv` writes UTF-8 with BOM and CRLF and neutralises formula injection. `evidence.ts` summarises attempts for the teacher (counts only, never a mastery judgement). Nothing is transmitted anywhere.

## Offline / PWA

`vite-plugin-pwa` precaches the shell and both JS chunks; there is no runtime caching of remote origins. The build uses a relative base, so it can be served from any folder.

## Extension points

- **New question type:** add a `defineTemplate` in `curriculum/generators`, list it in a pack, run `npm test` (the property suite picks it up automatically) and `npm run docs:curriculum`.
- **New pack / curriculum version:** add a `CurriculumPack` file and register it in `registry.ts`; never edit a released pack silently (bump `version`).
- **New widget:** implement `WidgetModel`, add it to `createWidget`, extend `WidgetKind` and the validator.
- **New language:** add a locale file next to `bm.ts`/`en.ts` (missing keys fall back to BM).
- **Cooperative mode:** `RaceMode` and `QuestionSource` are the seams; a team engine can reuse widgets, panels and persistence.
