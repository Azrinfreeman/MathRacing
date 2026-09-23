import type { Rng } from '../game/core/SeededRng';
import { normalizeDecimal } from './answers';
import type { VisualModel } from './visual';
import { validateVisual, visualSignature } from './visual';

export type Year = 1 | 2;
export type Level = 1 | 2 | 3 | 4;
export type Language = 'bm' | 'en';
export type WidgetKind =
  'number-pad' | 'choice-tiles' | 'tap-picture' | 'order-strip' | 'build-value';

export const LEVELS: readonly Level[] = [1, 2, 3, 4];
export const WIDGET_KINDS: readonly WidgetKind[] = [
  'number-pad',
  'choice-tiles',
  'tap-picture',
  'order-strip',
  'build-value',
];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Bilingual text. Bahasa Melayu is required; a missing English string falls back to BM. */
export type LocalText = { bm: string; en?: string };

export function pickText(language: Language, text: LocalText): string {
  if (language === 'en') return text.en ?? text.bm;
  return text.bm;
}

export type PromptModel = {
  /** Short instruction, kept brief to limit reading burden. */
  text: string;
  /** Large mathematical expression shown prominently, e.g. "36 + 14 = ?". */
  expression?: string;
  /** Unit shown beside a numeric input (e.g. "sen", "RM", "ml"); never part of the typed value. */
  unit?: string;
  visual?: VisualModel;
};

export type QuestionOption = {
  id: string;
  label?: string;
  visual?: VisualModel;
  /** Numeric contribution of a build-value part, in the answer's own unit. */
  value?: number;
};

export type AcceptedAnswer =
  | { kind: 'number'; value: string }
  | { kind: 'choice'; optionId: string }
  /** Ordered list of option ids (order-strip). */
  | { kind: 'sequence'; optionIds: string[] }
  /** Exact set of option ids (tap-picture, multi-select). */
  | { kind: 'set'; optionIds: string[] }
  /** Any selection of exactly `count` distinct options (e.g. shade 3 of 4 parts). */
  | { kind: 'count'; count: number };

export type SubmittedAnswer =
  | { kind: 'number'; raw: string }
  | { kind: 'choice'; optionId: string }
  | { kind: 'sequence'; optionIds: string[] }
  | { kind: 'set'; optionIds: string[] };

export type WidgetConfig = {
  /** tap-picture: allow selecting several pictures. */
  multi?: boolean;
  /** build-value: how the running total is displayed. */
  totalUnit?: 'sen' | 'rm' | 'plain';
  /** Preferred number of tile columns. */
  columns?: number;
};

export type GeneratedQuestion = {
  id: string;
  packId: string;
  packVersion: string;
  year: Year;
  topicId: string;
  standardKandungan: string[];
  standardPembelajaran: string[];
  templateId: string;
  difficultyBand: string;
  level: Level;
  language: Language;
  prompt: PromptModel;
  widget: WidgetKind;
  acceptedAnswer: AcceptedAnswer;
  options?: QuestionOption[];
  widgetConfig?: WidgetConfig;
  /** Small conceptual hint shown after two wrong attempts (never reveals the answer). */
  hint?: string;
  /** Optional visual support revealed after three wrong attempts. */
  supportVisual?: VisualModel;
  /** Generation parameters, enough to reproduce the item. */
  metadata: Record<string, JsonValue>;
};

/** What a template produces; the registry adds identity, pack and curriculum tags. */
export type BuiltQuestion = {
  difficultyBand: string;
  prompt: PromptModel;
  widget: WidgetKind;
  acceptedAnswer: AcceptedAnswer;
  options?: QuestionOption[];
  widgetConfig?: WidgetConfig;
  hint?: string;
  supportVisual?: VisualModel;
};

export type BuildContext = {
  language: Language;
  level: Level;
  /** Random stream for presentation choices (option order) that must not depend on parameters. */
  rng: Rng;
  /** True when building the simpler variant offered after three wrong attempts. */
  simpler: boolean;
};

export type TemplateFixture = {
  params: JsonObject;
  /** Level the fixture is built at (some templates derive scales or ranges from the level). Default 2. */
  level?: Level;
  expected: { answerText: string; expression?: string };
};

