import type { CurriculumRegistry } from '../curriculum/registry';
import type { Language, Level, Year } from '../curriculum/schema';
import type { RaceMode } from '../game/core/RaceState';
import { MAX_PLAYERS, defaultPlayerName } from '../game/core/players';
import { resolveRacers } from '../game/core/racers';
import type { RacerId } from '../game/core/racers';
import type { Settings } from '../storage/settings';

/** Everything a race needs, built from the setup choices when the teacher presses Start. */
export type SetupInput = {
  year: Year;
  topicIds: string[];
  level: Level;
  mode: RaceMode;
  raceLength: number;
  playerNames: string[];
  /** One racer per player, all different. */
  racers: RacerId[];
  language: Language;
  sound: boolean;
  reducedMotion: boolean;
  hintsEnabled: boolean;
  supportEnabled: boolean;
  /** Quick Race step movement only: the 3rd wrong answer to one question moves the racer back a step. */
  setbackEnabled: boolean;
  /** Cars drive forward on their own; answers boost or slow them. Off = the step race. */
  cruiseEnabled: boolean;
  /** Teacher-supplied seed for reproducing a session, or null for a random one. */
  seed: string | null;
};

/**
 * The choices shared by the menu, the setup steps and the teacher settings screen. It lives in memory for the
 * whole app session; only the classroom-level fields are saved (as `Settings`), including the racer picked for
 * each seat. Player names and the seed are never saved.
 */
export type SetupState = {
  year: Year;
  topicIds: Set<string>;
  level: Level;
  mode: RaceMode;
  raceLength: number;
  playerCount: number;
  names: string[];
  /** Racer per slot (`MAX_PLAYERS` entries); the active ones are always different. */
  racers: RacerId[];
  language: Language;
  sound: boolean;
  reducedMotion: boolean;
  hintsEnabled: boolean;
  supportEnabled: boolean;
  setbackEnabled: boolean;
  cruiseEnabled: boolean;
  seed: string;
};

export function stateFromSettings(s: Settings): SetupState {
  return {
    year: s.year,
    topicIds: new Set(s.topicIds),
    level: s.level,
    mode: s.mode,
    raceLength: s.raceLength,
    playerCount: s.playerCount,
    names: Array.from({ length: MAX_PLAYERS }, () => ''),
    racers: resolveRacers(s.racers, s.playerCount),
    language: s.language,
    sound: s.sound,
    reducedMotion: s.reducedMotion,
    hintsEnabled: s.hintsEnabled,
    supportEnabled: s.supportEnabled,
    setbackEnabled: s.setbackEnabled,
    cruiseEnabled: s.cruiseEnabled,
    seed: '',
  };
}

export function settingsFromState(s: SetupState): Settings {
  return {
    language: s.language,
    sound: s.sound,
    reducedMotion: s.reducedMotion,
    hintsEnabled: s.hintsEnabled,
    supportEnabled: s.supportEnabled,
    setbackEnabled: s.setbackEnabled,
    cruiseEnabled: s.cruiseEnabled,
    year: s.year,
    topicIds: [...s.topicIds],
    level: s.level,
    raceLength: s.raceLength,
    mode: s.mode,
    playerCount: s.playerCount,
    racers: [...s.racers],
  };
}

/** The topic picked when the year changes: the year's operations topic (second in the pack), else the first. */
export function defaultTopicForYear(registry: CurriculumRegistry, year: Year): string {
  const topics = registry.packForYear(year).topics;
  return topics[1]?.id ?? (topics[0]?.id as string);
}

/** Drop topics that do not belong to the selected year (settings can be stale). */
export function keepYearTopics(registry: CurriculumRegistry, s: SetupState): void {
  const valid = new Set(registry.packForYear(s.year).topics.map((tp) => tp.id));
  for (const id of [...s.topicIds]) if (!valid.has(id)) s.topicIds.delete(id);
}

/** Make names unique and non-empty: blanks get the default name, duplicates get a numeric suffix. */
export function normalizeNames(
  raw: readonly string[],
  count: number,
  language: Language,
): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const trimmed = (raw[i] ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
    const base = trimmed === '' ? defaultPlayerName(i, language) : trimmed;
    const key = base.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    out.push(n === 1 ? base : `${base} ${n}`);
  }
  return out;
}

/** The race input, or null when no topic is selected (the only invalid choice). */
export function buildSetupInput(s: SetupState): SetupInput | null {
  if (s.topicIds.size === 0) return null;
  const seed = s.seed.trim().slice(0, 24);
  return {
    year: s.year,
    topicIds: [...s.topicIds],
    level: s.level,
    mode: s.mode,
    raceLength: s.raceLength,
    playerNames: normalizeNames(s.names, s.playerCount, s.language),
    racers: resolveRacers(s.racers, s.playerCount).slice(0, s.playerCount),
    language: s.language,
    sound: s.sound,
    reducedMotion: s.reducedMotion,
    hintsEnabled: s.hintsEnabled,
    supportEnabled: s.supportEnabled,
    setbackEnabled: s.setbackEnabled,
    cruiseEnabled: s.cruiseEnabled,
    seed: seed === '' ? null : seed,
  };
}
