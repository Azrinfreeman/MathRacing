import type { Level, LocalText, QuestionTemplate } from '../schema';
import type { Shape2D, Shape3D } from '../visual';
import {
  FRUITS,
  OBJECT_COLORS,
  PETS,
  SHAPE2D_NAMES,
  SHAPE2D_SIDES,
  SHAPE3D_NAMES,
  text,
} from '../text/vocab';
import { numberBuilt } from './builders';
import { buildChoices, defineTemplate, tr } from './helpers';

// ---------------------------------------------------------------------------------------------
// 7.0 Space
// ---------------------------------------------------------------------------------------------
const S_TOPIC = 'y2-space';
const S_SK = ['7.1-7.2'];

const ALL_3D: Shape3D[] = ['cube', 'cuboid', 'cylinder', 'cone', 'sphere', 'pyramid'];
const ALL_2D: Shape2D[] = [
  'triangle',
  'square',
  'rectangle',
  'circle',
  'pentagon',
  'hexagon',
  'octagon',
];

type Prop3D =
  | 'curved-only'
  | 'two-flat-one-curved'
  | 'one-flat-one-curved'
  | 'six-equal-faces'
  | 'five-faces'
  | 'eight-vertices';
const PROP3D: Record<Prop3D, { test: (s: Shape3D) => boolean; text: LocalText }> = {
  'curved-only': {
    test: (s) => s === 'sphere',
    text: {
      bm: 'Pepejal mana hanya mempunyai permukaan melengkung?',
      en: 'Which solid has only a curved surface?',
    },
  },
  'two-flat-one-curved': {
    test: (s) => s === 'cylinder',
    text: {
      bm: 'Pepejal mana mempunyai 2 permukaan rata dan 1 permukaan melengkung?',
      en: 'Which solid has 2 flat faces and 1 curved surface?',
    },
  },
  'one-flat-one-curved': {
    test: (s) => s === 'cone',
    text: {
      bm: 'Pepejal mana mempunyai 1 permukaan rata dan 1 permukaan melengkung?',
      en: 'Which solid has 1 flat face and 1 curved surface?',
    },
  },
  'six-equal-faces': {
    test: (s) => s === 'cube',
    text: {
      bm: 'Pepejal mana mempunyai 6 permukaan rata yang sama besar?',
      en: 'Which solid has 6 flat faces that are all the same size?',
    },
  },
  'five-faces': {
    test: (s) => s === 'pyramid',
    text: { bm: 'Pepejal mana mempunyai 5 permukaan rata?', en: 'Which solid has 5 flat faces?' },
  },
  'eight-vertices': {
    test: (s) => s === 'cube' || s === 'cuboid',
    text: { bm: 'Pepejal mana mempunyai 8 bucu?', en: 'Which solid has 8 corners (vertices)?' },
  },
};
const PROPS_BY_LEVEL: Record<Level, Prop3D[]> = {
  1: ['curved-only', 'two-flat-one-curved'],
  2: ['curved-only', 'two-flat-one-curved', 'one-flat-one-curved', 'six-equal-faces'],
  3: ['curved-only', 'two-flat-one-curved', 'one-flat-one-curved', 'six-equal-faces', 'five-faces'],
  4: [
    'curved-only',
    'two-flat-one-curved',
    'one-flat-one-curved',
    'six-equal-faces',
    'five-faces',
    'eight-vertices',
  ],
};

