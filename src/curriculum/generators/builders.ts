import type { BuildContext, BuiltQuestion, Level, QuestionOption } from '../schema';
import { normalizeDecimal } from '../answers';
import type { VisualModel } from '../visual';

/** Upper bound of the number range for Year 1 number topics: within 10, 20, 50, then 100. */
export const Y1_MAX: Record<Level, number> = { 1: 10, 2: 20, 3: 50, 4: 100 };

export function bandWithin(max: number): string {
  return `within-${max}`;
}

type NumberBuild = {
  band: string;
  text: string;
  expression?: string;
  unit?: string;
  visual?: VisualModel;
  answer: number | string;
  hint?: string;
  supportVisual?: VisualModel;
};

/** Build a number-pad question. The accepted answer is stored as an exact normalised decimal string. */
export function numberBuilt(o: NumberBuild): BuiltQuestion {
  const value = normalizeDecimal(String(o.answer));
  if (value === null)
    throw new Error(`numberBuilt: "${String(o.answer)}" is not a valid non-negative decimal`);
  const built: BuiltQuestion = {
    difficultyBand: o.band,
    widget: 'number-pad',
    prompt: { text: o.text },
    acceptedAnswer: { kind: 'number', value },
  };
  if (o.expression !== undefined) built.prompt.expression = o.expression;
  if (o.unit !== undefined) built.prompt.unit = o.unit;
  if (o.visual !== undefined) built.prompt.visual = o.visual;
  if (o.hint !== undefined) built.hint = o.hint;
  if (o.supportVisual !== undefined) built.supportVisual = o.supportVisual;
  return built;
}

type OrderBuild = {
  band: string;
  text: string;
  expression?: string;
  /** Cards in the correct order. */
  cards: Array<{ id: string; label: string }>;
  hint?: string;
};

/** Build an order-strip question, presenting the cards in a deterministic shuffle that is never already sorted. */
export function orderBuilt(ctx: BuildContext, o: OrderBuild): BuiltQuestion {
  const correct = o.cards.map((c) => c.id);
  let shuffled = ctx.rng.shuffle(o.cards);
  let guard = 0;
  while (shuffled.every((c, i) => c.id === correct[i]) && guard < 20) {
    shuffled = ctx.rng.shuffle(o.cards);
    guard++;
  }
  if (shuffled.every((c, i) => c.id === correct[i])) {
    // Extremely unlikely fallback: swap the first two cards.
    shuffled = shuffled.slice();
    const first = shuffled[0];
    const second = shuffled[1];
    if (first && second) {
      shuffled[0] = second;
      shuffled[1] = first;
    }
  }
  const options: QuestionOption[] = shuffled.map((c) => ({ id: c.id, label: c.label }));
  const built: BuiltQuestion = {
    difficultyBand: o.band,
    widget: 'order-strip',
    prompt: { text: o.text },
    options,
    acceptedAnswer: { kind: 'sequence', optionIds: correct },
  };
  if (o.expression !== undefined) built.prompt.expression = o.expression;
  if (o.hint !== undefined) built.hint = o.hint;
  return built;
}

type TapBuild = {
  band: string;
  text: string;
  expression?: string;
  options: QuestionOption[];
  acceptedAnswer: BuiltQuestion['acceptedAnswer'];
  multi: boolean;
  columns?: number;
  hint?: string;
  visual?: VisualModel;
};

export function tapBuilt(o: TapBuild): BuiltQuestion {
  const built: BuiltQuestion = {
    difficultyBand: o.band,
    widget: 'tap-picture',
    prompt: { text: o.text },
    options: o.options,
    acceptedAnswer: o.acceptedAnswer,
    widgetConfig: { multi: o.multi, ...(o.columns !== undefined ? { columns: o.columns } : {}) },
  };
  if (o.expression !== undefined) built.prompt.expression = o.expression;
  if (o.visual !== undefined) built.prompt.visual = o.visual;
  if (o.hint !== undefined) built.hint = o.hint;
  return built;
}

/** Clamp helper used by samplers. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
