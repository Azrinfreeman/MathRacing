import type { GeneratedQuestion, QuestionOption, SubmittedAnswer } from '../../curriculum/schema';
import type { Rect } from '../ui/geometry';
import { flowCells, gridCells } from '../ui/geometry';
import type { WidgetControl, WidgetEffect, WidgetModel } from './types';

const MAX_TAPS = 40;

/**
 * Construct an amount from large parts (place-value blocks, coins, notes). Each tap on a part adds one of
 * it; Undo removes the last one and C clears. The submitted value is the running total, so any valid
 * combination is accepted (RM6 may be six RM1 notes or RM5 + RM1).
 */
export class BuildValueWidget implements WidgetModel {
  readonly kind = 'build-value' as const;
  readonly showAnswerField = true;
  private readonly options: readonly QuestionOption[];
  private readonly totalUnit: 'sen' | 'rm' | 'plain';
  private history: string[] = [];

  constructor(question: GeneratedQuestion) {
    this.options = question.options ?? [];
    this.totalUnit = question.widgetConfig?.totalUnit ?? 'plain';
  }

  private total(): number {
    return this.history.reduce(
      (sum, id) => sum + (this.options.find((o) => o.id === id)?.value ?? 0),
      0,
    );
  }

  layout(area: Rect): WidgetControl[] {
    const gap = Math.max(6, Math.min(area.w, area.h) * 0.035);
    const actionH = Math.max(40, area.h * 0.22);
    const partsArea: Rect = { x: area.x, y: area.y, w: area.w, h: area.h - actionH - gap };
    const columns = this.options.length <= 3 ? this.options.length : 3;
    const cells = flowCells(partsArea, this.options.length, columns, gap);
    const controls = this.options.map((o, i): WidgetControl => {
      const count = this.history.filter((id) => id === o.id).length;
      const control: WidgetControl = {
        id: o.id,
        kind: 'part',
        rect: cells[i] as Rect,
        state: count > 0 ? 'selected' : 'normal',
        tone: 'neutral',
      };
      if (o.label !== undefined) control.label = o.label;
      if (o.visual !== undefined) control.visual = o.visual;
      if (count > 0) control.badge = String(count);
      return control;
    });
    const actionRow: Rect = { x: area.x, y: area.y + area.h - actionH, w: area.w, h: actionH };
    const [clear, back, go] = gridCells(actionRow, 3, 1, gap) as [Rect, Rect, Rect];
    const empty = this.history.length === 0;
    controls.push(
      {
        id: 'clear',
        kind: 'clear',
        rect: clear,
        state: empty ? 'disabled' : 'normal',
        tone: 'secondary',
        label: 'C',
      },
      {
        id: 'back',
        kind: 'back',
        rect: back,
        state: empty ? 'disabled' : 'normal',
        tone: 'secondary',
        label: '⌫',
      },
      {
        id: 'submit',
        kind: 'submit',
        rect: go,
        state: empty ? 'disabled' : 'normal',
        tone: 'accent',
        label: 'Go',
      },
    );
    return controls;
  }

  activate(controlId: string): WidgetEffect {
    if (controlId === 'clear') {
      if (this.history.length === 0) return { type: 'none' };
      this.history = [];
      return { type: 'changed' };
    }
    if (controlId === 'back') {
      if (this.history.length === 0) return { type: 'none' };
      this.history = this.history.slice(0, -1);
      return { type: 'changed' };
    }
    if (controlId === 'submit') {
      if (this.history.length === 0) return { type: 'none' };
      return { type: 'submit', answer: { kind: 'number', raw: String(this.total()) } };
    }
    if (!this.options.some((o) => o.id === controlId) || this.history.length >= MAX_TAPS)
      return { type: 'none' };
    this.history = [...this.history, controlId];
    return { type: 'changed' };
  }

  responseText(): string {
    if (this.history.length === 0) return '';
    const total = this.total();
    if (this.totalUnit === 'sen') return `${total} sen`;
    if (this.totalUnit === 'rm') return `RM${total}`;
    return String(total);
  }

  onWrong(_answer: SubmittedAnswer): void {
    this.history = [];
  }

  isEmpty(): boolean {
    return this.history.length === 0;
  }

  reset(): void {
    this.history = [];
  }
}