type Props3dP = { prop: Prop3D; answer: Shape3D; wrong: Shape3D[] };
const props3d = defineTemplate<Props3dP>({
  id: 'y2-space-props-3d',
  topicId: S_TOPIC,
  widget: 'choice-tiles',
  sk: S_SK,
  scope: 'Identify 3D shapes from properties (choose a shape with a curved surface)',
  levelNotes: [
    'curved surfaces (sphere, cylinder)',
    '+ cone, cube faces',
    '+ five flat faces',
    '+ eight vertices',
  ],
  sample: (rng, level) => {
    const prop = rng.pick(PROPS_BY_LEVEL[level]);
    const test = PROP3D[prop].test;
    const answer = rng.pick(ALL_3D.filter(test));
    // Distractors are drawn only from shapes that do NOT have the property, so there is exactly one defensible answer.
    const wrong = rng.shuffle(ALL_3D.filter((s) => !test(s))).slice(0, 3);
    return { prop, answer, wrong };
  },
  build: (p, ctx) => {
    const option = (s: Shape3D) => ({
      label: text(ctx.language, SHAPE3D_NAMES[s]),
      visual: { kind: 'shape3d' as const, shape: s },
    });
    const { options, acceptedAnswer } = buildChoices(ctx, option(p.answer), p.wrong.map(option));
    return {
      difficultyBand: p.prop,
      widget: 'choice-tiles',
      prompt: { text: text(ctx.language, PROP3D[p.prop].text) },
      options,
      acceptedAnswer,
      hint: tr(ctx, 'Bayangkan memegang setiap pepejal.', 'Imagine holding each solid.'),
    };
  },
  fixtures: [
    {
      params: { prop: 'curved-only', answer: 'sphere', wrong: ['cube', 'pyramid', 'cuboid'] },
      expected: { answerText: 'Sfera' },
    },
  ],
});

type NetShape = 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'pyramid';
type NetP = { shape: NetShape; wrong: NetShape[] };
const NET_POOL: Record<Level, NetShape[]> = {
  1: ['cube', 'cylinder', 'cone'],
  2: ['cube', 'cylinder', 'cone', 'pyramid'],
  3: ['cube', 'cylinder', 'cone', 'pyramid'],
  4: ['cube', 'cylinder', 'cone', 'pyramid', 'cuboid'],
};
const net = defineTemplate<NetP>({
  id: 'y2-space-net',
  topicId: S_TOPIC,
  widget: 'choice-tiles',
  sk: S_SK,
  scope: 'Identify 3D shapes from nets (which solid matches this net?)',
  levelNotes: ['nets of cube, cylinder, cone', '+ pyramid', 'same as level 2', '+ cuboid'],
  prerequisites: ['y2-space-props-3d'],
  sample: (rng, level) => {
    const pool = NET_POOL[level];
    const shape = rng.pick(pool);
    return {
      shape,
      wrong: rng.shuffle(pool.filter((s) => s !== shape)).slice(0, level === 1 ? 2 : 3),
    };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: text(ctx.language, SHAPE3D_NAMES[p.shape]) },
      p.wrong.map((w) => ({ label: text(ctx.language, SHAPE3D_NAMES[w]) })),
    );
    return {
      difficultyBand: `pool-${NET_POOL[ctx.level].length}`,
      widget: 'choice-tiles',
      prompt: {
        text: tr(
          ctx,
          'Pepejal mana dibentuk oleh jaring ini?',
          'Which solid is made from this net?',
        ),
        visual: { kind: 'net', shape: p.shape },
      },
      options,
      acceptedAnswer,
      hint: tr(ctx, 'Bayangkan melipat jaring itu.', 'Imagine folding the net.'),
    };
  },
  fixtures: [
    {
      params: { shape: 'cylinder', wrong: ['cube', 'cone'] },
      expected: { answerText: 'Silinder' },
    },
  ],
});

