import type { Rng } from '../game/core/SeededRng';
import { normalizeDecimal } from './answers';
import type { VisualModel } from './visual';
import { validateVisual } from './visual';

export type Year = 1 | 2;
export type Level = 1 | 2 | 3 | 4;
export type Language = 'bm' | 'en';
/**
 * How a pupil answers. Only the number pad remains (DECISIONS #42): every question is a picture to count and one
 * whole number. The field stays on questions and evidence so older records keep their meaning.
 */
export type WidgetKind = 'number-pad';

export const LEVELS: readonly Level[] = [1, 2, 3, 4];
export const WIDGET_KINDS: readonly WidgetKind[] = ['number-pad'];

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

/** The exact number a pupil must type, as a normalised decimal string. */
export type AcceptedAnswer = { kind: 'number'; value: string };

export type SubmittedAnswer = { kind: 'number'; raw: string };

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
  /** Small conceptual hint shown after two wrong attempts (never reveals the answer). */
  hint?: string;
  /** Optional visual support revealed after three wrong attempts. */
  supportVisual?: VisualModel;
  /** The same picture rearranged so it is easier to count (rows of 5), shown with the hint (DECISIONS #42). */
  hintVisual?: VisualModel;
  /** Generation parameters, enough to reproduce the item. */
  metadata: Record<string, JsonValue>;
};

/** What a template produces; the registry adds identity, pack and curriculum tags. */
export type BuiltQuestion = {
  difficultyBand: string;
  prompt: PromptModel;
  widget: WidgetKind;
  acceptedAnswer: AcceptedAnswer;
  hint?: string;
  supportVisual?: VisualModel;
  hintVisual?: VisualModel;
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
  if (q.hintVisual) p.push(...validateVisual(q.hintVisual).map((m) => `hint visual: ${m}`));

  try {
    const roundTrip: unknown = JSON.parse(JSON.stringify(q.metadata));
    if (JSON.stringify(roundTrip) !== JSON.stringify(q.metadata))
      p.push('metadata is not JSON-stable');
  } catch (error) {
    p.push(`metadata is not JSON serialisable: ${String(error)}`);
  }

  const a = q.acceptedAnswer;
  if (q.widget !== 'number-pad') p.push(`unknown widget ${String(q.widget)}`);
  if (a.kind !== 'number') {
    p.push('the answer must be a number');
  } else {
    if (normalizeDecimal(a.value) !== a.value)
      p.push(`accepted number "${a.value}" is not normalised`);
    // "Kira & taip" (DECISIONS #42): one whole number from 0 to 999, and always a picture to count.
    if (!/^\d{1,3}$/.test(a.value)) p.push(`answer ${a.value} is not a whole number from 0 to 999`);
  }
  if (!q.prompt.visual) p.push('every question needs a picture to count');
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
