import type { Rng } from '../game/core/SeededRng';
import { KPM_MS_Y1_V1 } from './packs/kpm-ms-y1-v1';
import { KPM_MS_Y2_V1 } from './packs/kpm-ms-y2-v1';
import type {
  BuildContext,
  BuiltQuestion,
  CurriculumPack,
  CurriculumTopic,
  GeneratedQuestion,
  JsonObject,
  Language,
  Level,
  QuestionTemplate,
  Year,
} from './schema';
import { validateGeneratedQuestion, validatePack } from './schema';

/** A curriculum pack is malformed or clashes with another pack. Fail fast in development. */
export class CurriculumError extends Error {
  readonly problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(problems.length > 0 ? `${message}: ${problems.join('; ')}` : message);
    this.name = 'CurriculumError';
    this.problems = problems;
  }
}

/** A template failed to produce a valid question after several attempts. */
export class GenerationError extends CurriculumError {
  readonly templateId: string;
  constructor(templateId: string, problems: string[]) {
    super(`Could not generate a valid question from template ${templateId}`, problems);
    this.name = 'GenerationError';
    this.templateId = templateId;
  }
}

export type GenerateRequest = {
  templateId: string;
  /** Stream used for this one question; the registry derives sampling/presentation streams from it. */
  rng: Rng;
  level: Level;
  language: Language;
  questionId: string;
  /** Build the simpler variant (one level lower, visual support attached where a template has one). */
  simpler?: boolean;
};

const MAX_ATTEMPTS = 24;

function lowerLevel(level: Level): Level {
  if (level === 4) return 3;
  if (level === 3) return 2;
  return 1;
}

export class CurriculumRegistry {
  private readonly packs = new Map<string, CurriculumPack>();
  private readonly templates = new Map<
    string,
    { pack: CurriculumPack; template: QuestionTemplate }
  >();

  constructor(packs: readonly CurriculumPack[]) {
    for (const pack of packs) this.register(pack);
  }

  /** Validate and register a pack. Rejects malformed packs and duplicate pack/template ids. */
  register(pack: CurriculumPack): void {
    const problems = validatePack(pack);
    if (problems.length > 0)
      throw new CurriculumError(`Malformed curriculum pack "${pack.packId}"`, problems);
    if (this.packs.has(pack.packId))
      throw new CurriculumError(`Duplicate pack id "${pack.packId}"`);
    for (const t of pack.templates) {
      if (this.templates.has(t.id))
        throw new CurriculumError(`Duplicate template id "${t.id}" in pack "${pack.packId}"`);
    }
    this.packs.set(pack.packId, pack);
    for (const template of pack.templates) this.templates.set(template.id, { pack, template });
  }

  allPacks(): CurriculumPack[] {
    return [...this.packs.values()];
  }

  getPack(packId: string): CurriculumPack {
    const pack = this.packs.get(packId);
    if (!pack) throw new CurriculumError(`Unknown pack "${packId}"`);
    return pack;
  }

  packForYear(year: Year): CurriculumPack {
    const pack = this.allPacks().find((p) => p.year === year);
    if (!pack) throw new CurriculumError(`No pack for Year ${year}`);
    return pack;
  }

  topicsFor(packId: string): CurriculumTopic[] {
    return this.getPack(packId).topics;
  }

  templatesForTopic(packId: string, topicId: string): QuestionTemplate[] {
    return this.getPack(packId).templates.filter((t) => t.topicId === topicId);
  }

  getTemplate(templateId: string): QuestionTemplate {
    const entry = this.templates.get(templateId);
    if (!entry) throw new CurriculumError(`Unknown template "${templateId}"`);
    return entry.template;
  }

