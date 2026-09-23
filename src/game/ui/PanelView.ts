import type * as Phaser from 'phaser';
import type { GeneratedQuestion, SubmittedAnswer } from '../../curriculum/schema';
import type { Translator } from '../../locales';
import type { PlayerStyle } from '../core/players';
import type { PlayerRaceState } from '../core/RaceState';
import { createWidget, hitControl } from '../widgets';
import type { WidgetControl, WidgetModel } from '../widgets';
import type { DrawContext } from './DrawContext';
import { TextPool } from './DrawContext';
import type { Rect } from './geometry';
import { contains, inset } from './geometry';
import type { PanelZones } from './layout';
import { computePanelZones } from './layout';
import { drawSymbol } from './shapes';
import { THEME, hexToNumber, lighten } from './theme';
import { drawVisual } from './VisualRenderer';

/** What a completed tap on a panel asks the scene to do. */
export type PanelAction =
  | { type: 'submit'; answer: SubmittedAnswer }
  | { type: 'simpler' }
  | { type: 'ready' }
  | { type: 'changed' };

export type PanelMode = 'ready' | 'race';

type Feedback = { kind: 'none' | 'correct' | 'tryAgain' | 'hint'; text: string; until: number };

const SIMPLER_ID = 'support:simpler';
const READY_ID = 'ready:confirm';

/**
 * One player's independent panel. It owns that player's widget model (so no input state is shared between
 * players), draws everything the child sees, and turns completed taps into actions. It never contains race
 * rules: those live in RaceEngine.
 */
