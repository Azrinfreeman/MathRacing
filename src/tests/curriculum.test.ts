import { describe, expect, it } from 'vitest';
import { answerText, evaluateAnswer, normalizeDecimal } from '../curriculum/answers';
import { CurriculumError, CurriculumRegistry, getDefaultRegistry } from '../curriculum/registry';
import type {
  CurriculumPack,
  GeneratedQuestion,
  JsonObject,
  Level,
  QuestionTemplate,
  WidgetKind,
} from '../curriculum/schema';
import { LEVELS, validateGeneratedQuestion, validatePack } from '../curriculum/schema';
import { numberToWords } from '../curriculum/text/vocab';
import { SeededRng } from '../game/core/SeededRng';
import { visualTotal } from '../curriculum/visual';

const registry = getDefaultRegistry();
const cases = registry
  .allPacks()
  .flatMap((pack) => pack.templates.map((template) => ({ pack, template })));

function generate(
  templateId: string,
  seed: string,
  level: Level,
  language: 'bm' | 'en' = 'bm',
): GeneratedQuestion {
  return registry.generate({
    templateId,
    rng: new SeededRng(seed),
    level,
    language,
    questionId: seed,
  });
}

/** Every question must have exactly one defensible correct response through the shared answer service. */
function expectExactlyOneAnswer(q: GeneratedQuestion): void {
  const a = q.acceptedAnswer;
  expect(q.widget).toBe('number-pad');
  expect(evaluateAnswer(q, { kind: 'number', raw: a.value })).toMatchObject({
    valid: true,
    correct: true,
  });
  expect(a.value).toMatch(/^\d{1,3}$/); // one whole number from 0 to 999 (DECISIONS #42)
  expect(evaluateAnswer(q, { kind: 'number', raw: String(Number(a.value) + 1) }).correct).toBe(
    false,
  );
}

/**
 * "Count all" and "how many are left" questions: the things drawn (minus the crossed-out ones) are exactly the
 * answer, and the rows-of-5 help picture shows the same things (DECISIONS #42).
 */
const COUNT_ALL = new Set([
  'y1-easy-count',
  'y1-easy-add',
  'y1-easy-sub',
  'y1-easy-groups',
  'y1-easy-money',
  'y2-easy-blocks',
  'y2-easy-add',
  'y2-easy-sub',
  'y2-easy-mul',
  'y2-easy-money',
]);
function expectCountable(q: GeneratedQuestion): void {
  const visual = q.prompt.visual;
  expect(visual, 'every question has a picture').toBeDefined();
  if (!visual) return;
  const total = visualTotal(visual);
  if (COUNT_ALL.has(q.templateId)) {
    expect(total, `${q.templateId} draws something to count`).not.toBeNull();
    const perUnit = q.prompt.unit === 'RM' ? 100 : 1;
    expect(String((total ?? 0) / perUnit), `${q.templateId} drawn count`).toBe(
      q.acceptedAnswer.value,
    );
  }
  if (q.hintVisual) {
    expect(q.hintVisual.kind).toBe('ten-frames');
    expect(visualTotal(q.hintVisual)).toBe(total);
  }
}

