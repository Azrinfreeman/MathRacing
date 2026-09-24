import type { Rng } from '../../game/core/SeededRng';
import type {
  BuildContext,
  BuiltQuestion,
  JsonObject,
  Level,
  QuestionTemplate,
  TemplateFixture,
  WidgetKind,
} from '../schema';
import { visualSignature } from '../visual';

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
  ]);
}

export const MINUS = '−';
export const TIMES = '×';
export const DIVIDE = '÷';