type SidesP = { shape: Shape2D; colorIdx: number };
const SIDES_POOL: Record<Level, Shape2D[]> = {
  1: ['triangle', 'square', 'rectangle'],
  2: ['triangle', 'square', 'rectangle', 'pentagon'],
  3: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'],
  4: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'],
};
const sides = defineTemplate<SidesP>({
  id: 'y2-space-2d-sides',
  topicId: S_TOPIC,
  widget: 'number-pad',
  sk: S_SK,
  scope: 'Identify 2D shapes from properties (count the sides)',
  levelNotes: ['triangle, square, rectangle', '+ pentagon', '+ hexagon', '+ octagon'],
  arithmetic: true,
  sample: (rng, level) => ({ shape: rng.pick(SIDES_POOL[level]), colorIdx: rng.int(0, 5) }),
  build: (p, ctx) =>
    numberBuilt({
      band: `pool-${SIDES_POOL[ctx.level].length}`,
      text: tr(ctx, 'Berapa bilangan sisi?', 'How many sides?'),
      visual: { kind: 'shape2d', shape: p.shape, color: OBJECT_COLORS[p.colorIdx] },
      answer: SHAPE2D_SIDES[p.shape],
      hint: tr(
        ctx,
        'Kira setiap garisan lurus satu demi satu.',
        'Count each straight line one by one.',
      ),
    }),
  recompute: (p) => {
    const table: Record<string, number> = {
      triangle: 3,
      square: 4,
      rectangle: 4,
      pentagon: 5,
      hexagon: 6,
      octagon: 8,
    };
    return String(table[p.shape]);
  },
  fixtures: [{ params: { shape: 'hexagon', colorIdx: 0 }, expected: { answerText: '6' } }],
});

type Prop2D =
  'three-corners' | 'no-corners' | 'four-equal-sides' | 'five-sides' | 'six-sides' | 'eight-sides';
const PROP2D: Record<Prop2D, { test: (s: Shape2D) => boolean; text: LocalText }> = {
  'three-corners': {
    test: (s) => s === 'triangle',
    text: { bm: 'Bentuk mana mempunyai 3 bucu?', en: 'Which shape has 3 corners?' },
  },
  'no-corners': {
    test: (s) => s === 'circle',
    text: { bm: 'Bentuk mana tiada bucu?', en: 'Which shape has no corners?' },
  },
  'four-equal-sides': {
    test: (s) => s === 'square',
    text: {
      bm: 'Bentuk mana mempunyai 4 sisi sama panjang?',
      en: 'Which shape has 4 sides of equal length?',
    },
  },
  'five-sides': {
    test: (s) => s === 'pentagon',
    text: { bm: 'Bentuk mana mempunyai 5 sisi?', en: 'Which shape has 5 sides?' },
  },
  'six-sides': {
    test: (s) => s === 'hexagon',
    text: { bm: 'Bentuk mana mempunyai 6 sisi?', en: 'Which shape has 6 sides?' },
  },
  'eight-sides': {
    test: (s) => s === 'octagon',
    text: { bm: 'Bentuk mana mempunyai 8 sisi?', en: 'Which shape has 8 sides?' },
  },
};
const PROP2D_BY_LEVEL: Record<Level, Prop2D[]> = {
  1: ['three-corners', 'no-corners', 'four-equal-sides'],
  2: ['three-corners', 'no-corners', 'four-equal-sides', 'five-sides'],
  3: ['three-corners', 'no-corners', 'four-equal-sides', 'five-sides', 'six-sides'],
  4: ['three-corners', 'no-corners', 'four-equal-sides', 'five-sides', 'six-sides', 'eight-sides'],
};
type Match2dP = { prop: Prop2D; answer: Shape2D; wrong: Shape2D[]; colorIdx: number };
const match2d = defineTemplate<Match2dP>({
  id: 'y2-space-2d-match',
  topicId: S_TOPIC,
  widget: 'choice-tiles',
  sk: S_SK,
  scope: 'Identify 2D shapes from properties',
  levelNotes: [
    'triangle, circle, square properties',
    '+ five sides',
    '+ six sides',
    '+ eight sides',
  ],
  prerequisites: ['y2-space-2d-sides'],
  sample: (rng, level) => {
    const prop = rng.pick(PROP2D_BY_LEVEL[level]);
    const test = PROP2D[prop].test;
    const answer = rng.pick(ALL_2D.filter(test));
    const wrong = rng.shuffle(ALL_2D.filter((s) => !test(s))).slice(0, 3);
    return { prop, answer, wrong, colorIdx: rng.int(0, 5) };
  },
  build: (p, ctx) => {
    const option = (s: Shape2D) => ({
      label: text(ctx.language, SHAPE2D_NAMES[s]),
      visual: { kind: 'shape2d' as const, shape: s, color: OBJECT_COLORS[p.colorIdx] },
    });
    const { options, acceptedAnswer } = buildChoices(ctx, option(p.answer), p.wrong.map(option));
    return {
      difficultyBand: p.prop,
      widget: 'choice-tiles',
      prompt: { text: text(ctx.language, PROP2D[p.prop].text) },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Kira sisi dan bucu setiap bentuk.',
        'Count the sides and corners of each shape.',
      ),
    };
  },
  fixtures: [
    {
      params: {
        prop: 'five-sides',
        answer: 'pentagon',
        wrong: ['triangle', 'circle', 'octagon'],
        colorIdx: 1,
      },
      expected: { answerText: 'Pentagon' },
    },
  ],
});