export class PanelView {
  readonly playerId: string;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly pool: TextPool;
  private readonly ctx: DrawContext;
  private rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private controls: WidgetControl[] = [];
  private extra: WidgetControl[] = [];
  private widget: WidgetModel | null = null;
  private question: GeneratedQuestion | null = null;
  private state: PlayerRaceState | null = null;
  private mode: PanelMode = 'race';
  private readyConfirmed = false;
  private readonly pressed = new Map<number, string>();
  private feedback: Feedback = { kind: 'none', text: '', until: 0 };
  private flashUntil = 0;
  private dirty = true;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    readonly index: number,
    private readonly player: { id: string; name: string },
    private readonly style: PlayerStyle,
    private t: Translator,
    private readonly raceLength: number,
    private reducedMotion: boolean,
    depth = 10,
  ) {
    this.playerId = player.id;
    this.g = scene.add.graphics().setDepth(depth);
    this.pool = new TextPool(scene, depth + 1);
    const g = this.g;
    const pool = this.pool;
    this.ctx = { g, text: (key, value, x, y, st) => pool.text(`${index}:${key}`, value, x, y, st) };
  }

  // ------------------------------------------------------------------------------------ state

  setRect(rect: Rect): void {
    this.rect = rect;
    this.dirty = true;
  }

  get bounds(): Rect {
    return this.rect;
  }

  setMode(mode: PanelMode): void {
    this.mode = mode;
    this.dirty = true;
  }

  setTranslator(t: Translator): void {
    this.t = t;
    this.dirty = true;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  /** Bind the live engine state for this player; the view reads it on every render. */
  bindState(state: PlayerRaceState): void {
    this.state = state;
    this.dirty = true;
  }

  setQuestion(question: GeneratedQuestion | null): void {
    this.question = question;
    this.widget = question ? createWidget(question) : null;
    this.feedback = { kind: 'none', text: '', until: 0 };
    this.pressed.clear();
    this.dirty = true;
  }

  /** The domain service judged the last submission wrong: update the widget quietly. */
  applyWrong(answer: SubmittedAnswer): void {
    this.widget?.onWrong(answer);
    this.dirty = true;
  }

  showCorrect(nowMs: number): void {
    this.feedback = { kind: 'correct', text: this.t('race.correct'), until: nowMs + 900 };
    this.flashUntil = this.reducedMotion ? 0 : nowMs + 650;
    this.dirty = true;
  }

  showTryAgain(nowMs: number): void {
    this.feedback = { kind: 'tryAgain', text: this.t('race.tryAgain'), until: nowMs + 1700 };
    this.dirty = true;
  }

  showHint(hint: string): void {
    this.feedback = { kind: 'hint', text: hint, until: Number.POSITIVE_INFINITY };
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  confirmReady(): void {
    this.readyConfirmed = true;
    this.dirty = true;
  }

  get isReady(): boolean {
    return this.readyConfirmed;
  }

  get pressedCount(): number {
    return this.pressed.size;
  }

  /** Reset transient input (used on pause, visibility change and finish). */
  cancelAllPresses(): void {
    if (this.pressed.size > 0) {
      this.pressed.clear();
      this.dirty = true;
    }
  }

  // ------------------------------------------------------------------------------------ input

  private allControls(): WidgetControl[] {
    return [...this.controls, ...this.extra];
  }

  private locked(): boolean {
    const s = this.state;
    return !s || s.phase !== 'answering' || !this.question;
  }

  /**
   * A pointer went down inside this panel (the router already established ownership).
   * Returns true when the touch landed on a control, which counts as the pupil's first action on the item.
   */
  press(pointerId: number, x: number, y: number): boolean {
    if (this.mode === 'ready') {
      const onButton = !this.readyConfirmed && contains(this.readyButton(), x, y);
      if (onButton) this.pressed.set(pointerId, READY_ID);
      this.dirty = true;
      return onButton;
    }
    if (this.locked()) return false;
    const hit = hitControl(this.allControls(), x, y);
    if (!hit) return false;
    this.pressed.set(pointerId, hit.id);
    this.dirty = true;
    return true;
  }

  /**
   * A pointer owned by this panel was released. A tap completes only if it was released inside this
   * panel, on the same control it started on.
   */
  release(pointerId: number, x: number, y: number, inside: boolean): PanelAction | null {
    const startedOn = this.pressed.get(pointerId);
    this.pressed.delete(pointerId);
    this.dirty = true;
    if (!startedOn || !inside) return null;

    if (this.mode === 'ready') {
      if (startedOn === READY_ID && contains(this.readyButton(), x, y) && !this.readyConfirmed) {
        this.readyConfirmed = true;
        return { type: 'ready' };
      }
      return null;
    }
    if (this.locked()) return null;
    const hit = hitControl(this.allControls(), x, y);
    if (!hit || hit.id !== startedOn) return null;
    if (hit.id === SIMPLER_ID) return { type: 'simpler' };
    const effect = this.widget?.activate(hit.id);
    if (!effect || effect.type === 'none') return null;
    return effect.type === 'submit'
      ? { type: 'submit', answer: effect.answer }
      : { type: 'changed' };
  }

  cancel(pointerId: number): void {
    if (this.pressed.delete(pointerId)) this.dirty = true;
  }

  // ------------------------------------------------------------------------------------ render

  update(nowMs: number): void {
    if (this.feedback.kind !== 'none' && nowMs >= this.feedback.until) {
      this.feedback = { kind: 'none', text: '', until: 0 };
      this.dirty = true;
    }
    if (this.flashUntil > 0) {
      this.dirty = true;
      if (nowMs >= this.flashUntil) this.flashUntil = 0;
    }
  }

  private readyButton(): Rect {
    const r = this.rect;
    return { x: r.x + r.w * 0.08, y: r.y + r.h * 0.68, w: r.w * 0.84, h: r.h * 0.24 };
  }

  render(nowMs: number): void {
    if (!this.dirty || this.destroyed) return;
    this.dirty = false;
    const { g } = this;
    g.clear();
    this.pool.begin();
    if (this.mode === 'ready') this.renderReady();
    else this.renderRace(nowMs);
    this.pool.end();
  }

  private drawFrame(): void {
    const { g, rect, style } = this;
    const radius = Math.min(rect.w, rect.h) * 0.035;
    g.fillStyle(lighten(style.color, 0.9), 1);
    g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, radius);
    g.lineStyle(Math.max(3, rect.w * 0.012), hexToNumber(style.color), 1);
    g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, radius);
  }

  private drawHeader(header: Rect, showCount: boolean): void {
    const { g, style } = this;
    const radius = header.h * 0.25;
    g.fillStyle(hexToNumber(style.color), 1);
    g.fillRoundedRect(header.x, header.y, header.w, header.h, radius);
    const iconR = header.h * 0.34;
    const icx = header.x + header.h * 0.55;
    const icy = header.y + header.h / 2;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(icx, icy, iconR * 1.25);
    drawSymbol(g, style.symbol, icx, icy, iconR, style.color);
    const counterW = showCount ? header.w * 0.22 : 0;
    this.ctx.text('name', this.player.name, header.x + header.h * 1.2, icy, {
      size: header.h * 0.52,
      color: THEME.white,
      bold: true,
      ax: 0,
      align: 'left',
      maxWidth: header.w - header.h * 1.3 - counterW,
      minSize: 10,
    });
    if (showCount && this.state) {
      this.ctx.text(
        'count',
        this.t('race.step', { n: this.state.progress, total: this.raceLength }),
        header.x + header.w - header.h * 0.3,
        icy,
        {
          size: header.h * 0.44,
          color: THEME.white,
          bold: true,
          ax: 1,
        },
      );
    }
  }

  private renderReady(): void {
    const { g, rect, style } = this;
    this.drawFrame();
    const headerH = Math.min(rect.h * 0.12, 74);
    this.drawHeader(
      { x: rect.x + rect.w * 0.03, y: rect.y + rect.w * 0.03, w: rect.w * 0.94, h: headerH },
      false,
    );
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h * 0.36;
    const r = Math.min(rect.w * 0.2, rect.h * 0.12);
    g.fillStyle(hexToNumber(style.color), 1);
    g.fillCircle(cx, cy, r * 1.3);
    drawSymbol(g, style.symbol, cx, cy, r, '#ffffff');
    this.ctx.text('stand', this.t('ready.standHere'), cx, rect.y + rect.h * 0.585, {
      size: rect.h * 0.04,
      color: THEME.muted,
      bold: true,
      maxWidth: rect.w * 0.9,
      minSize: 10,
    });
    const btn = this.readyButton();
    const pressed = [...this.pressed.values()].includes(READY_ID);
    const confirmed = this.readyConfirmed;
    g.fillStyle(confirmed ? THEME.good : pressed ? darkenColor(THEME.action) : THEME.action, 1);
    g.fillRoundedRect(btn.x, btn.y, btn.w, btn.h, btn.h * 0.22);
    this.ctx.text(
      'readybtn',
      confirmed ? `✓ ${this.t('ready.confirmed')}` : this.t('ready.touch'),
      btn.x + btn.w / 2,
      btn.y + btn.h / 2,
      {
        size: btn.h * 0.36,
        color: THEME.white,
        bold: true,
        maxWidth: btn.w * 0.9,
        maxHeight: btn.h * 0.86,
        minSize: 10,
      },
    );
  }

  private renderRace(nowMs: number): void {
    const { g, rect } = this;
    const q = this.question;
    const widget = this.widget;
    const s = this.state;

    this.drawFrame();
    if (this.flashUntil > nowMs) {
      g.lineStyle(Math.max(6, rect.w * 0.03), THEME.good, 0.9);
      g.strokeRoundedRect(
        rect.x + 2,
        rect.y + 2,
        rect.w - 4,
        rect.h - 4,
        Math.min(rect.w, rect.h) * 0.035,
      );
    }

    const hasPromptVisual = q?.prompt.visual !== undefined;
    const zones = computePanelZones(rect, {
      hasVisual: hasPromptVisual,
      showAnswerField: widget?.showAnswerField ?? true,
    });
    this.drawHeader(zones.header, true);

    if (!q || !widget || !s) {
      this.controls = [];
      this.extra = [];
      return;
    }

    const locked = s.phase !== 'answering';
    this.drawPrompt(q, zones.prompt, s);
    if (widget.showAnswerField)
      this.drawAnswerField(zones.answer, widget.responseText(), q.prompt.unit);
    this.controls = widget.layout(zones.widget);
    this.drawControls(this.controls, locked);
    this.drawFeedbackZone(zones.feedback, s, locked);
    this.drawProgress(zones.progress, s.progress);
    if (s.phase === 'done') this.drawDoneOverlay(zones);
  }

  private drawPrompt(q: GeneratedQuestion, area: Rect, s: PlayerRaceState): void {
    const support =
      s.visualRevealed && q.supportVisual !== undefined && q.prompt.visual === undefined;
    let main = area;
    if (support && q.supportVisual) {
      const leftW = area.w * 0.54;
      main = { x: area.x, y: area.y, w: leftW, h: area.h };
      const visualArea: Rect = {
        x: area.x + leftW + area.w * 0.02,
        y: area.y,
        w: area.w - leftW - area.w * 0.02,
        h: area.h,
      };
      this.g.fillStyle(0xffffff, 1);
      this.g.fillRoundedRect(
        visualArea.x,
        visualArea.y,
        visualArea.w,
        visualArea.h,
        visualArea.h * 0.1,
      );
      drawVisual(this.ctx, q.supportVisual, inset(visualArea, visualArea.h * 0.06), 'sv');
    }
    const { expression, text, visual } = q.prompt;
    const hasText = text.trim().length > 0;
    const hasExpr = expression !== undefined && expression.trim().length > 0;
    let textH: number;
    let exprH = 0;
    let visualH = 0;
    if (visual && hasExpr) {
      textH = 0.24;
      exprH = 0.28;
      visualH = 0.48;
    } else if (visual) {
      textH = hasText ? 0.26 : 0;
      visualH = 1 - textH;
    } else if (hasExpr) {
      textH = hasText ? 0.34 : 0;
      exprH = 1 - textH;
    } else {
      textH = 1;
    }
    let y = main.y;
    if (hasText && textH > 0) {
      const h = main.h * textH;
      this.ctx.text('ptext', text, main.x + main.w / 2, y + h / 2, {
        size: Math.max(12, Math.min(h * 0.62, main.w * 0.075)),
        color: THEME.muted,
        bold: true,
        maxWidth: main.w * 0.97,
        maxHeight: h,
        minSize: 9,
      });
      y += h;
    }
    if (hasExpr && exprH > 0 && expression !== undefined) {
      const h = main.h * exprH;
      this.ctx.text('pexpr', expression, main.x + main.w / 2, y + h / 2, {
        size: Math.max(16, Math.min(h * 0.72, main.w * 0.15)),
        color: THEME.ink,
        bold: true,
        maxWidth: main.w * 0.97,
        maxHeight: h,
        minSize: 12,
      });
      y += h;
    }
    if (visual && visualH > 0) {
      drawVisual(this.ctx, visual, { x: main.x, y, w: main.w, h: main.h * visualH }, 'pv');
    }
  }

  private drawAnswerField(area: Rect, value: string, unit: string | undefined): void {
    const { g, style } = this;
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(area.x, area.y, area.w, area.h, area.h * 0.22);
    g.lineStyle(Math.max(2, area.h * 0.05), hexToNumber(style.color), 1);
    g.strokeRoundedRect(area.x, area.y, area.w, area.h, area.h * 0.22);
    const unitW = unit ? area.w * 0.24 : 0;
    this.ctx.text(
      'answer',
      value === '' ? '?' : value,
      area.x + (area.w - unitW) / 2,
      area.y + area.h / 2,
      {
        size: area.h * 0.66,
        color: value === '' ? '#94a3b8' : THEME.ink,
        bold: true,
        maxWidth: area.w - unitW - area.h * 0.3,
        minSize: 12,
      },
    );
    if (unit) {
      this.ctx.text('unit', unit, area.x + area.w - area.h * 0.25, area.y + area.h / 2, {
        size: area.h * 0.42,
        color: THEME.muted,
        bold: true,
        ax: 1,
        maxWidth: unitW,
        minSize: 9,
      });
    }
  }

  private drawControls(controls: readonly WidgetControl[], locked: boolean): void {
    const { g, style } = this;
    const pressedIds = new Set(this.pressed.values());
    for (const c of controls) {
      const r = c.rect;
      const radius = Math.min(r.w, r.h) * 0.18;
      const isPressed = pressedIds.has(c.id) && !locked;
      const dim = locked || c.state === 'disabled';
      const alpha = dim ? THEME.disabledAlpha : c.state === 'wrong' ? 0.55 : 1;
      let fill: number;
      let textColor: string = THEME.ink;
      if (c.kind === 'submit') {
        fill = isPressed ? darkenColor(THEME.action) : THEME.action;
        textColor = THEME.white;
      } else if (c.kind === 'clear' || c.kind === 'back') {
        fill = isPressed ? darkenColor(THEME.clear) : THEME.clear;
        textColor = THEME.white;
      } else if (c.state === 'selected') {
        fill = lighten(style.color, 0.82);
      } else if (c.state === 'wrong') {
        fill = 0xe2e8f0;
      } else {
        fill = isPressed ? THEME.keyPressed : c.kind === 'digit' ? THEME.key : 0xffffff;
      }
      const pressInset = isPressed ? Math.max(1, r.h * 0.03) : 0;
      const rr: Rect = {
        x: r.x + pressInset,
        y: r.y + pressInset,
        w: r.w - pressInset * 2,
        h: r.h - pressInset * 2,
      };
      g.fillStyle(fill, alpha);
      g.fillRoundedRect(rr.x, rr.y, rr.w, rr.h, radius);
      const border = c.state === 'selected' ? hexToNumber(style.color) : THEME.keyBorder;
      g.lineStyle(
        c.state === 'selected' ? Math.max(3, r.h * 0.05) : Math.max(1.5, r.h * 0.025),
        border,
        alpha,
      );
      g.strokeRoundedRect(rr.x, rr.y, rr.w, rr.h, radius);

      const label = c.kind === 'submit' ? this.t('race.submit') : (c.label ?? '');
      const key = `c:${c.id}`;
      const hasVisual = c.visual !== undefined;
      const contentRect = pressInset > 0 ? rr : r;
      if (hasVisual && c.visual) {
        const vis: Rect = label
          ? {
              x: contentRect.x + r.w * 0.05,
              y: contentRect.y + r.h * 0.06,
              w: contentRect.w - r.w * 0.1,
              h: contentRect.h * 0.64,
            }
          : {
              x: contentRect.x + r.w * 0.05,
              y: contentRect.y + r.h * 0.06,
              w: contentRect.w - r.w * 0.1,
              h: contentRect.h - r.h * 0.12,
            };
        drawVisual(this.ctx, c.visual, vis, `cv:${c.id}`);
        if (label) {
          this.ctx.text(
            key,
            label,
            contentRect.x + contentRect.w / 2,
            contentRect.y + contentRect.h * 0.85,
            {
              size: r.h * 0.2,
              color: textColor,
              bold: true,
              maxWidth: r.w * 0.92,
              maxHeight: r.h * 0.26,
              minSize: 9,
              alpha,
            },
          );
        }
      } else if (label) {
        const digit = c.kind === 'digit';
        this.ctx.text(
          key,
          label,
          contentRect.x + contentRect.w / 2,
          contentRect.y + contentRect.h / 2,
          {
            size: digit ? r.h * 0.52 : Math.min(r.h * 0.5, r.w * 0.34),
            color: textColor,
            bold: true,
            maxWidth: r.w * 0.9,
            maxHeight: r.h * 0.86,
            minSize: 10,
            alpha,
          },
        );
      }
      if (c.badge !== undefined) {
        const br = Math.min(Math.min(r.w, r.h) * 0.2, 22);
        const bx = r.x + r.w - br * 0.9;
        const by = r.y + br * 0.9;
        g.fillStyle(hexToNumber(style.color), 1);
        g.fillCircle(bx, by, br);
        this.ctx.text(`b:${c.id}`, c.badge, bx, by, {
          size: br * 1.15,
          color: THEME.white,
          bold: true,
        });
      }
    }
  }

  private drawFeedbackZone(area: Rect, s: PlayerRaceState, locked: boolean): void {
    const { g } = this;
    this.extra = [];
    const fb = this.feedback;
    const offerSimpler = s.simplerOffered && !locked;
    const buttonW = offerSimpler ? area.w * 0.42 : 0;
    const textArea: Rect = {
      x: area.x,
      y: area.y,
      w: area.w - buttonW - (offerSimpler ? area.w * 0.02 : 0),
      h: area.h,
    };
    if (fb.kind !== 'none') {
      const good = fb.kind === 'correct';
      g.fillStyle(good ? THEME.goodTint : THEME.soft, 1);
      g.fillRoundedRect(textArea.x, textArea.y, textArea.w, textArea.h, textArea.h * 0.25);
      g.lineStyle(Math.max(1.5, area.h * 0.04), good ? THEME.good : THEME.softBorder, 1);
      g.strokeRoundedRect(textArea.x, textArea.y, textArea.w, textArea.h, textArea.h * 0.25);
      const prefix = fb.kind === 'hint' ? `${this.t('race.hint')}: ` : '';
      this.ctx.text(
        'fb',
        `${prefix}${fb.text}`,
        textArea.x + textArea.w / 2,
        textArea.y + textArea.h / 2,
        {
          size: area.h * 0.42,
          color: good ? '#14532d' : '#7c2d12',
          bold: true,
          maxWidth: textArea.w * 0.94,
          maxHeight: textArea.h * 0.9,
          minSize: 8,
        },
      );
    }
    if (offerSimpler) {
      const rect: Rect = { x: area.x + area.w - buttonW, y: area.y, w: buttonW, h: area.h };
      const pressed = [...this.pressed.values()].includes(SIMPLER_ID);
      g.fillStyle(pressed ? 0xfcd34d : 0xfde68a, 1);
      g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, rect.h * 0.25);
      g.lineStyle(Math.max(2, rect.h * 0.05), THEME.softBorder, 1);
      g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, rect.h * 0.25);
      this.ctx.text('simpler', this.t('race.simpler'), rect.x + rect.w / 2, rect.y + rect.h / 2, {
        size: rect.h * 0.4,
        color: '#7c2d12',
        bold: true,
        maxWidth: rect.w * 0.92,
        maxHeight: rect.h * 0.9,
        minSize: 8,
      });
      this.extra.push({ id: SIMPLER_ID, kind: 'tile', rect, state: 'normal', tone: 'secondary' });
    }
  }

  private drawProgress(area: Rect, progress: number): void {
    const { g, style } = this;
    const n = this.raceLength;
    const slot = area.w / n;
    const r = Math.min(area.h * 0.46, slot * 0.34);
    for (let i = 0; i < n; i++) {
      const cx = area.x + slot * i + slot / 2;
      const cy = area.y + area.h / 2;
      if (i < progress) {
        g.fillStyle(hexToNumber(style.color), 1);
        g.fillCircle(cx, cy, r);
      } else {
        g.lineStyle(Math.max(1.5, r * 0.3), hexToNumber(style.color), 0.6);
        g.strokeCircle(cx, cy, r);
      }
    }
  }

  private drawDoneOverlay(zones: PanelZones): void {
    const { g } = this;
    const area: Rect = {
      x: zones.prompt.x,
      y: zones.prompt.y,
      w: zones.prompt.w,
      h: zones.widget.y + zones.widget.h - zones.prompt.y,
    };
    g.fillStyle(0xffffff, 0.88);
    g.fillRoundedRect(area.x, area.y, area.w, area.h, area.h * 0.05);
    this.ctx.text('done', `✓ ${this.t('race.done')}`, area.x + area.w / 2, area.y + area.h / 2, {
      size: Math.min(area.h * 0.22, area.w * 0.22),
      color: '#14532d',
      bold: true,
      maxWidth: area.w * 0.9,
      minSize: 12,
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.pool.destroy();
    this.g.destroy();
  }
}

function darkenColor(color: number): number {
  const r = ((color >> 16) & 255) * 0.82;
  const g = ((color >> 8) & 255) * 0.82;
  const b = (color & 255) * 0.82;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