  private assemble(
    pack: CurriculumPack,
    template: QuestionTemplate,
    built: BuiltQuestion,
    params: JsonObject,
    info: {
      id: string;
      language: Language;
      level: Level;
      requestedLevel: Level;
      simpler: boolean;
      attempt: number;
    },
  ): GeneratedQuestion {
    const question: GeneratedQuestion = {
      id: info.id,
      packId: pack.packId,
      packVersion: pack.version,
      year: pack.year,
      topicId: template.topicId,
      standardKandungan: template.standardKandungan,
      standardPembelajaran: template.standardPembelajaran,
      templateId: template.id,
      difficultyBand: built.difficultyBand,
      level: info.level,
      language: info.language,
      prompt: built.prompt,
      widget: built.widget,
      acceptedAnswer: built.acceptedAnswer,
      metadata: {
        params,
        level: info.level,
        requestedLevel: info.requestedLevel,
        simpler: info.simpler,
        attempt: info.attempt,
        remainderAllowed: template.remainderAllowed,
        spStatus: template.standardPembelajaran.length > 0 ? 'listed' : 'not-listed-in-plan',
      },
    };
    if (built.hint) question.hint = built.hint;
    if (built.supportVisual) question.supportVisual = built.supportVisual;
    if (built.hintVisual) question.hintVisual = built.hintVisual;
    return question;
  }

  /** Generate one validated question. Retries with fresh streams if a sample is invalid. */
  generate(req: GenerateRequest): GeneratedQuestion {
    const entry = this.templates.get(req.templateId);
    if (!entry) throw new CurriculumError(`Unknown template "${req.templateId}"`);
    const { pack, template } = entry;
    const simpler = req.simpler === true;
    const level = simpler ? lowerLevel(req.level) : req.level;
    let lastProblems: string[] = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const sampleRng = req.rng.fork(`sample:${attempt}`);
      const ctx: BuildContext = {
        language: req.language,
        level,
        rng: req.rng.fork(`present:${attempt}`),
        simpler,
      };
      try {
        const { params, built } = template.generate(sampleRng, ctx);
        const question = this.assemble(pack, template, built, params, {
          id: req.questionId,
          language: req.language,
          level,
          requestedLevel: req.level,
          simpler,
          attempt,
        });
        const problems = validateGeneratedQuestion(question);
        if (built.widget !== template.widget)
          problems.push(
            `built widget ${built.widget} differs from template widget ${template.widget}`,
          );
        if (problems.length === 0) return question;
        lastProblems = problems;
      } catch (error) {
        lastProblems = [error instanceof Error ? error.message : String(error)];
      }
    }
    throw new GenerationError(req.templateId, lastProblems);
  }

  /**
   * Build a question from explicit parameters (used for worked fixtures and reproducing a reported item).
   * Unlike `generate`, it does not retry: invalid parameters are an error.
   */
  buildWithParams(
    templateId: string,
    params: JsonObject,
    opts: { level: Level; language: Language; rng: Rng; questionId?: string; simpler?: boolean },
  ): GeneratedQuestion {
    const entry = this.templates.get(templateId);
    if (!entry) throw new CurriculumError(`Unknown template "${templateId}"`);
    const { pack, template } = entry;
    const simpler = opts.simpler === true;
    const ctx: BuildContext = {
      language: opts.language,
      level: opts.level,
      rng: opts.rng,
      simpler,
    };
    const built = template.buildFromParams(params, ctx);
    const question = this.assemble(pack, template, built, params, {
      id: opts.questionId ?? `${templateId}:fixture`,
      language: opts.language,
      level: opts.level,
      requestedLevel: opts.level,
      simpler,
      attempt: 0,
    });
    const problems = validateGeneratedQuestion(question);
    if (problems.length > 0) throw new GenerationError(templateId, problems);
    return question;
  }
}

let defaultRegistry: CurriculumRegistry | undefined;

/** The registry with the bundled Year 1 and Year 2 packs. Built once and validated on first use. */
export function getDefaultRegistry(): CurriculumRegistry {
  defaultRegistry ??= new CurriculumRegistry([KPM_MS_Y1_V1, KPM_MS_Y2_V1]);
  return defaultRegistry;
}
