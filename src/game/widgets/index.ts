import type { GeneratedQuestion } from '../../curriculum/schema';
import { NumberPadWidget } from './NumberPadWidget';
import type { WidgetModel } from './types';

/**
 * Create a fresh, independent widget model for one player's current question. Every question is answered on
 * the number pad (DECISIONS #42).
 */
export function createWidget(_question: GeneratedQuestion): WidgetModel {
  return new NumberPadWidget();
}

export type { WidgetControl, WidgetEffect, WidgetModel } from './types';
export { hitControl } from './types';