describe('curriculum registry', () => {
  it('loads both bundled packs without validation problems', () => {
    expect(registry.allPacks().map((p) => p.packId)).toEqual(['kpm-ms-y1', 'kpm-ms-y2']);
    for (const pack of registry.allPacks()) expect(validatePack(pack)).toEqual([]);
  });

  it('covers every planned topic with at least one counting question', () => {
    const y1 = registry.packForYear(1);
    const y2 = registry.packForYear(2);
    expect(y1.topics.map((t) => t.code)).toEqual(['1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '7.0']);
    expect(y2.topics.map((t) => t.code)).toEqual([
      '1.0',
      '2.0',
      '3.0',
      '4.0',
      '5.0',
      '6.0',
      '7.0',
      '8.0',
    ]);
    for (const pack of [y1, y2]) {
      for (const topic of pack.topics) {
        expect(
          registry.templatesForTopic(pack.packId, topic.id).length,
          `${topic.id} template count`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('answers every question on the number pad: nothing to order, build or select (DECISIONS #42)', () => {
    const kinds = new Set<WidgetKind>(cases.map((c) => c.template.widget));
    expect([...kinds]).toEqual(['number-pad']);
  });

  it('does not invent SP codes: SP is empty until verified codes are supplied', () => {
    for (const { template } of cases) expect(template.standardPembelajaran).toEqual([]);
  });

  it('tags every SK with the topic range printed in the KPM plan', () => {
    for (const pack of registry.allPacks()) {
      for (const template of pack.templates) {
        const topic = pack.topics.find((t) => t.id === template.topicId);
        expect(template.standardKandungan, template.id).toEqual([topic?.standardKandungan]);
      }
    }
  });

  it('rejects a pack whose template references an unknown topic', () => {
    const y1 = registry.packForYear(1);
    const template = y1.templates[0] as QuestionTemplate;
    const bad: CurriculumPack = {
      ...y1,
      packId: 'bad-pack',
      templates: [{ ...template, id: 'bad-template', topicId: 'no-such-topic' }],
    };
    expect(validatePack(bad).join(' ')).toContain('unknown topic');
    expect(() => new CurriculumRegistry([bad])).toThrow(CurriculumError);
  });

  it('rejects duplicate pack ids and duplicate template ids', () => {
    const y1 = registry.packForYear(1);
    expect(() => new CurriculumRegistry([y1, y1])).toThrow(/Duplicate pack id/);
    const y2 = registry.packForYear(2);
    const clash: CurriculumPack = {
      ...y2,
      packId: 'other-pack',
      templates: [y1.templates[0] as QuestionTemplate, ...y2.templates.slice(1)],
    };
    const clashTopicFix: CurriculumPack = {
      ...clash,
      topics: [...y2.topics],
      templates: clash.templates.map((t, i) =>
        i === 0 ? { ...t, topicId: (y2.topics[0] as { id: string }).id } : t,
      ),
    };
    expect(() => new CurriculumRegistry([y1, clashTopicFix])).toThrow(/Duplicate template id/);
  });

  it('rejects a pack with duplicate template ids or a template without fixtures', () => {
    const y1 = registry.packForYear(1);
    const first = y1.templates[0] as QuestionTemplate;
    expect(validatePack({ ...y1, templates: [first, first] }).join(' ')).toContain(
      'duplicate template ids',
    );
    expect(validatePack({ ...y1, templates: [{ ...first, fixtures: [] }] }).join(' ')).toContain(
      'no worked fixture',
    );
  });

  it('raises a GenerationError-safe path for unknown templates', () => {
    expect(() => generate('does-not-exist', 'x', 1)).toThrow(CurriculumError);
  });

  it('flags malformed generated questions', () => {
    const q = generate('y1-easy-add', 'ok', 2);
    expect(validateGeneratedQuestion(q)).toEqual([]);
    expect(validateGeneratedQuestion({ ...q, standardKandungan: [] })).not.toEqual([]);
    const bad = (value: string): string[] =>
      validateGeneratedQuestion({ ...q, acceptedAnswer: { kind: 'number', value } });
    expect(bad('007')).not.toEqual([]); // not normalised
    expect(bad('1000')).not.toEqual([]); // more than three digits
    expect(bad('2.5')).not.toEqual([]); // not a whole number
    const { visual: _visual, ...noPicture } = q.prompt;
    expect(validateGeneratedQuestion({ ...q, prompt: noPicture }).join(' ')).toContain('picture');
  });
});

describe('number words', () => {
  it('spells Bahasa Melayu numbers', () => {
    expect(numberToWords(0, 'bm')).toBe('sifar');
    expect(numberToWords(11, 'bm')).toBe('sebelas');
    expect(numberToWords(15, 'bm')).toBe('lima belas');
    expect(numberToWords(40, 'bm')).toBe('empat puluh');
    expect(numberToWords(100, 'bm')).toBe('seratus');
    expect(numberToWords(111, 'bm')).toBe('seratus sebelas');
    expect(numberToWords(215, 'bm')).toBe('dua ratus lima belas');
    expect(numberToWords(430, 'bm')).toBe('empat ratus tiga puluh');
    expect(numberToWords(1000, 'bm')).toBe('seribu');
  });
  it('spells English numbers', () => {
    expect(numberToWords(21, 'en')).toBe('twenty-one');
    expect(numberToWords(430, 'en')).toBe('four hundred and thirty');
    expect(numberToWords(200, 'en')).toBe('two hundred');
    expect(numberToWords(1000, 'en')).toBe('one thousand');
  });
  it('rejects out-of-range values', () => {
    expect(() => numberToWords(1001, 'bm')).toThrow(RangeError);
    expect(() => numberToWords(-1, 'en')).toThrow(RangeError);
  });
});

describe.each(cases)('template $template.id', ({ pack, template }) => {
  it('declares explicit ranges, a scope reference and a worked fixture', () => {
    expect(template.levelNotes).toHaveLength(4);
    expect(template.scope.length).toBeGreaterThan(5);
    expect(template.fixtures.length).toBeGreaterThanOrEqual(1);
    if (template.arithmetic)
      expect(
        template.recompute,
        'arithmetic templates need an independent recomputation',
      ).toBeTypeOf('function');
  });

  it('reproduces its worked fixtures exactly', () => {
    for (const fixture of template.fixtures) {
      const q = registry.buildWithParams(template.id, fixture.params, {
        level: fixture.level ?? 2,
        language: 'bm',
        rng: new SeededRng('fixture'),
      });
      expect(answerText(q), 'fixture answer').toBe(fixture.expected.answerText);
      if (fixture.expected.expression !== undefined)
        expect(q.prompt.expression).toBe(fixture.expected.expression);
      expect(validateGeneratedQuestion(q)).toEqual([]);
    }
  });

  const arithmeticSamples = 1000;
  const otherSamples = 250;
  const samples = template.arithmetic ? arithmeticSamples : otherSamples;

  it.each(LEVELS)(
    `level %i: ${samples} samples are valid, tagged, unambiguous and deterministic`,
    (level) => {
      const distinct = new Set<string>();
      for (let i = 0; i < samples; i++) {
        const seed = `prop:${template.id}:${level}:${i}`;
        const q = generate(template.id, seed, level);
        expect(validateGeneratedQuestion(q), seed).toEqual([]);
        expect(q.packId).toBe(pack.packId);
        expect(q.templateId).toBe(template.id);
        expect(q.standardKandungan.length).toBeGreaterThan(0);
        expect(q.widget).toBe(template.widget);
        expect(JSON.stringify(q)).not.toMatch(/undefined|NaN|\[object/);
        expectExactlyOneAnswer(q);
        expectCountable(q);
        if (template.recompute && q.acceptedAnswer.kind === 'number') {
          const params = (q.metadata as { params: JsonObject }).params;
          expect(normalizeDecimal(template.recompute(params)), seed).toBe(q.acceptedAnswer.value);
        }
        if (i < 40) {
          expect(generate(template.id, seed, level), `determinism ${seed}`).toEqual(q);
        }
        // Variety is judged on everything a pupil can see, including option labels and pictures.
        distinct.add(JSON.stringify([q.prompt, q.acceptedAnswer]));
      }
      expect(distinct.size, 'question variety').toBeGreaterThanOrEqual(2);
    },
  );

  it('generates the same valid content in English', () => {
    for (const level of LEVELS) {
      for (let i = 0; i < 40; i++) {
        const q = generate(template.id, `en:${template.id}:${level}:${i}`, level, 'en');
        expect(validateGeneratedQuestion(q)).toEqual([]);
        expect(q.language).toBe('en');
        expectExactlyOneAnswer(q);
      }
    }
  });

  it('builds a simpler variant that is valid and one level lower', () => {
    for (const level of LEVELS) {
      const q = registry.generate({
        templateId: template.id,
        rng: new SeededRng(`simple:${template.id}:${level}`),
        level,
        language: 'bm',
        questionId: 's',
        simpler: true,
      });
      expect(validateGeneratedQuestion(q)).toEqual([]);
      expect(q.level).toBe(Math.max(1, level - 1));
    }
  });
});
