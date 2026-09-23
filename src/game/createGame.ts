import * as Phaser from 'phaser';
import type { Language } from '../curriculum/schema';
import { BootScene } from './scenes/BootScene';
import { RaceScene } from './scenes/RaceScene';
import { ReadyScene } from './scenes/ReadyScene';
import type { RaceSessionContext } from './session';
import { GAME_COMMANDS } from './session';
import { THEME } from './ui/theme';

/** Handle the app uses to talk to the running Phaser game. */
export interface GameHandle {
  readonly game: Phaser.Game;
  /** Drop every touch in flight (pause, finish). */
  releaseAll(): void;
  /** Teacher skips waiting for every pupil to confirm on the Ready screen. */
  skipReady(): void;
  setLanguage(language: Language): void;
  destroy(): void;
}

/** Number of pointer slots reserved: 5 pupils plus spares so accidental extra contacts cannot steal a slot. */
export const ACTIVE_POINTERS = 10;

/** Device pixel ratio used for the canvas, capped at 2 so 4K panels stay smooth and text stays sharp. */
export function canvasPixelRatio(): number {
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}

export function createGame(parent: HTMLElement, session: RaceSessionContext): GameHandle {
  const dpr = canvasPixelRatio();
  const cssSize = (): { w: number; h: number } => ({
    w: Math.max(1, Math.round(parent.clientWidth || window.innerWidth)),
    h: Math.max(1, Math.round(parent.clientHeight || window.innerHeight)),
  });
  const first = cssSize();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: `#${THEME.night.toString(16).padStart(6, '0')}`,
    banner: false,
    disableContextMenu: true,
    // Sound is synthesised by our own SoundService; Phaser's audio system is not needed.
    audio: { noAudio: true },
    scale: {
      // The canvas backing store is sized in device pixels and shown at CSS size (see the resize observer
      // below), so text stays sharp on 4K panels with 150-200 percent display scaling.
      mode: Phaser.Scale.NONE,
      width: first.w * dpr,
      height: first.h * dpr,
    },
    input: {
      // Ten active pointers: five simultaneous pupils plus spare slots for accidental extra contacts.
      activePointers: ACTIVE_POINTERS,
      touch: { capture: true },
    },
    render: { antialias: true, roundPixels: false },
    scene: [BootScene, ReadyScene, RaceScene],
    callbacks: {
      preBoot: (g) => {
        g.registry.set('session', session);
      },
    },
  });

  const applySize = (): void => {
    const { w, h } = cssSize();
    game.scale.resize(w * dpr, h * dpr);
    // resize() sizes the canvas in game pixels; show it at CSS size so one game pixel is one device pixel
    game.canvas.style.width = `${w}px`;
    game.canvas.style.height = `${h}px`;
    game.scale.refresh();
  };
  game.events.once(Phaser.Core.Events.READY, applySize);
  const observer = new ResizeObserver(() => {
    if (game.isBooted) applySize();
  });
  observer.observe(parent);

  return {
    game,
    releaseAll: () => game.events.emit(GAME_COMMANDS.releaseAll),
    skipReady: () => game.events.emit(GAME_COMMANDS.skipReady),
    setLanguage: (language) => {
      session.language = language;
      game.events.emit(GAME_COMMANDS.language);
    },
    destroy: () => {
      observer.disconnect();
      game.destroy(true);
    },
  };
}
