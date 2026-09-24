import type { RaceEvent } from '../core/RaceState';
import type { PointerLike } from '../PointerRouter';
import { StageScene } from './StageScene';

const CELEBRATION_MS = 2600;
const CELEBRATION_REDUCED_MS = 1500;

/**
 * The live race. It renders engine state and turns completed taps into engine intents; it holds no race
 * rules of its own. Pointer ownership guarantees one child's touch can never change another child's panel.
 */
export class RaceScene extends StageScene {
  private unsubscribe: (() => void) | null = null;
  private celebrationPending = false;
  private celebrationEndsAt: number | null = null;
  private doneSignalled = false;

  constructor() {
    super('RaceScene');
  }

  create(): void {
    this.celebrationPending = false;
    this.celebrationEndsAt = null;
    this.doneSignalled = false;
    this.buildStage('race');
    const { engine } = this.session;

    for (const p of engine.players) {
      const panel = this.panelById(p.id);
      panel?.bindState(p);
      panel?.setQuestion(p.question);
      this.track.setProgress(p.id, p.distance, true);
    }
    this.track.update(0);
    this.unsubscribe = engine.on((e) => this.onEngineEvent(e));
    this.addCleanup(() => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });
  }

  private onEngineEvent(event: RaceEvent): void {
    const now = this.session.now();
    switch (event.type) {
      case 'question': {
        this.panelById(event.playerId)?.setQuestion(event.question);
        break;
      }
      case 'progress': {
        // Cruise cars are placed every frame from their exact distance; steps move on this event.
        if (this.session.engine.movement === 'steps')
          this.track.setProgress(event.playerId, event.progress);
        this.panelById(event.playerId)?.markDirty();
        break;
      }
      case 'boost':
      case 'slowed': {
        this.track.flash(event.playerId);
        break;
      }
      case 'crawling': {
        this.panelById(event.playerId)?.showIdle();
        break;
      }
      case 'setback': {
        // The car rolls backward; the panel's step counter and pips follow the new position.
        this.track.setProgress(event.playerId, event.progress);
        this.panelById(event.playerId)?.markDirty();
        break;
      }
      case 'hint': {
        this.panelById(event.playerId)?.showHint(event.hint);
        break;
      }
      case 'support': {
        this.panelById(event.playerId)?.markDirty();
        break;
      }
      case 'player-done': {
        this.panelById(event.playerId)?.markDirty();
        break;
      }
      case 'paused':
      case 'resumed': {
        this.releaseAll();
        for (const p of this.panels) p.markDirty();
        break;
      }
      case 'finished': {
        this.releaseAll();
        this.celebrationPending = true;
        this.celebrationEndsAt =
          now + (this.session.reducedMotion ? CELEBRATION_REDUCED_MS : CELEBRATION_MS);
        break;
      }
      default:
        break;
    }
  }

  protected onPanelPress(playerId: string, pointer: PointerLike): void {
    const hit = this.panelById(playerId)?.press(pointer.id, pointer.x, pointer.y);
    if (hit) this.session.engine.noteAction(playerId, this.eventTime(pointer));
  }

  protected onPanelRelease(playerId: string, pointer: PointerLike, inside: boolean): void {
    const panel = this.panelById(playerId);
    if (!panel) return;
    const action = panel.release(pointer.id, pointer.x, pointer.y, inside);
    if (!action) return;
    const { engine, sound } = this.session;
    const at = this.eventTime(pointer);
    if (action.type === 'submit') {
      const result = engine.submit(playerId, action.answer, at);
      const now = this.session.now();
      if (result.status === 'correct') {
        panel.showCorrect(now, engine.movement === 'cruise');
        sound.play('correct');
      } else if (result.status === 'incorrect') {
        panel.applyWrong(action.answer);
        if (result.setback) {
          panel.showSetback(now);
          sound.play('setback');
        } else if (result.slowed) {
          panel.showSlowed(now);
          sound.play('gentle');
        } else {
          panel.showTryAgain(now);
          sound.play('gentle');
        }
      }
    } else if (action.type === 'simpler') {
      engine.requestSimpler(playerId, this.session.now());
    }
  }

  override update(_time: number, delta: number): void {
    this.guardedFrame(() => this.frame(delta));
  }

  private frame(delta: number): void {
    this.stageUpdate();
    const { engine } = this.session;
    const now = this.session.now();
    const phase = engine.phase;
    if (phase === 'RACING') engine.tick(now);
    if (engine.movement === 'cruise') {
      for (const p of engine.players)
        this.track.setDistance(p.id, p.distance, engine.speedState(p.id));
    }

    if (this.celebrationPending) {
      this.celebrationPending = false;
      const result = engine.result();
      const winner = engine.players.find((p) => p.id === result.winnerId);
      if (winner) {
        this.track.celebrate(winner.id, this.t('race.winner', { name: winner.name }));
        this.session.sound.play('win');
      } else if (result.endedEarly) {
        this.track.celebrate(null, this.t('results.noWinner'));
      } else {
        this.track.celebrate(null, this.t('race.practiceDone'));
        this.session.sound.play('win');
      }
    }
    if (this.celebrationEndsAt !== null && !this.doneSignalled && now >= this.celebrationEndsAt) {
      this.doneSignalled = true;
      this.session.callbacks.onCelebrationDone();
    }

    for (const panel of this.panels) {
      panel.update(now);
      panel.render(now);
    }
    this.track.update(phase === 'PAUSED' ? 0 : delta);
  }
}
