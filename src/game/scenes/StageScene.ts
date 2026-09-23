import * as Phaser from 'phaser';
import { createTranslator } from '../../locales';
import type { Translator } from '../../locales';
import { InputOwnership } from '../core/InputOwnership';
import type { PointerLike } from '../PointerRouter';
import { PointerRouter } from '../PointerRouter';
import type { RaceSessionContext } from '../session';
import { GAME_COMMANDS } from '../session';
import { contains } from '../ui/geometry';
import { computeStageLayout } from '../ui/layout';
import type { PanelMode } from '../ui/PanelView';
import { PanelView } from '../ui/PanelView';
import { THEME } from '../ui/theme';
import { TrackView } from '../ui/TrackView';

/**
 * Shared behaviour of the Ready and Race scenes: the responsive layout (track on top, one equal panel per
 * player below), the panel views, the pointer router with per-pointer ownership, and clean shutdown so that
 * restarting a race never multiplies listeners or leaks timers.
 */
export abstract class StageScene extends Phaser.Scene {
  protected session!: RaceSessionContext;
  protected panels: PanelView[] = [];
  protected track!: TrackView;
  protected t!: Translator;
  protected readonly ownership = new InputOwnership();
  protected router!: PointerRouter;
  private diagText: Phaser.GameObjects.Text | null = null;
  private lastReconcile = 0;
  private readonly cleanups: Array<() => void> = [];
  private tornDown = false;

  private consecutiveFrameErrors = 0;
  private fatalReported = false;

  /**
   * Run one frame of scene work so that an error can never kill Phaser's game loop (an uncaught exception
   * there freezes the whole screen on its last frame). The error is logged; if frames keep failing, the app is
   * told so it can stop the race and return to Setup instead of leaving a frozen screen.
   */
  protected guardedFrame(work: () => void): void {
    try {
      work();
      this.consecutiveFrameErrors = 0;
    } catch (error) {
      this.consecutiveFrameErrors += 1;
      if (this.consecutiveFrameErrors <= 3)
        console.error('Frame error (the game keeps running)', error);
      if (this.consecutiveFrameErrors >= 30 && !this.fatalReported) {
        this.fatalReported = true;
        this.session.callbacks.onFatal(error);
      }
    }
  }

  /** Register cleanup that must run when the scene stops OR when the whole game is destroyed. */
  protected addCleanup(fn: () => void): void {
    this.cleanups.push(fn);
  }

  protected buildStage(mode: PanelMode): void {
    this.tornDown = false;
    this.session = this.game.registry.get('session') as RaceSessionContext;
    this.t = createTranslator(this.session.language);
    this.cameras.main.setBackgroundColor(THEME.night);
    this.input.mouse?.disableContextMenu();

    const { players, config } = this.session;
    this.track = new TrackView(
      this,
      players,
      config.raceLength,
      this.t,
      this.session.reducedMotion,
    );
    this.panels = players.map(
      (p, i) =>
        new PanelView(
          this,
          i,
          { id: p.id, name: p.name },
          p.style,
          this.t,
          config.raceLength,
          this.session.reducedMotion,
        ),
    );
    this.panels.forEach((panel) => panel.setMode(mode));
    this.layoutStage();

    this.router = new PointerRouter(this.input, this.ownership, {
      hitPanel: (x, y) => this.panelAt(x, y),
      press: (id, pointer) => this.onPanelPress(id, pointer),
      release: (id, pointer, inside) => this.onPanelRelease(id, pointer, inside),
      cancel: (id, pointerId) => this.panelById(id)?.cancel(pointerId),
    });
    this.router.attach();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutStage, this);
    this.game.events.on(GAME_COMMANDS.releaseAll, this.releaseAll, this);
    this.game.events.on(GAME_COMMANDS.language, this.onLanguage, this);

    // Losing focus must never leave a finger "stuck" on a panel.
    const onVisibility = (): void => {
      if (document.hidden) {
        this.releaseAll();
        this.session.callbacks.onHidden();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onCancel = (): void => this.releaseAll();
    const canvas = this.game.canvas;
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('touchcancel', onCancel);
    window.addEventListener('blur', onCancel);
    this.addCleanup(() => document.removeEventListener('visibilitychange', onVisibility));
    this.addCleanup(() => canvas.removeEventListener('pointercancel', onCancel));
    this.addCleanup(() => canvas.removeEventListener('touchcancel', onCancel));
    this.addCleanup(() => window.removeEventListener('blur', onCancel));

    if (this.session.devDiagnostics) {
      this.diagText = this.add
        .text(8, 8, '', {
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: '15px',
          color: '#fef08a',
          backgroundColor: '#000000aa',
          padding: { x: 6, y: 4 },
        })
        .setDepth(1000);
    }

    // Phaser does not emit SHUTDOWN when the whole game is destroyed, so listen for both.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
  }

  protected layoutStage(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const layout = computeStageLayout(w, h, this.panels.length);
    this.track.setRect(layout.track);
    this.panels.forEach((panel, i) => {
      const rect = layout.panels[i];
      if (rect) panel.setRect(rect);
    });
    this.cameras.main.setSize(w, h);
  }

  protected panelAt(x: number, y: number): string | null {
    const panel = this.panels.find((p) => contains(p.bounds, x, y));
    return panel ? panel.playerId : null;
  }

  protected panelById(id: string): PanelView | undefined {
    return this.panels.find((p) => p.playerId === id);
  }

  protected abstract onPanelPress(playerId: string, pointer: PointerLike): void;
  protected abstract onPanelRelease(playerId: string, pointer: PointerLike, inside: boolean): void;

  /** Native event time (true order of near-simultaneous touches), falling back to "now". */
  protected eventTime(pointer: PointerLike): number {
    const stamp = pointer.event?.timeStamp;
    return typeof stamp === 'number' && Number.isFinite(stamp) ? stamp : this.session.now();
  }

  protected releaseAll(): void {
    this.router?.releaseAll();
    for (const p of this.panels) p.cancelAllPresses();
  }

  private onLanguage(): void {
    this.t = createTranslator(this.session.language);
    for (const p of this.panels) p.setTranslator(this.t);
    this.track.setTranslator(this.t);
  }

  /** Per-frame housekeeping shared by both scenes. */
  protected stageUpdate(): void {
    const now = this.session.now();
    // safety net for a missed pointer-up: drop owned pointers the platform says are no longer down
    if (now - this.lastReconcile > 250) {
      this.lastReconcile = now;
      const pointers = this.input.manager.pointers;
      this.router.reconcile((id) => pointers.find((p) => p.id === id)?.isDown ?? false);
    }
    if (this.diagText) {
      const rows = this.ownership.snapshot().map((o) => `pointer ${o.pointerId} -> ${o.owner}`);
      this.diagText.setText([`DEV pointers: ${rows.length}/10 active slots`, ...rows].join('\n'));
    }
  }

  private teardown(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.router?.detach();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutStage, this);
    this.game.events.off(GAME_COMMANDS.releaseAll, this.releaseAll, this);
    this.game.events.off(GAME_COMMANDS.language, this.onLanguage, this);
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.releaseAll();
    for (const p of this.panels) p.destroy();
    this.panels = [];
    this.track?.destroy();
    this.diagText?.destroy();
    this.diagText = null;
  }
}
