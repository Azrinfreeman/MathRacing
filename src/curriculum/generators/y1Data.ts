import type { Level, LocalText, QuestionTemplate } from '../schema';
import type { ObjectShape, Shape2D } from '../visual';
import { FRUITS, OBJECT_COLORS, PETS, text } from '../text/vocab';
import { numberBuilt, tapBuilt } from './builders';
import { buildChoices, defineTemplate, tr } from './helpers';

const TOPIC = 'y1-data';
const SK = ['7.1-7.2'];

const ROW_SHAPES: ObjectShape[] = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart'];
const CATEGORY_SETS: Record<'fruit' | 'pet', readonly LocalText[]> = { fruit: FRUITS, pet: PETS };

type PictoBase = { catSet: 'fruit' | 'pet'; labelIdx: number[]; counts: number[] };
const PICTO_CFG: Record<Level, { rows: number; max: number }> = {
  1: { rows: 3, max: 5 },
  2: { rows: 3, max: 7 },
  3: { rows: 4, max: 9 },
  4: { rows: 4, max: 10 },
};

function pictoVisual(ctx: { language: 'bm' | 'en' }, p: PictoBase) {
  const names = CATEGORY_SETS[p.catSet];
  return {
    kind: 'pictograph' as const,
    rows: p.labelIdx.map((li, i) => ({
      label: text(ctx.language, names[li] as LocalText),
      count: p.counts[i] as number,
      shape: ROW_SHAPES[i] as ObjectShape,
      color: OBJECT_COLORS[i] ?? '#2e86de',
    })),
  };
}

function samplePicto(
  rng: {
    int(a: number, b: number): number;
    chance(p: number): boolean;
    shuffle<T>(x: readonly T[]): T[];
  },
  level: Level,
  distinct: boolean,
): PictoBase {
  const cfg = PICTO_CFG[level];
  const catSet: 'fruit' | 'pet' = rng.chance(0.5) ? 'fruit' : 'pet';
  const labelIdx = rng
    .shuffle(Array.from({ length: CATEGORY_SETS[catSet].length }, (_, i) => i))
    .slice(0, cfg.rows);
  let counts: number[];
  if (distinct) {
    counts = rng.shuffle(Array.from({ length: cfg.max }, (_, i) => i + 1)).slice(0, cfg.rows);
  } else {
    counts = Array.from({ length: cfg.rows }, () => rng.int(1, cfg.max));
  }
  return { catSet, labelIdx, counts };
}

type ReadP = PictoBase & { ask: number };
const pictographRead = defineTemplate<ReadP>({
  id: 'y1-data-pictograph-read',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Read a pictograph where one picture represents one item (count symbols)',
  levelNotes: [
    '3 rows, up to 5 symbols',
    '3 rows, up to 7 symbols',
    '4 rows, up to 9 symbols',
    '4 rows, up to 10 symbols',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const base = samplePicto(rng, level, false);
    return { ...base, ask: rng.int(0, base.labelIdx.length - 1) };
  },
  build: (p, ctx) => {
    const visual = pictoVisual(ctx, p);
    const row = visual.rows[p.ask];
    if (!row) throw new Error('pictograph-read: ask index out of range');
    return numberBuilt({
      band: `rows-${p.labelIdx.length}`,
      text: tr(
        ctx,
        `1 gambar = 1 orang. Berapa orang suka ${row.label.toLowerCase()}?`,
        `1 picture = 1 pupil. How many pupils like ${row.label.toLowerCase()}?`,
      ),
      visual,
      answer: p.counts[p.ask] as number,
      hint: tr(
        ctx,
        'Kira gambar pada baris itu satu demi satu.',
        'Count the pictures in that row one by one.',
      ),
    });
  },
  recompute: (p) => String(p.counts[p.ask]),
  fixtures: [
    {
      params: { catSet: 'fruit', labelIdx: [0, 1, 2], counts: [4, 2, 5], ask: 0 },
      expected: { answerText: '4' },
    },
  ],
});

type MostP = PictoBase & { ask: 'most' | 'fewest' };
const pictographMost = defineTemplate<MostP>({
  id: 'y1-data-pictograph-most',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Read the most popular choice from a pictograph',
  levelNotes: [
    '3 rows, up to 5 symbols',
    '3 rows, up to 7 symbols',
    '4 rows, up to 9 symbols',
    '4 rows, up to 10 symbols',
  ],
  prerequisites: ['y1-data-pictograph-read'],
  sample: (rng, level) => ({
    ...samplePicto(rng, level, true),
    ask: rng.chance(0.6) ? 'most' : 'fewest',
  }),
  build: (p, ctx) => {
    const visual = pictoVisual(ctx, p);
    const target = p.ask === 'most' ? Math.max(...p.counts) : Math.min(...p.counts);
    const targetIdx = p.counts.indexOf(target);
    const labelOf = (i: number): string => (visual.rows[i] as { label: string }).label;
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: labelOf(targetIdx) },
      visual.rows
        .map((_, i) => i)
        .filter((i) => i !== targetIdx)
        .map((i) => ({ label: labelOf(i) })),
    );
    return {
      difficultyBand: `rows-${p.labelIdx.length}`,
      widget: 'choice-tiles',
      prompt: {
        text:
          p.ask === 'most'
            ? tr(ctx, 'Pilihan mana paling popular?', 'Which choice is the most popular?')
            : tr(ctx, 'Pilihan mana paling kurang popular?', 'Which choice is the least popular?'),
        visual,
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Cari baris yang paling panjang (atau paling pendek).',
        'Look for the longest (or shortest) row.',
      ),
    };
  },
  fixtures: [
    {
      params: { catSet: 'pet', labelIdx: [0, 1, 2], counts: [3, 5, 1], ask: 'most' },
      expected: { answerText: 'Ikan' },
    },
  ],
});

