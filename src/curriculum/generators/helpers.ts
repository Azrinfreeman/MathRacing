import type { Rng } from '../../game/core/SeededRng';
import type {
  AcceptedAnswer,
  BuildContext,
  BuiltQuestion,
  JsonObject,
  Level,
  QuestionOption,
  QuestionTemplate,
  TemplateFixture,
  WidgetKind,
} from '../schema';
import { visualSignature } from '../visual';
import type { VisualModel } from '../visual';

/** Pick the BM or English string; English falls back to BM when not provided. */
export function tr(ctx: Pick<BuildContext, 'language'>, bm: string, en?: string): string {
  return ctx.language === 'en' ? (en ?? bm) : bm;
}

export type TemplateDef<P extends JsonObject> = {
  id: string;
  topicId: string;
  widget: WidgetKind;
  /** SK range tokens exactly as printed in the KPM plan. */
  sk: string[];
  /** SP codes are not listed in the plan; left empty until a reviewer supplies verified codes. */
  sp?: string[];
  scope: string;
  levelNotes: [string, string, string, string];
  prerequisites?: string[];
  remainderAllowed?: boolean | null;
  arithmetic?: boolean;
  sample(rng: Rng, level: Level, simpler: boolean): P;
  build(params: P, ctx: BuildContext): BuiltQuestion;
  recompute?(params: P): string;
  fixtures: Array<{ params: P; level?: Level; expected: TemplateFixture['expected'] }>;
};

/**
 * Turns a strongly typed template definition into the erased `QuestionTemplate` the registry stores.
 * This is the single place where the parameter type is re-asserted: parameters only ever come from
 * the same definition's `sample()` (or its own fixtures), so the assertion cannot be violated.
 */
export function defineTemplate<P extends JsonObject>(def: TemplateDef<P>): QuestionTemplate {
  const asParams = (params: JsonObject): P => params as P;
  const template: QuestionTemplate = {
    id: def.id,
    topicId: def.topicId,
    widget: def.widget,
    standardKandungan: def.sk,
    standardPembelajaran: def.sp ?? [],
    scope: def.scope,
    levelNotes: def.levelNotes,
    prerequisites: def.prerequisites ?? [],
    remainderAllowed: def.remainderAllowed ?? null,
    arithmetic: def.arithmetic ?? false,
    fixtures: def.fixtures,
    generate(rng, ctx) {
      const params = def.sample(rng, ctx.level, ctx.simpler);
      return { params, built: def.build(params, ctx) };
    },
    buildFromParams(params, ctx) {
      return def.build(asParams(params), ctx);
    },
  };
  const recompute = def.recompute;
  if (recompute) template.recompute = (params) => recompute(asParams(params));
  return template;
}

export type OptionSpec = { label?: string; visual?: VisualModel; value?: number };

function specKey(o: OptionSpec): string {
  return `${o.label ?? ''}|${o.visual ? visualSignature(o.visual) : ''}`;
}

/**
 * Build shuffled choice options with exactly one correct entry. Throws on duplicate content so a
 * generator bug is caught by tests instead of producing an ambiguous question.
 */
export function buildChoices(
  ctx: BuildContext,
  correct: OptionSpec,
  wrong: OptionSpec[],
): { options: QuestionOption[]; acceptedAnswer: AcceptedAnswer } {
  const specs = [correct, ...wrong];
  const keys = new Set(specs.map(specKey));
  if (keys.size !== specs.length) {
    throw new Error(`duplicate option content: ${specs.map(specKey).join(' / ')}`);
  }
  const order = ctx.rng.shuffle(specs.map((_, i) => i));
  const options: QuestionOption[] = order.map((specIndex, position) => {
    const spec = specs[specIndex] as OptionSpec;
    const option: QuestionOption = { id: `o${position + 1}` };
    if (spec.label !== undefined) option.label = spec.label;
    if (spec.visual !== undefined) option.visual = spec.visual;
    if (spec.value !== undefined) option.value = spec.value;
    return option;
  });
  const correctPosition = order.indexOf(0);
  return { options, acceptedAnswer: { kind: 'choice', optionId: `o${correctPosition + 1}` } };
}

/** Unique integers near `correct` (within [min,max]) for plausible numeric distractors. */
export function numericDistractors(
  rng: Rng,
  correct: number,
  count: number,
  min: number,
  max: number,
  seeds: number[] = [],
): number[] {
  const out: number[] = [];
  const used = new Set<number>([correct]);
  const push = (n: number): void => {
    if (n >= min && n <= max && !used.has(n) && out.length < count) {
      used.add(n);
      out.push(n);
    }
  };
  for (const s of seeds) push(s);
  let guard = 0;
  while (out.length < count && guard < 400) {
    guard++;
    const spread = Math.max(2, Math.round((max - min) / 8));
    push(correct + rng.int(-spread, spread));
  }
  // Deterministic fallback so the loop can never fail silently on tiny ranges.
  for (let n = min; n <= max && out.length < count; n++) push(n);
  return out;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Fingerprint of a built question for "no immediate repetition" checks. */
export function fingerprint(built: BuiltQuestion): string {
  return JSON.stringify([
    built.prompt.expression ?? '',
    built.prompt.text,
    built.prompt.visual ? visualSignature(built.prompt.visual) : '',
    built.acceptedAnswer,
    (built.options ?? []).map((o) => o.label ?? (o.visual ? visualSignature(o.visual) : '')),
  ]);
}

export const MINUS = '−';
export const TIMES = '×';
export const DIVIDE = '÷';
