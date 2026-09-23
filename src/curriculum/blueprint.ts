import { SeededRng } from '../game/core/SeededRng';
import type { CurriculumRegistry } from './registry';
import { CurriculumError } from './registry';
import type { GeneratedQuestion, Language, Level } from './schema';
import { fingerprint } from './generators/helpers';

export type BlueprintConfig = {
  seed: string;
  packId: string;
  topicIds: string[];
  level: Level;
  raceLength: number;
  language: Language;
};

/**
 * What the race engine asks for questions. Implementations must be deterministic: the same
 * (player, index) always yields the same question for a given configuration and seed.
 */
export interface QuestionSource {
  /** The question a player faces as their `index`-th item (0-based). */
  question(playerId: string, index: number): GeneratedQuestion;
  /** A simpler related variant of that item, offered after three wrong attempts. `n` counts requests. */
  simpler(playerId: string, index: number, n: number): GeneratedQuestion;
  /** Template ids of the shared race blueprint (identical for every player). */
  readonly blueprint: readonly string[];
}

/**
 * Build the shared race blueprint: one template per item index, identical for every player, with the
 * selected topics rotated evenly (each round of topics is shuffled, so mixed races stay balanced).
 */
export function buildBlueprint(registry: CurriculumRegistry, cfg: BlueprintConfig): string[] {
  if (cfg.topicIds.length === 0) throw new CurriculumError('Choose at least one topic');
  const rng = new SeededRng(cfg.seed).fork('blueprint');
  const templateBags = new Map<string, string[]>();
  for (const topicId of cfg.topicIds) {
    const ids = registry.templatesForTopic(cfg.packId, topicId).map((t) => t.id);
    if (ids.length === 0)
      throw new CurriculumError(`Topic "${topicId}" has no templates in pack "${cfg.packId}"`);
    templateBags.set(topicId, []);
  }
  let topicQueue: string[] = [];
  const out: string[] = [];
  for (let i = 0; i < cfg.raceLength; i++) {
    if (topicQueue.length === 0) topicQueue = rng.shuffle(cfg.topicIds);
    const topicId = topicQueue.shift() as string;
    let bag = templateBags.get(topicId) as string[];
    if (bag.length === 0) {
      bag = rng.shuffle(registry.templatesForTopic(cfg.packId, topicId).map((t) => t.id));
      templateBags.set(topicId, bag);
    }
    out.push(bag.shift() as string);
  }
  return out;
}

const MAX_REPEAT_TRIES = 8;

export function createQuestionSource(
  registry: CurriculumRegistry,
  cfg: BlueprintConfig,
): QuestionSource {
  const blueprint = buildBlueprint(registry, cfg);
  const root = new SeededRng(cfg.seed);
  const cache = new Map<string, GeneratedQuestion>();

  const templateAt = (index: number): string => {
    const id = blueprint[index % blueprint.length];
    if (id === undefined) throw new CurriculumError('Empty race blueprint');
    return id;
  };

  const idFor = (playerId: string, index: number, suffix: string): string =>
    `${cfg.packId}:${templateAt(index)}:${cfg.seed}:${playerId}:${index}${suffix}`;

  const source: QuestionSource = {
    blueprint,
    question(playerId, index) {
      const key = `${playerId}:${index}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const previous = index > 0 ? source.question(playerId, index - 1) : null;
      const base = root.fork(`player:${playerId}`).fork(`item:${index}`);
      let question: GeneratedQuestion | null = null;
      for (let attempt = 0; attempt < MAX_REPEAT_TRIES; attempt++) {
        question = registry.generate({
          templateId: templateAt(index),
          rng: base.fork(`try:${attempt}`),
          level: cfg.level,
          language: cfg.language,
          questionId: idFor(playerId, index, ''),
        });
        // Avoid an immediate repeat of the previous item for this player.
        if (!previous || fingerprint(question) !== fingerprint(previous)) break;
      }
      if (!question) throw new CurriculumError('No question could be generated');
      cache.set(key, question);
      return question;
    },
    simpler(playerId, index, n) {
      const base = root.fork(`player:${playerId}`).fork(`item:${index}`).fork(`simpler:${n}`);
      return registry.generate({
        templateId: templateAt(index),
        rng: base,
        level: cfg.level,
        language: cfg.language,
        questionId: idFor(playerId, index, `:s${n}`),
        simpler: true,
      });
    },
  };
  return source;
}

/** A short preview of what a race would contain (for the teacher's "preview sample" button). */
export function previewQuestions(
  registry: CurriculumRegistry,
  cfg: BlueprintConfig,
  count = 5,
): GeneratedQuestion[] {
  const source = createQuestionSource(registry, {
    ...cfg,
    raceLength: Math.max(count, cfg.raceLength),
  });
  return Array.from({ length: count }, (_, i) => source.question('preview', i));
}
