import type { GeneratedQuestion, QuestionOption, SubmittedAnswer } from '../../curriculum/schema';
import type { Rect } from '../ui/geometry';
import { flowCells } from '../ui/geometry';
import type { WidgetControl, WidgetEffect, WidgetModel } from './types';

/** Number of tile columns for a given option count (a stack for 2-3, a grid beyond). */
export function tileColumns(count: number, preferred?: number): number {
  if (preferred !== undefined) return Math.max(1, Math.min(preferred, count));
  return count <= 3 ? 1 : 2;
}

/**
 * Two to six large tiles. Tapping a tile is the deliberate action itself (no separate Go button for a
 * single-choice tile). A tile that turned out wrong is dimmed for the rest of the item, quietly.
 */
export class ChoiceTilesWidget implements WidgetModel {
  readonly kind = 'choice-tiles' as const;
  readonly showAnswerField = false;
  private readonly options: readonly QuestionOption[];
  private readonly columns: number | undefined;
  private wrong = new Set<string>();

  constructor(question: GeneratedQuestion) {
    this.options = question.options ?? [];
    this.columns = question.widgetConfig?.columns;
  }

  layout(area: Rect): WidgetControl[] {
    const gap = Math.max(6, Math.min(area.w, area.h) * 0.04);
    const cells = flowCells(
      area,
      this.options.length,
      tileColumns(this.options.length, this.columns),
      gap,
    );
    return this.options.map((o, i): WidgetControl => {
      const control: WidgetControl = {
        id: o.id,
        kind: 'tile',
        rect: cells[i] as Rect,
        state: this.wrong.has(o.id) ? 'wrong' : 'normal',
        tone: 'neutral',
      };
      if (o.label !== undefined) control.label = o.label;
      if (o.visual !== undefined) control.visual = o.visual;
      return control;
    });
  }

  activate(controlId: string): WidgetEffect {
    if (this.wrong.has(controlId) || !this.options.some((o) => o.id === controlId))
      return { type: 'none' };
    return { type: 'submit', answer: { kind: 'choice', optionId: controlId } };
  }

  responseText(): string {
    return '';
  }

  onWrong(answer: SubmittedAnswer): void {
    if (answer.kind === 'choice') this.wrong.add(answer.optionId);
  }

  isEmpty(): boolean {
    return true;
  }

  reset(): void {
    this.wrong = new Set();
  }
}
