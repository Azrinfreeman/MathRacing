import type { PointerLike } from '../PointerRouter';
import { GAME_COMMANDS } from '../session';
import { StageScene } from './StageScene';

const COUNTDOWN_STEP_MS = 800;

/**
 * Ready screen: each pupil sees their colour, symbol and name over their own panel and touches it to
 * confirm. That doubles as a quick multi-touch check before the race. When everyone is ready (or the
 * teacher skips), a 3-2-1 countdown runs and the race starts.
 */
export class ReadyScene extends StageScene {
  private countdownStart: number | null = null;
  private lastStep = -1;
  private launched = false;

  constructor() {
    super('ReadyScene');
  }

  create(): void {
    this.countdownStart = null;
    this.lastStep = -1;
    this.launched = false;
    this.buildStage('ready');
    this.game.events.on(GAME_COMMANDS.skipReady, this.startCountdown, this);
    this.addCleanup(() => this.game.events.off(GAME_COMMANDS.skipReady, this.startCountdown, this));
  }

  protected onPanelPress(playerId: string, pointer: PointerLike): void {
    this.session.sound.unlock();
    this.panelById(playerId)?.press(pointer.id, pointer.x, pointer.y);
  }

  protected onPanelRelease(playerId: string, pointer: PointerLike, inside: boolean): void {
    const panel = this.panelById(playerId);
    const action = panel?.release(pointer.id, pointer.x, pointer.y, inside);
    if (action?.type === 'ready') {
      this.session.sound.play('ready');
      if (this.panels.every((p) => p.isReady)) this.startCountdown();
    }
  }

  private startCountdown(): void {
    if (this.countdownStart !== null || this.launched) return;
    this.countdownStart = this.session.now();
    this.releaseAll();
  }

  override update(_time: number, delta: number): void {
    this.guardedFrame(() => this.frame(delta));
  }

  private frame(delta: number): void {
    this.stageUpdate();
    const now = this.session.now();
    if (this.countdownStart !== null && !this.launched) {
      const step = Math.floor((now - this.countdownStart) / COUNTDOWN_STEP_MS);
      const labels = ['3', '2', '1', this.t('ready.go')];
      if (step !== this.lastStep && step < labels.length) {
        this.lastStep = step;
        this.track.showCountdown(labels[step] ?? null);
        this.session.sound.play(step === labels.length - 1 ? 'go' : 'tick');
      }
      if (step >= labels.length) {
        this.launched = true;
        this.track.showCountdown(null);
        this.session.engine.start(now);
        this.session.callbacks.onRaceStarted();
        this.scene.start('RaceScene');
        return;
      }
    }
    for (const panel of this.panels) {
      panel.update(now);
      panel.render(now);
    }
    this.track.update(delta);
  }
}