export interface QuestionTemplate {
  id: string;
  topicId: string;
  widget: WidgetKind;
  standardKandungan: string[];
  standardPembelajaran: string[];
  /** Phrase from the KPM game plan that this template addresses (traceability). */
  scope: string;
  /** Explicit parameter range for each level 1..4 (index 0 = level 1). */
  levelNotes: [string, string, string, string];
  prerequisites: string[];
  /** Whether a division remainder can occur, or null when the template is not a division. */
  remainderAllowed: boolean | null;
  /** True when answers are numbers recomputed independently in tests. */
  arithmetic: boolean;
  fixtures: TemplateFixture[];
  generate(rng: Rng, ctx: BuildContext): { params: JsonObject; built: BuiltQuestion };
  buildFromParams(params: JsonObject, ctx: BuildContext): BuiltQuestion;
  /** Independent recomputation of the accepted answer from the parameters. */
  recompute?(params: JsonObject): string;
}

export type CurriculumTopic = {
  id: string;
  year: Year;
  /** Topic number as printed in the plan, e.g. "1.0". */
  code: string;
  title: LocalText;
  /** SK range exactly as printed in the KPM game plan, e.g. "1.1-1.5". */
  standardKandungan: string;
  /** Learning scope paraphrase from the game plan. */
  scope: string;
};

export type CurriculumPack = {
  packId: string;
  version: string;
  year: Year;
  title: LocalText;
  /** e.g. "KSSR (Semakan 2017) - Edisi 3". */
  basis: string;
  effectiveDate: string;
  status: 'draft-pending-academic-review';
  /** Qualified reviewer sign-off; null until a Malaysian primary Mathematics educator approves. */
  reviewer: string | null;
  sourceNote: string;
  topics: CurriculumTopic[];
  templates: QuestionTemplate[];
};

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

