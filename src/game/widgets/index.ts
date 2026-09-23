import type { GeneratedQuestion } from '../../curriculum/schema';
import { BuildValueWidget } from './BuildValueWidget';
import { ChoiceTilesWidget } from './ChoiceTilesWidget';
import { NumberPadWidget } from './NumberPadWidget';
import { OrderStripWidget } from './OrderStripWidget';
import { TapPictureWidget } from './TapPictureWidget';
import type { WidgetModel } from './types';

/** Create a fresh, independent widget model for one player's current question. */
export function createWidget(question: GeneratedQuestion): WidgetModel {
  switch (question.widget) {
    case 'number-pad':
      return new NumberPadWidget();
    case 'choice-tiles':
      return new ChoiceTilesWidget(question);
    case 'tap-picture':
      return new TapPictureWidget(question);
    case 'order-strip':
      return new OrderStripWidget(question);
    case 'build-value':
      return new BuildValueWidget(question);
  }
}

export type { WidgetControl, WidgetEffect, WidgetModel } from './types';
export { hitControl } from './types';
