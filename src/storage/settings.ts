import type { Language, Level, Year } from '../curriculum/schema';
import type { RaceMode } from '../game/core/RaceState';

/**
 * Teacher preferences remembered between sessions in localStorage. Deliberately excludes player names and any
 * pupil data: only classroom-level choices are stored here.
 */
export type Settings = {
  language: Language;
  sound: boolean;
  reducedMotion: boolean;
  hintsEnabled: boolean;
  supportEnabled: boolean;
  setbackEnabled: boolean;
  year: Year;
  topicIds: string[];
  level: Level;
  raceLength: number;
  mode: RaceMode;
  playerCount: number;
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'bm',
  sound: true,
  reducedMotion: false,
  hintsEnabled: true,
  supportEnabled: true,
  setbackEnabled: true,
  year: 1,
  topicIds: ['y1-operations'],
  level: 1,
  raceLength: 8,
  mode: 'quick',
  playerCount: 2,
};

const KEY = 'mathracing.settings.v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Accessing localStorage can throw when site data is blocked; the app then runs with defaults.
    return null;
  }
}

function pickBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Validate untrusted stored JSON field by field; anything unexpected falls back to the default. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return { ...d, topicIds: [...d.topicIds] };
  const r = raw as Record<string, unknown>;
  const year: Year = r.year === 2 ? 2 : 1;
  const topicIds = Array.isArray(r.topicIds)
    ? r.topicIds.filter((t): t is string => typeof t === 'string' && t.startsWith(`y${year}-`))
    : [];
  const level: Level = r.level === 2 || r.level === 3 || r.level === 4 ? r.level : 1;
  const raceLength = [5, 8, 10, 12].includes(Number(r.raceLength))
    ? Number(r.raceLength)
    : d.raceLength;
  const playerCount =
    Number.isInteger(r.playerCount) && Number(r.playerCount) >= 2 && Number(r.playerCount) <= 5
      ? Number(r.playerCount)
      : d.playerCount;
  return {
    language: r.language === 'en' ? 'en' : 'bm',
    sound: pickBoolean(r.sound, d.sound),
    reducedMotion: pickBoolean(r.reducedMotion, d.reducedMotion),
    hintsEnabled: pickBoolean(r.hintsEnabled, d.hintsEnabled),
    supportEnabled: pickBoolean(r.supportEnabled, d.supportEnabled),
    setbackEnabled: pickBoolean(r.setbackEnabled, d.setbackEnabled),
    year,
    topicIds: topicIds.length > 0 ? topicIds : year === 1 ? ['y1-operations'] : ['y2-operations'],
    level,
    raceLength,
    mode: r.mode === 'practice' ? 'practice' : 'quick',
    playerCount,
  };
}

/** First run: honour the operating system's reduced-motion preference until the teacher chooses otherwise. */
export function withSystemDefaults(settings: Settings): Settings {
  const prefersReduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return prefersReduced ? { ...settings, reducedMotion: true } : settings;
}

export class SettingsStore {
  /**
   * @param onError called (never thrown) when storage is blocked or corrupt, so the app can log it. Settings
   *   are a convenience: a failure here must never stop the app or a race.
   */
  constructor(
    private readonly store: KeyValueStore | null = browserStore(),
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  load(): Settings {
    if (!this.store) return withSystemDefaults(sanitizeSettings(null));
    try {
      const text = this.store.getItem(KEY);
      if (text === null) return withSystemDefaults(sanitizeSettings(null));
      return sanitizeSettings(JSON.parse(text) as unknown);
    } catch (error) {
      this.onError(error);
      return withSystemDefaults(sanitizeSettings(null));
    }
  }

  save(settings: Settings): void {
    if (!this.store) return;
    try {
      this.store.setItem(KEY, JSON.stringify(settings));
    } catch (error) {
      this.onError(error);
    }
  }

  clear(): void {
    try {
      this.store?.removeItem(KEY);
    } catch (error) {
      this.onError(error);
    }
  }
}