type MoreFewerP = { catSet: 'fruit' | 'pet'; labelIdx: number[]; counts: number[] };
const moreFewer = defineTemplate<MoreFewerP>({
  id: 'y1-data-more-fewer',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'One more / one fewer questions on data',
  levelNotes: [
    'difference within 5',
    'difference within 7',
    'difference within 9',
    'difference within 10',
  ],
  prerequisites: ['y1-data-pictograph-read'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = PICTO_CFG[level];
    const catSet: 'fruit' | 'pet' = rng.chance(0.5) ? 'fruit' : 'pet';
    const labelIdx = rng
      .shuffle(Array.from({ length: CATEGORY_SETS[catSet].length }, (_, i) => i))
      .slice(0, 2);
    const counts = rng.shuffle(Array.from({ length: cfg.max }, (_, i) => i + 1)).slice(0, 2);
    return { catSet, labelIdx, counts: [Math.max(...counts), Math.min(...counts)] };
  },
  build: (p, ctx) => {
    const names = CATEGORY_SETS[p.catSet];
    const bigger = text(ctx.language, names[p.labelIdx[0] as number] as LocalText).toLowerCase();
    const smaller = text(ctx.language, names[p.labelIdx[1] as number] as LocalText).toLowerCase();
    const visual = pictoVisual(ctx, p);
    return numberBuilt({
      band: `max-${Math.max(...p.counts)}`,
      text: tr(
        ctx,
        `Berapa lebih ramai suka ${bigger} berbanding ${smaller}?`,
        `How many more pupils like ${bigger} than ${smaller}?`,
      ),
      visual,
      answer: (p.counts[0] as number) - (p.counts[1] as number),
      hint: tr(
        ctx,
        'Padankan gambar dua baris. Berapa yang lebih?',
        'Match the pictures of the two rows. How many are left over?',
      ),
    });
  },
  recompute: (p) => String((p.counts[0] as number) - (p.counts[1] as number)),
  fixtures: [
    {
      params: { catSet: 'fruit', labelIdx: [0, 1], counts: [7, 3] },
      expected: { answerText: '4' },
    },
  ],
});

type ClassifyP = { items: Shape2D[]; colors: number[]; target: Shape2D };
const CLASSIFY_CFG: Record<Level, { count: number; pool: Shape2D[] }> = {
  1: { count: 4, pool: ['circle', 'triangle', 'square'] },
  2: { count: 6, pool: ['circle', 'triangle', 'square'] },
  3: { count: 8, pool: ['circle', 'triangle', 'square', 'rectangle'] },
  4: { count: 8, pool: ['circle', 'triangle', 'square', 'rectangle'] },
};
const classify = defineTemplate<ClassifyP>({
  id: 'y1-data-classify',
  topicId: TOPIC,
  widget: 'tap-picture',
  sk: SK,
  scope: 'Classify everyday data (sort by shape)',
  levelNotes: ['4 items, 3 kinds', '6 items, 3 kinds', '8 items, 4 kinds', '8 items, 4 kinds'],
  sample: (rng, level) => {
    const cfg = CLASSIFY_CFG[level];
    for (let i = 0; i < 300; i++) {
      const items = Array.from({ length: cfg.count }, () => rng.pick(cfg.pool));
      const target = rng.pick(items);
      const n = items.filter((s) => s === target).length;
      if (n >= 1 && n <= cfg.count - 1) {
        return { items, colors: items.map(() => rng.int(0, 5)), target };
      }
    }
    return {
      items: ['circle', 'triangle', 'circle', 'square'].slice(0, cfg.count) as Shape2D[],
      colors: [0, 1, 2, 3].slice(0, cfg.count),
      target: 'circle',
    };
  },
  build: (p, ctx) => {
    const ids = p.items.map((_, i) => `i${i}`);
    const names: Record<string, LocalText> = {
      circle: { bm: 'bulatan', en: 'circles' },
      triangle: { bm: 'segi tiga', en: 'triangles' },
      square: { bm: 'segi empat sama', en: 'squares' },
      rectangle: { bm: 'segi empat tepat', en: 'rectangles' },
    };
    return tapBuilt({
      band: `items-${p.items.length}`,
      text: tr(
        ctx,
        `Ketik semua ${text('bm', names[p.target] as LocalText)}.`,
        `Tap all the ${text('en', names[p.target] as LocalText)}.`,
      ),
      options: p.items.map((shape, i) => ({
        id: ids[i] as string,
        visual: {
          kind: 'shape2d' as const,
          shape,
          color: OBJECT_COLORS[p.colors[i] as number] ?? '#2e86de',
        },
      })),
      acceptedAnswer: { kind: 'set', optionIds: ids.filter((_, i) => p.items[i] === p.target) },
      multi: true,
      columns: Math.min(4, p.items.length),
      hint: tr(
        ctx,
        'Abaikan warna. Lihat bentuk sahaja.',
        'Ignore the colour. Look at the shape only.',
      ),
    });
  },
  fixtures: [
    {
      params: {
        items: ['circle', 'square', 'circle', 'triangle'],
        colors: [0, 1, 2, 3],
        target: 'circle',
      },
      expected: { answerText: 'shape2d circle + shape2d circle' },
    },
  ],
});

export const Y1_DATA_TEMPLATES: QuestionTemplate[] = [
  pictographRead,
  pictographMost,
  moreFewer,
  classify,
];
