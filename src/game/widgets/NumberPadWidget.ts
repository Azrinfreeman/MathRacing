import type { SubmittedAnswer } from '../../curriculum/schema';
import type { Rect } from '../ui/geometry';
import { gridCells } from '../ui/geometry';
import type { WidgetControl, WidgetEffect, WidgetModel } from './types';

/**
 * Keypad for whole-number answers: digits 1-9 in three rows, then Clear, 0 and Go (Hantar), matching the
 * familiar layout children already know. The typed value is text so leading zeros and length are exact.
 */
export class NumberPadWidget implements WidgetModel {
  readonly kind = 'number-pad' as const;
  readonly showAnswerField = true;
  private digits = '';

  constructor(private readonly maxDigits = 4) {}

  layout(area: Rect): WidgetControl[] {
    const gap = Math.max(4, area.h * 0.03);
    const cells = gridCells(area, 3, 4, gap);
    const order = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'clear', 'd0', 'submit'];
    return order.map((id, i): WidgetControl => {
      const cell = cells[i] as Rect;
      if (id === 'clear')
        return { id, kind: 'clear', rect: cell, state: 'normal', tone: 'secondary', label: 'C' };
      if (id === 'submit') {
        return {
          id,
          kind: 'submit',
          rect: cell,
          state: this.digits === '' ? 'disabled' : 'normal',
          tone: 'accent',
          label: 'Go',
        };
      }
      return {
        id,
        kind: 'digit',
        rect: cell,
        state: 'normal',
        tone: 'neutral',
        label: id.slice(1),
      };
    });
  }

  activate(controlId: string): WidgetEffect {
    if (controlId === 'clear') {
      if (this.digits === '') return { type: 'none' };
      this.digits = '';
      return { type: 'changed' };
    }
    if (controlId === 'submit') {
      if (this.digits === '') return { type: 'none' };
      return { type: 'submit', answer: { kind: 'number', raw: this.digits } };
    }
    if (/^d\d$/.test(controlId)) {
      const digit = controlId.slice(1);
      if (this.digits === '0') {
        this.digits = digit; // no leading zeros
        return { type: 'changed' };
      }
      if (this.digits.length >= this.maxDigits) return { type: 'none' };
      this.digits += digit;
      return { type: 'changed' };
    }
    return { type: 'none' };
  }

  responseText(): string {
    return this.digits;
  }

  onWrong(_answer: SubmittedAnswer): void {
    this.digits = '';
  }

  isEmpty(): boolean {
    return this.digits === '';
  }

  reset(): void {
    this.digits = '';
  }
}