// ---------------------------------------------------------------------------------------------
// 8.0 Data management
// ---------------------------------------------------------------------------------------------
const D_TOPIC = 'y2-data';
const D_SK = ['8.1-8.2'];

const CHART_CFG: Record<Level, { rows: number; scale: number; max: number }> = {
  1: { rows: 3, scale: 1, max: 10 },
  2: { rows: 4, scale: 2, max: 20 },
  3: { rows: 5, scale: 5, max: 50 },
  4: { rows: 5, scale: 10, max: 100 },
};
type ChartBase = { catSet: 'fruit' | 'pet'; labelIdx: number[]; values: number[] };
const CATS: Record<'fruit' | 'pet', { names: readonly LocalText[]; xTitle: LocalText }> = {
  fruit: { names: FRUITS, xTitle: { bm: 'Buah kegemaran', en: 'Favourite fruit' } },
  pet: { names: PETS, xTitle: { bm: 'Haiwan peliharaan', en: 'Pets' } },
};
const Y_TITLE: LocalText = { bm: 'Bilangan murid', en: 'Number of pupils' };

function sampleChart(
  rng: {
    int(a: number, b: number): number;
    chance(p: number): boolean;
    shuffle<T>(x: readonly T[]): T[];
  },
  level: Level,
  distinct: boolean,
): ChartBase {
  const cfg = CHART_CFG[level];
  const catSet: 'fruit' | 'pet' = rng.chance(0.5) ? 'fruit' : 'pet';
  const labelIdx = rng
    .shuffle(Array.from({ length: CATS[catSet].names.length }, (_, i) => i))
    .slice(0, cfg.rows);
  const steps = cfg.max / cfg.scale;
  const stepValues = distinct
    ? rng.shuffle(Array.from({ length: steps }, (_, i) => i + 1)).slice(0, cfg.rows)
    : Array.from({ length: cfg.rows }, () => rng.int(1, steps));
  return { catSet, labelIdx, values: stepValues.map((s) => s * cfg.scale) };
}

function chartVisual(
  ctx: { language: 'bm' | 'en' },
  level: Level,
  p: ChartBase,
  highlight?: 'x' | 'y',
) {
  const cfg = CHART_CFG[level];
  const cat = CATS[p.catSet];
  return {
    kind: 'bar-chart' as const,
    categories: p.labelIdx.map((li, i) => ({
      label: text(ctx.language, cat.names[li] as LocalText),
      value: p.values[i] as number,
      color: OBJECT_COLORS[i % OBJECT_COLORS.length],
    })),
    scale: cfg.scale,
    max: cfg.max,
    xTitle: text(ctx.language, cat.xTitle),
    yTitle: text(ctx.language, Y_TITLE),
    ...(highlight ? { highlightAxis: highlight } : {}),
  };
}

