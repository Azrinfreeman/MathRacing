import type { SubmittedAnswer } from '../../curriculum/schema';
import type { Rect } from '../ui/geometry';
import { gridCells } from '../ui/geometry';
import type { WidgetControl, WidgetEffect, WidgetModel } from './types';

/**
 * Keypad for whole-number answers: digits 1-9 in three rows, then Clear, 0 and Go (Hantar), matching the
 * familiar layout children already know; on a short panel, 1-5 and 6-0 in two rows with a wide C and Go below. The typed value is text so leading zeros and length are exact.
 */
export class NumberPadWidget implements WidgetModel {
  readonly kind = 'number-pad' as const;
  readonly showAnswerField = true;
  private digits = '';

  constructor(private readonly maxDigits = 4) {}

  layout(area: Rect): WidgetControl[] {
    const gap = Math.max(4, area.h * 0.03);
    // Short panels (small tablets with 4-5 players and a picture) get digits in two rows of five and a wide
    // C and Go row, whenever that makes the digit keys larger than the familiar 3 x 4 pad (DECISIONS #42).
    const rowH = (rows: number): number => (area.h - gap * (rows - 1)) / rows;
    const colW = (cols: number): number => (area.w - gap * (cols - 1)) / cols;
    const compact = rowH(4) < 40 && Math.min(colW(5), rowH(3)) > Math.min(colW(3), rowH(4));
    let cells: Rect[];
    let order: string[];
    if (compact) {
      const digitRows = gridCells({ ...area, h: rowH(3) * 2 + gap }, 5, 2, gap);
      const last: Rect = { x: area.x, y: area.y + (rowH(3) + gap) * 2, w: area.w, h: rowH(3) };
      const clearW = (last.w - gap) * 0.4;
      cells = [
        ...digitRows,
        { ...last, w: clearW },
        { ...last, x: last.x + clearW + gap, w: last.w - clearW - gap },
      ];
      order = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd0', 'clear', 'submit'];
    } else {
      cells = gridCells(area, 3, 4, gap);
      order = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'clear', 'd0', 'submit'];
    }
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
