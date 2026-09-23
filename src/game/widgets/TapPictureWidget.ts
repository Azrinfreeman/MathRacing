import type { GeneratedQuestion, QuestionOption, SubmittedAnswer } from '../../curriculum/schema';
import type { Rect } from '../ui/geometry';
import { flowCells } from '../ui/geometry';
import type { WidgetControl, WidgetEffect, WidgetModel } from './types';

const SUBMIT_ID = 'submit';

/**
 * Tap one or more pictures. A single-answer question submits on the tap (like choice tiles); a multi-select
 * question toggles pictures and needs a deliberate Go.
 */
export class TapPictureWidget implements WidgetModel {
  readonly kind = 'tap-picture' as const;
  readonly showAnswerField = false;
  private readonly options: readonly QuestionOption[];
  private readonly multi: boolean;
  private readonly columns: number;
  private selected: string[] = [];
  private wrong = new Set<string>();

  constructor(question: GeneratedQuestion) {
    this.options = question.options ?? [];
    this.multi = question.widgetConfig?.multi === true;
    this.columns = question.widgetConfig?.columns ?? Math.min(2, this.options.length);
  }

  layout(area: Rect): WidgetControl[] {
    const gap = Math.max(6, Math.min(area.w, area.h) * 0.03);
    const submitH = this.multi ? Math.max(40, area.h * 0.2) : 0;
    const tiles: Rect = {
      x: area.x,
      y: area.y,
      w: area.w,
      h: area.h - (this.multi ? submitH + gap : 0),
    };
    const cells = flowCells(tiles, this.options.length, this.columns, gap);
    const controls = this.options.map((o, i): WidgetControl => {
      const control: WidgetControl = {
        id: o.id,
        kind: 'tile',
        rect: cells[i] as Rect,
        state: this.selected.includes(o.id)
          ? 'selected'
          : this.wrong.has(o.id)
            ? 'wrong'
            : 'normal',
        tone: 'neutral',
      };
      if (o.label !== undefined) control.label = o.label;
      if (o.visual !== undefined) control.visual = o.visual;
      return control;
    });
    if (this.multi) {
      const submit: WidgetControl = {
        id: SUBMIT_ID,
        kind: 'submit',
        rect: { x: area.x, y: area.y + area.h - submitH, w: area.w, h: submitH },
        state: this.selected.length === 0 ? 'disabled' : 'normal',
        tone: 'accent',
        label: 'Go',
      };
      if (this.selected.length > 0) submit.badge = String(this.selected.length);
      controls.push(submit);
    }
    return controls;
  }

  activate(controlId: string): WidgetEffect {
    if (controlId === SUBMIT_ID) {
      if (!this.multi || this.selected.length === 0) return { type: 'none' };
      return { type: 'submit', answer: { kind: 'set', optionIds: [...this.selected] } };
    }
    if (!this.options.some((o) => o.id === controlId) || this.wrong.has(controlId))
      return { type: 'none' };
    if (!this.multi) return { type: 'submit', answer: { kind: 'set', optionIds: [controlId] } };
    this.selected = this.selected.includes(controlId)
      ? this.selected.filter((id) => id !== controlId)
      : [...this.selected, controlId];
    return { type: 'changed' };
  }

  responseText(): string {
    return '';
  }

  onWrong(answer: SubmittedAnswer): void {
    if (this.multi) {
      this.selected = [];
    } else if (answer.kind === 'set') {
      for (const id of answer.optionIds) this.wrong.add(id);
    }
  }

  isEmpty(): boolean {
    return this.selected.length === 0;
  }

  reset(): void {
    this.selected = [];
    this.wrong = new Set();
  }
}
