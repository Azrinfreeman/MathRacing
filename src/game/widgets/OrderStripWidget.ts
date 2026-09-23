import type { GeneratedQuestion, QuestionOption, SubmittedAnswer } from '../../curriculum/schema';
import type { Rect } from '../ui/geometry';
import { flowCells } from '../ui/geometry';
import { tileColumns } from './ChoiceTilesWidget';
import type { WidgetControl, WidgetEffect, WidgetModel } from './types';

const SUBMIT_ID = 'submit';

/**
 * Tap cards in the order they belong: each tapped card gets the next number badge. Tapping a numbered card
 * takes its number back (later numbers shift down). Go is enabled once every card is numbered. This is the
 * tap-based accessibility path; it needs no dragging.
 */
export class OrderStripWidget implements WidgetModel {
  readonly kind = 'order-strip' as const;
  readonly showAnswerField = false;
  private readonly options: readonly QuestionOption[];
  private order: string[] = [];

  constructor(question: GeneratedQuestion) {
    this.options = question.options ?? [];
  }

  layout(area: Rect): WidgetControl[] {
    const gap = Math.max(6, Math.min(area.w, area.h) * 0.04);
    const submitH = Math.max(40, area.h * 0.2);
    const cardsArea: Rect = { x: area.x, y: area.y, w: area.w, h: area.h - submitH - gap };
    const cells = flowCells(cardsArea, this.options.length, tileColumns(this.options.length), gap);
    const controls = this.options.map((o, i): WidgetControl => {
      const position = this.order.indexOf(o.id);
      const control: WidgetControl = {
        id: o.id,
        kind: 'card',
        rect: cells[i] as Rect,
        state: position >= 0 ? 'selected' : 'normal',
        tone: 'neutral',
      };
      if (o.label !== undefined) control.label = o.label;
      if (o.visual !== undefined) control.visual = o.visual;
      if (position >= 0) control.badge = String(position + 1);
      return control;
    });
    controls.push({
      id: SUBMIT_ID,
      kind: 'submit',
      rect: { x: area.x, y: area.y + area.h - submitH, w: area.w, h: submitH },
      state: this.order.length === this.options.length ? 'normal' : 'disabled',
      tone: 'accent',
      label: 'Go',
    });
    return controls;
  }

  activate(controlId: string): WidgetEffect {
    if (controlId === SUBMIT_ID) {
      if (this.order.length !== this.options.length) return { type: 'none' };
      return { type: 'submit', answer: { kind: 'sequence', optionIds: [...this.order] } };
    }
    if (!this.options.some((o) => o.id === controlId)) return { type: 'none' };
    this.order = this.order.includes(controlId)
      ? this.order.filter((id) => id !== controlId)
      : [...this.order, controlId];
    return { type: 'changed' };
  }

  responseText(): string {
    return '';
  }

  onWrong(_answer: SubmittedAnswer): void {
    this.order = [];
  }

  isEmpty(): boolean {
    return this.order.length === 0;
  }

  reset(): void {
    this.order = [];
  }
}
