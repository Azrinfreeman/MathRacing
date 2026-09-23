import type { SubmittedAnswer, WidgetKind } from '../../curriculum/schema';
import type { VisualModel } from '../../curriculum/visual';
import type { Rect } from '../ui/geometry';
import { contains } from '../ui/geometry';

export type ControlKind = 'digit' | 'clear' | 'submit' | 'back' | 'tile' | 'card' | 'part';
export type ControlTone = 'primary' | 'secondary' | 'accent' | 'neutral';
/** 'wrong' tiles are only dimmed (no red mark, no shaming). */
export type ControlState = 'normal' | 'selected' | 'disabled' | 'wrong';

export type WidgetControl = {
  id: string;
  kind: ControlKind;
  rect: Rect;
  state: ControlState;
  tone: ControlTone;
  label?: string;
  visual?: VisualModel;
  /** Small round badge (order number, part count). */
  badge?: string;
};

export type WidgetEffect =
  { type: 'none' } | { type: 'changed' } | { type: 'submit'; answer: SubmittedAnswer };

/**
 * A pure model of one answer widget for one player: its input state and the controls it lays out.
 * It never validates answers (that is the domain service's job) and never touches Phaser.
 */
export interface WidgetModel {
  readonly kind: WidgetKind;
  /** Whether a separate response field is shown above the controls. */
  readonly showAnswerField: boolean;
  layout(area: Rect): WidgetControl[];
  /** A completed tap on a control (pointer down and up on the same control, owned by this panel). */
  activate(controlId: string): WidgetEffect;
  /** Text for the response field ('' when empty). */
  responseText(): string;
  /** The domain service judged this submission wrong: update the widget (clear digits, dim a tile, ...). */
  onWrong(answer: SubmittedAnswer): void;
  isEmpty(): boolean;
  reset(): void;
}

/** Topmost enabled control containing the point (coordinates in the same space as the rects). */
export function hitControl(
  controls: readonly WidgetControl[],
  x: number,
  y: number,
): WidgetControl | null {
  for (let i = controls.length - 1; i >= 0; i--) {
    const c = controls[i] as WidgetControl;
    if (c.state !== 'disabled' && contains(c.rect, x, y)) return c;
  }
  return null;
}
