import type { Language } from '../curriculum/schema';
import type { RaceEngine } from './core/RaceEngine';
import type { RaceConfig } from './core/RaceState';
import type { SoundService } from './SoundService';
import type { TrackPlayer } from './ui/TrackView';

/**
 * Everything a Phaser scene needs to render one race. The app controller builds it, so scenes stay free of
 * curriculum, storage and screen-flow knowledge: they render engine state and emit intents through this object.
 */
export interface RaceSessionContext {
  readonly engine: RaceEngine;
  readonly config: RaceConfig;
  readonly players: readonly TrackPlayer[];
  language: Language;
  reducedMotion: boolean;
  readonly sound: SoundService;
  /** Monotonic clock in milliseconds (performance.now in the browser). */
  now(): number;
  /** Development-only pointer diagnostic; always false in production builds. */
  readonly devDiagnostics: boolean;
  readonly callbacks: {
    /** The countdown finished and the engine has started (READY -> RACING). */
    onRaceStarted(): void;
    /** The winner celebration is over; the app should move to the results screen. */
    onCelebrationDone(): void;
    /** The browser tab or window was hidden; the app should pause the race. */
    onHidden(): void;
  };
}

/** Commands the app can send to the running game (sent over the Phaser game event emitter). */
export const GAME_COMMANDS = {
  releaseAll: 'mr:release-all',
  skipReady: 'mr:skip-ready',
  language: 'mr:language',
} as const;
