import type { BuiltQuestion, Cue, Level } from '../schema';
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
  /** Draw `expression` on the pupil panel (Tahap 2, DECISIONS #48). */
  showExpression?: boolean;
  unit?: string;
  /** Word-free badge for the pupil panel; `none` when the picture alone is clear. */
  cue: Cue;
  visual?: VisualModel;
  answer: number | string;
  hint?: string;
  supportVisual?: VisualModel;
  hintVisual?: VisualModel;
};

/** Build a number-pad question. The accepted answer is stored as an exact normalised decimal string. */
export function numberBuilt(o: NumberBuild): BuiltQuestion {
  const value = normalizeDecimal(String(o.answer));
  if (value === null)
    throw new Error(`numberBuilt: "${String(o.answer)}" is not a valid non-negative decimal`);
  const built: BuiltQuestion = {
    difficultyBand: o.band,
    widget: 'number-pad',
    prompt: { text: o.text, cue: o.cue },
    acceptedAnswer: { kind: 'number', value },
  };
  if (o.expression !== undefined) built.prompt.expression = o.expression;
  if (o.showExpression === true && o.expression !== undefined) built.prompt.showExpression = true;
  if (o.unit !== undefined) built.prompt.unit = o.unit;
  if (o.visual !== undefined) built.prompt.visual = o.visual;
  if (o.hint !== undefined) built.hint = o.hint;
  if (o.supportVisual !== undefined) built.supportVisual = o.supportVisual;
  if (o.hintVisual !== undefined) built.hintVisual = o.hintVisual;
  return built;
}

/** Clamp helper used by samplers. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