type BarReadP = ChartBase & { ask: number };
const barRead = defineTemplate<BarReadP>({
  id: 'y2-data-bar-read',
  topicId: D_TOPIC,
  widget: 'number-pad',
  sk: D_SK,
  scope: 'Read a bar chart (how many pupils chose mango?)',
  levelNotes: [
    '3 bars, scale 1, up to 10',
    '4 bars, scale 2, up to 20',
    '5 bars, scale 5, up to 50',
    '5 bars, scale 10, up to 100',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const base = sampleChart(rng, level, false);
    return { ...base, ask: rng.int(0, base.labelIdx.length - 1) };
  },
  build: (p, ctx) => {
    const visual = chartVisual(ctx, ctx.level, p);
    const row = visual.categories[p.ask];
    if (!row) throw new Error('bar-read: ask index out of range');
    return numberBuilt({
      band: `scale-${CHART_CFG[ctx.level].scale}`,
      text: tr(
        ctx,
        `Berapa murid memilih ${row.label.toLowerCase()}?`,
        `How many pupils chose ${row.label.toLowerCase()}?`,
      ),
      visual,
      answer: p.values[p.ask] as number,
      hint: tr(
        ctx,
        'Ikut hujung bar ke garisan nombor di tepi.',
        'Follow the top of the bar across to the number line.',
      ),
    });
  },
  recompute: (p) => String(p.values[p.ask]),
  fixtures: [
    {
      params: { catSet: 'fruit', labelIdx: [0, 1, 2], values: [6, 3, 9], ask: 0 },
      level: 1,
      expected: { answerText: '6' },
    },
  ],
});

type BarDiffP = ChartBase & { hi: number; lo: number };
const barDiff = defineTemplate<BarDiffP>({
  id: 'y2-data-bar-diff',
  topicId: D_TOPIC,
  widget: 'number-pad',
  sk: D_SK,
  scope: 'Find the difference between two categories on a bar chart',
  levelNotes: ['3 bars, scale 1', '4 bars, scale 2', '5 bars, scale 5', '5 bars, scale 10'],
  prerequisites: ['y2-data-bar-read'],
  arithmetic: true,
  sample: (rng, level) => {
    const base = sampleChart(rng, level, true);
    const order = base.values.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
    const hiIdx = order[0]?.[1] ?? 0;
    const loIdx = order[order.length - 1]?.[1] ?? 1;
    return { ...base, hi: hiIdx, lo: loIdx };
  },
  build: (p, ctx) => {
    const visual = chartVisual(ctx, ctx.level, p);
    const hi = visual.categories[p.hi];
    const lo = visual.categories[p.lo];
    if (!hi || !lo) throw new Error('bar-diff: index out of range');
    return numberBuilt({
      band: `scale-${CHART_CFG[ctx.level].scale}`,
      text: tr(
        ctx,
        `Berapa lebih ramai murid memilih ${hi.label.toLowerCase()} berbanding ${lo.label.toLowerCase()}?`,
        `How many more pupils chose ${hi.label.toLowerCase()} than ${lo.label.toLowerCase()}?`,
      ),
      visual,
      answer: (p.values[p.hi] as number) - (p.values[p.lo] as number),
      hint: tr(ctx, 'Baca kedua-dua bar, kemudian tolak.', 'Read both bars, then subtract.'),
    });
  },
  recompute: (p) => String((p.values[p.hi] as number) - (p.values[p.lo] as number)),
  fixtures: [
    {
      params: { catSet: 'pet', labelIdx: [0, 1, 2], values: [9, 4, 2], hi: 0, lo: 2 },
      level: 1,
      expected: { answerText: '7' },
    },
  ],
});

