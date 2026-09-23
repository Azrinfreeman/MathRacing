import type { Translator } from '../locales';
import { clear, h } from './dom';

export type StagePhase = 'ready' | 'racing' | 'paused';

export type StageHandlers = {
  onPause(): void;
  onResume(): void;
  onSkipReady(): void;
  onCancel(): void;
  onEnd(): void;
  onExit(): void;
  onHelp(): void;
};

const HOLD_MS = 600;

/**
 * DOM layer over the Phaser canvas: the teacher's controls and the pause dialog. They are ordinary buttons so
 * they are keyboard accessible; pausing needs a press-and-hold (or the keyboard) so a child cannot trigger it
 * by a stray touch.
 */
export class StageChrome {
  readonly host: HTMLElement;
  private readonly toolbar: HTMLElement;
  private readonly overlay: HTMLElement;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private phase: StagePhase = 'ready';
  private unlock: (() => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    private t: Translator,
    private readonly handlers: StageHandlers,
  ) {
    this.host = h('div', { class: 'game-host', id: 'game-host', dataset: { testid: 'game-host' } });
    this.toolbar = h('div', { class: 'stage-toolbar', dataset: { testid: 'stage-toolbar' } });
    this.overlay = h('div', {
      class: 'pause-overlay',
      role: 'dialog',
      aria: { modal: true, labelledby: 'pause-title' },
      hidden: true,
      dataset: { testid: 'pause-overlay' },
    });
    clear(root);
    root.appendChild(
      h(
        'div',
        { class: 'stage', dataset: { testid: 'stage' } },
        this.host,
        this.toolbar,
        this.overlay,
      ),
    );
    this.renderToolbar();
    this.lockSurface();
  }

  /**
   * The game surface must never scroll, zoom, select text or open a context menu: a child's stray two-finger
   * gesture must not disturb the race. Teacher screens elsewhere stay fully keyboard accessible.
   */
  private lockSurface(): void {
    const stage = this.root.querySelector<HTMLElement>('.stage');
    if (!stage) return;
    const block = (e: Event): void => e.preventDefault();
    const wheel = (e: WheelEvent): void => e.preventDefault();
    stage.addEventListener('contextmenu', block);
    stage.addEventListener('gesturestart', block);
    stage.addEventListener('gesturechange', block);
    stage.addEventListener('dragstart', block);
    stage.addEventListener('selectstart', block);
    stage.addEventListener('wheel', wheel, { passive: false });
    this.unlock = () => {
      for (const type of [
        'contextmenu',
        'gesturestart',
        'gesturechange',
        'dragstart',
        'selectstart',
      ])
        stage.removeEventListener(type, block);
      stage.removeEventListener('wheel', wheel);
    };
  }

  setTranslator(t: Translator): void {
    this.t = t;
    this.renderToolbar();
  }

  setPhase(phase: StagePhase): void {
    this.phase = phase;
    this.renderToolbar();
    if (phase === 'paused') this.showOverlay();
    else this.hideOverlay();
  }

  private clearHold(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.toolbar.querySelector('.hold-btn')?.classList.remove('holding');
  }

  private renderToolbar(): void {
    const t = this.t;
    clear(this.toolbar);
    if (this.phase === 'ready') {
      this.toolbar.appendChild(
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          dataset: { testid: 'skip-ready' },
          text: t('ready.skip'),
          on: { click: () => this.handlers.onSkipReady() },
        }),
      );
      this.toolbar.appendChild(
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          dataset: { testid: 'cancel-ready' },
          text: t('pause.exit'),
          on: { click: () => this.handlers.onCancel() },
        }),
      );
      return;
    }
    if (this.phase === 'racing') {
      const holdBtn = h(
        'button',
        {
          type: 'button',
          class: 'btn btn-small hold-btn',
          title: t('race.holdToPause'),
          aria: { label: `${t('race.pause')}. ${t('race.holdToPause')}` },
          dataset: { testid: 'pause' },
          on: {
            pointerdown: (e) => {
              if (e.button !== 0 && e.pointerType === 'mouse') return;
              this.clearHold();
              holdBtn.classList.add('holding');
              this.holdTimer = setTimeout(() => {
                this.holdTimer = null;
                holdBtn.classList.remove('holding');
                this.handlers.onPause();
              }, HOLD_MS);
            },
            pointerup: () => this.clearHold(),
            pointerleave: () => this.clearHold(),
            pointercancel: () => this.clearHold(),
            click: (e) => {
              // A keyboard activation (Enter/Space) has detail === 0 and pauses immediately for the teacher.
              if (e.detail === 0) this.handlers.onPause();
            },
          },
        },
        h('span', { class: 'hold-fill', aria: { hidden: true } }),
        h('span', { class: 'hold-label', text: `⏸ ${t('race.pause')}` }),
      );
      this.toolbar.appendChild(holdBtn);
    }
  }

  private showOverlay(): void {
    const t = this.t;
    clear(this.overlay);
    this.overlay.hidden = false;
    this.overlay.appendChild(
      h(
        'div',
        { class: 'pause-card' },
        h('h2', { id: 'pause-title', text: t('pause.title') }),
        h('p', { text: t('pause.help') }),
        h(
          'div',
          { class: 'pause-actions' },
          h('button', {
            type: 'button',
            class: 'btn btn-primary btn-large',
            dataset: { testid: 'resume' },
            text: `▶ ${t('pause.resume')}`,
            on: { click: () => this.handlers.onResume() },
          }),
          h('button', {
            type: 'button',
            class: 'btn btn-large',
            dataset: { testid: 'end-race' },
            text: t('pause.end'),
            on: { click: () => this.handlers.onEnd() },
          }),
          h('button', {
            type: 'button',
            class: 'btn btn-large',
            dataset: { testid: 'pause-help' },
            text: t('setup.help'),
            on: { click: () => this.handlers.onHelp() },
          }),
          h('button', {
            type: 'button',
            class: 'btn btn-large',
            dataset: { testid: 'exit-setup' },
            text: t('pause.exit'),
            on: { click: () => this.handlers.onExit() },
          }),
        ),
      ),
    );
    this.overlay.querySelector<HTMLElement>('[data-testid="resume"]')?.focus();
  }

  private hideOverlay(): void {
    this.overlay.hidden = true;
    clear(this.overlay);
  }

  destroy(): void {
    this.clearHold();
    this.unlock?.();
    this.unlock = null;
    clear(this.root);
  }
}