function hasText(s: string | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

function optionKey(o: { label?: string; visual?: VisualModel }): string {
  return `${o.label ?? ''}|${o.visual ? visualSignature(o.visual) : ''}`;
}

/** DP check that a build-value target can be reached exactly with the offered parts. */
function reachable(target: number, parts: number[]): boolean {
  if (target < 0 || !Number.isInteger(target) || target > 100000) return false;
  const ok = new Array<boolean>(target + 1).fill(false);
  ok[0] = true;
  for (let t = 1; t <= target; t++) {
    ok[t] = parts.some((p) => p <= t && ok[t - p] === true);
  }
  return ok[target] === true;
}

/** Returns a list of problems with a generated question (empty when it is valid). */
export function validateGeneratedQuestion(q: GeneratedQuestion): string[] {
  const p: string[] = [];
  for (const [name, val] of [
    ['id', q.id],
    ['packId', q.packId],
    ['packVersion', q.packVersion],
    ['topicId', q.topicId],
    ['templateId', q.templateId],
    ['difficultyBand', q.difficultyBand],
  ] as const) {
    if (!hasText(val)) p.push(`${name} is empty`);
  }
  if (q.year !== 1 && q.year !== 2) p.push(`year ${String(q.year)} invalid`);
  if (!LEVELS.includes(q.level)) p.push(`level ${String(q.level)} invalid`);
  if (q.language !== 'bm' && q.language !== 'en') p.push(`language ${String(q.language)} invalid`);
  if (q.standardKandungan.length === 0 || q.standardKandungan.some((s) => !hasText(s))) {
    p.push('standardKandungan (SK) must be non-empty');
  }
  if (!hasText(q.prompt.text) && !hasText(q.prompt.expression)) p.push('prompt has no text');
  if (
    q.prompt.expression !== undefined &&
    /undefined|NaN|null|\[object/.test(q.prompt.expression)
  ) {
    p.push(`prompt expression looks broken: ${q.prompt.expression}`);
  }
  if (q.prompt.visual) p.push(...validateVisual(q.prompt.visual).map((m) => `prompt visual: ${m}`));
  if (q.supportVisual)
    p.push(...validateVisual(q.supportVisual).map((m) => `support visual: ${m}`));
  for (const o of q.options ?? []) {
    if (o.visual) p.push(...validateVisual(o.visual).map((m) => `option ${o.id} visual: ${m}`));
  }

  try {
    const roundTrip: unknown = JSON.parse(JSON.stringify(q.metadata));
    if (JSON.stringify(roundTrip) !== JSON.stringify(q.metadata))
      p.push('metadata is not JSON-stable');
  } catch (error) {
    p.push(`metadata is not JSON serialisable: ${String(error)}`);
  }

  const options = q.options ?? [];
  const ids = options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) p.push('option ids are not unique');
  if (ids.some((id) => !hasText(id))) p.push('an option id is empty');
  const a = q.acceptedAnswer;

  switch (q.widget) {
    case 'number-pad': {
      if (a.kind !== 'number') {
        p.push('number-pad requires a number answer');
        break;
      }
      if (normalizeDecimal(a.value) !== a.value)
        p.push(`accepted number "${a.value}" is not normalised`);
      if (options.length > 0) p.push('number-pad must not carry options');
      break;
    }
    case 'choice-tiles': {
      if (options.length < 2 || options.length > 6)
        p.push(`choice-tiles needs 2..6 options, has ${options.length}`);
      if (new Set(options.map(optionKey)).size !== options.length)
        p.push('duplicate option content');
      if (options.some((o) => !hasText(o.label) && !o.visual))
        p.push('an option has neither label nor visual');
      if (a.kind !== 'choice') {
        p.push('choice-tiles requires a choice answer');
        break;
      }
      if (ids.filter((id) => id === a.optionId).length !== 1)
        p.push('accepted option is not exactly one of the options');
      break;
    }
    case 'tap-picture': {
      if (options.length < 2 || options.length > 12)
        p.push(`tap-picture needs 2..12 options, has ${options.length}`);
      if (a.kind === 'choice') {
        if (!ids.includes(a.optionId)) p.push('accepted option missing');
      } else if (a.kind === 'set') {
        if (a.optionIds.length === 0 || a.optionIds.some((id) => !ids.includes(id)))
          p.push('accepted set invalid');
        if (a.optionIds.length === options.length)
          p.push('accepted set selects everything (trivial)');
      } else if (a.kind === 'count') {
        if (a.count < 1 || a.count > options.length) p.push('accepted count invalid');
      } else {
        p.push('tap-picture requires choice, set or count answer');
      }
      break;
    }
    case 'order-strip': {
      if (options.length < 2 || options.length > 6)
        p.push(`order-strip needs 2..6 cards, has ${options.length}`);
      if (a.kind !== 'sequence') {
        p.push('order-strip requires a sequence answer');
        break;
      }
      if (
        a.optionIds.length !== ids.length ||
        new Set(a.optionIds).size !== ids.length ||
        a.optionIds.some((id) => !ids.includes(id))
      ) {
        p.push('sequence must contain every card exactly once');
      } else if (a.optionIds.every((id, i) => id === ids[i])) {
        p.push('cards are presented already in the answer order');
      }
      if (new Set(options.map(optionKey)).size !== options.length) p.push('duplicate card content');
      break;
    }
    case 'build-value': {
      if (a.kind !== 'number') {
        p.push('build-value requires a number answer');
        break;
      }
      const values = options.map((o) => o.value);
      if (values.some((v) => v === undefined || !Number.isInteger(v) || v <= 0)) {
        p.push('build-value parts need positive integer values');
        break;
      }
      if (new Set(values).size !== values.length)
        p.push('build-value parts must have distinct values');
      if (!q.widgetConfig?.totalUnit) p.push('build-value requires widgetConfig.totalUnit');
      const target = Number(a.value);
      if (!reachable(target, values as number[]))
        p.push(`build-value target ${a.value} is not reachable`);
      break;
    }
  }
  return p;
}

/** Returns a list of problems with a curriculum pack (empty when it is well-formed). */
export function validatePack(pack: CurriculumPack): string[] {
  const p: string[] = [];
  if (!hasText(pack.packId)) p.push('packId is empty');
  if (!/^\d+\.\d+\.\d+$/.test(pack.version)) p.push(`version "${pack.version}" is not semver`);
  const topicIds = pack.topics.map((t) => t.id);
  if (new Set(topicIds).size !== topicIds.length) p.push('duplicate topic ids');
  for (const t of pack.topics) {
    if (t.year !== pack.year)
      p.push(`topic ${t.id} year ${t.year} differs from pack year ${pack.year}`);
    if (!hasText(t.standardKandungan)) p.push(`topic ${t.id} has no SK range`);
    if (!hasText(t.title.bm)) p.push(`topic ${t.id} has no BM title`);
  }
  const templateIds = pack.templates.map((t) => t.id);
  if (new Set(templateIds).size !== templateIds.length) p.push('duplicate template ids');
  for (const t of pack.templates) {
    if (!topicIds.includes(t.topicId))
      p.push(`template ${t.id} references unknown topic ${t.topicId}`);
    if (!WIDGET_KINDS.includes(t.widget)) p.push(`template ${t.id} has unknown widget ${t.widget}`);
    if (t.standardKandungan.length === 0) p.push(`template ${t.id} has no SK`);
    if (t.fixtures.length === 0) p.push(`template ${t.id} has no worked fixture`);
    if (t.levelNotes.some((n) => !hasText(n)))
      p.push(`template ${t.id} lacks explicit level ranges`);
    if (!hasText(t.scope)) p.push(`template ${t.id} lacks a scope reference`);
  }
  return p;
}