type BarMostP = ChartBase & { ask: 'most' | 'least' };
const barMost = defineTemplate<BarMostP>({
  id: 'y2-data-bar-most',
  topicId: D_TOPIC,
  widget: 'choice-tiles',
  sk: D_SK,
  scope: 'Answer contextual questions from a bar chart (most popular)',
  levelNotes: ['3 bars', '4 bars', '5 bars', '5 bars'],
  prerequisites: ['y2-data-bar-read'],
  sample: (rng, level) => ({
    ...sampleChart(rng, level, true),
    ask: rng.chance(0.6) ? 'most' : 'least',
  }),
  build: (p, ctx) => {
    const visual = chartVisual(ctx, ctx.level, p);
    const target = p.ask === 'most' ? Math.max(...p.values) : Math.min(...p.values);
    const targetIdx = p.values.indexOf(target);
    const labelOf = (i: number): string => (visual.categories[i] as { label: string }).label;
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: labelOf(targetIdx) },
      visual.categories
        .map((_, i) => i)
        .filter((i) => i !== targetIdx)
        .map((i) => ({ label: labelOf(i) })),
    );
    return {
      difficultyBand: `bars-${p.values.length}`,
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
        'Cari bar yang paling tinggi (atau paling rendah).',
        'Look for the tallest (or shortest) bar.',
      ),
    };
  },
  fixtures: [
    {
      params: { catSet: 'fruit', labelIdx: [0, 1, 2], values: [3, 9, 6], ask: 'most' },
      level: 1,
      expected: { answerText: 'Epal' },
    },
  ],
});

type AxesP = ChartBase & { mode: 'which' | 'shows'; axis: 'x' | 'y' };
const axes = defineTemplate<AxesP>({
  id: 'y2-data-axes',
  topicId: D_TOPIC,
  widget: 'choice-tiles',
  sk: D_SK,
  scope: 'Identify the horizontal and vertical axes',
  levelNotes: [
    'which axis is marked (3 bars)',
    'which axis is marked (4 bars)',
    'what an axis shows (5 bars)',
    'what an axis shows (5 bars)',
  ],
  sample: (rng, level) => ({
    ...sampleChart(rng, level, false),
    mode: level <= 2 ? 'which' : 'shows',
    axis: rng.chance(0.5) ? 'x' : 'y',
  }),
  build: (p, ctx) => {
    const cat = CATS[p.catSet];
    if (p.mode === 'which') {
      const horizontal = tr(ctx, 'Paksi mendatar', 'Horizontal axis');
      const vertical = tr(ctx, 'Paksi menegak', 'Vertical axis');
      const { options, acceptedAnswer } = buildChoices(
        ctx,
        { label: p.axis === 'x' ? horizontal : vertical },
        [{ label: p.axis === 'x' ? vertical : horizontal }],
      );
      return {
        difficultyBand: 'which-axis',
        widget: 'choice-tiles',
        prompt: {
          text: tr(
            ctx,
            'Paksi yang ditunjukkan anak panah ialah?',
            'Which axis does the arrow show?',
          ),
          visual: chartVisual(ctx, ctx.level, p, p.axis),
        },
        options,
        acceptedAnswer,
        hint: tr(
          ctx,
          'Mendatar: kiri ke kanan. Menegak: atas ke bawah.',
          'Horizontal: left to right. Vertical: up and down.',
        ),
      };
    }
    const xTitle = text(ctx.language, cat.xTitle);
    const yTitle = text(ctx.language, Y_TITLE);
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: p.axis === 'x' ? xTitle : yTitle },
      [{ label: p.axis === 'x' ? yTitle : xTitle }],
    );
    return {
      difficultyBand: 'axis-meaning',
      widget: 'choice-tiles',
      prompt: {
        text:
          p.axis === 'x'
            ? tr(ctx, 'Paksi mendatar menunjukkan apa?', 'What does the horizontal axis show?')
            : tr(ctx, 'Paksi menegak menunjukkan apa?', 'What does the vertical axis show?'),
        visual: chartVisual(ctx, ctx.level, p),
      },
      options,
      acceptedAnswer,
      hint: tr(ctx, 'Baca tajuk di sebelah paksi.', 'Read the title beside the axis.'),
    };
  },
  fixtures: [
    {
      params: { catSet: 'fruit', labelIdx: [0, 1, 2], values: [3, 5, 2], mode: 'which', axis: 'x' },
      level: 1,
      expected: { answerText: 'Paksi mendatar' },
    },
  ],
});

export const Y2_SPACE_TEMPLATES: QuestionTemplate[] = [props3d, net, sides, match2d];
export const Y2_DATA_TEMPLATES: QuestionTemplate[] = [barRead, barDiff, barMost, axes];
