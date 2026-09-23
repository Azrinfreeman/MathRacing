import type { Level, QuestionTemplate } from '../schema';
import type { ObjectShape } from '../visual';
import { OBJECT_COLORS } from '../text/vocab';
import { Y1_MAX, bandWithin, numberBuilt, orderBuilt, tapBuilt } from './builders';
import { buildChoices, defineTemplate, tr } from './helpers';

const TOPIC = 'y1-numbers';
const SK = ['1.1-1.5'];
const SHAPES: ObjectShape[] = ['circle', 'star', 'square', 'triangle', 'diamond', 'heart'];

const COUNT_RANGE: Record<Level, [number, number]> = {
  1: [1, 5],
  2: [3, 10],
  3: [8, 15],
  4: [11, 20],
};

type CountP = { count: number; shape: ObjectShape; colorIdx: number };
const countObjects = defineTemplate<CountP>({
  id: 'y1-num-count-objects',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Name, count and write numbers (count objects)',
  levelNotes: ['1-5 objects', '3-10 objects', '8-15 objects', '11-20 objects'],
  arithmetic: true,
  sample: (rng, level) => {
    const [lo, hi] = COUNT_RANGE[level];
    return {
      count: rng.int(lo, hi),
      shape: rng.pick(SHAPES),
      colorIdx: rng.int(0, OBJECT_COLORS.length - 1),
    };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: bandWithin(COUNT_RANGE[ctx.level][1]),
      text: tr(ctx, 'Berapa bilangan?', 'How many?'),
      visual: {
        kind: 'objects',
        groups: [{ count: p.count, shape: p.shape, color: OBJECT_COLORS[p.colorIdx] ?? '#2e86de' }],
      },
      answer: p.count,
      hint: tr(ctx, 'Kira satu demi satu. Sentuh setiap satu dalam fikiran.', 'Count one by one.'),
    }),
  recompute: (p) => String(p.count),
  fixtures: [{ params: { count: 7, shape: 'circle', colorIdx: 0 }, expected: { answerText: '7' } }],
});

type CompareGroupsP = {
  a: number;
  b: number;
  ask: 'more' | 'fewer';
  colorA: number;
  colorB: number;
};
const GROUP_MAX: Record<Level, number> = { 1: 6, 2: 10, 3: 15, 4: 20 };
const GROUP_MIN_DIFF: Record<Level, number> = { 1: 3, 2: 2, 3: 2, 4: 1 };
const compareGroups = defineTemplate<CompareGroupsP>({
  id: 'y1-num-compare-groups',
  topicId: TOPIC,
  widget: 'tap-picture',
  sk: SK,
  scope: 'Compare quantities; compare groups (tap the larger group)',
  levelNotes: [
    'counts 1-6, difference at least 3',
    'counts 1-10, difference at least 2',
    'counts 1-15, difference at least 2',
    'counts 1-20, difference at least 1',
  ],
  sample: (rng, level) => {
    const max = GROUP_MAX[level];
    let a: number;
    let b: number;
    let guard = 0;
    do {
      a = rng.int(1, max);
      b = rng.int(1, max);
      guard++;
    } while (Math.abs(a - b) < GROUP_MIN_DIFF[level] && guard < 200);
    if (Math.abs(a - b) < GROUP_MIN_DIFF[level]) {
      a = 1;
      b = Math.min(max, 1 + GROUP_MIN_DIFF[level]);
    }
    return {
      a,
      b,
      ask: rng.chance(0.5) ? 'more' : 'fewer',
      colorA: rng.int(0, 2),
      colorB: rng.int(3, 5),
    };
  },
  build: (p, ctx) => {
    const wantG1 = p.ask === 'more' ? p.a > p.b : p.a < p.b;
    return tapBuilt({
      band: bandWithin(GROUP_MAX[ctx.level]),
      text:
        p.ask === 'more'
          ? tr(ctx, 'Ketik kumpulan yang lebih banyak.', 'Tap the group with more.')
          : tr(ctx, 'Ketik kumpulan yang lebih sedikit.', 'Tap the group with fewer.'),
      options: [
        {
          id: 'g1',
          visual: {
            kind: 'objects',
            groups: [{ count: p.a, shape: 'circle', color: OBJECT_COLORS[p.colorA] ?? '#e4572e' }],
          },
        },
        {
          id: 'g2',
          visual: {
            kind: 'objects',
            groups: [{ count: p.b, shape: 'circle', color: OBJECT_COLORS[p.colorB] ?? '#0aa5a5' }],
          },
        },
      ],
      acceptedAnswer: { kind: 'choice', optionId: wantG1 ? 'g1' : 'g2' },
      multi: false,
      columns: 2,
      hint: tr(
        ctx,
        'Kira setiap kumpulan, kemudian bandingkan.',
        'Count each group, then compare.',
      ),
    });
  },
  // Picture options carry no label, so the answer text is the description of the correct picture.
  fixtures: [
    {
      params: { a: 3, b: 8, ask: 'more', colorA: 0, colorB: 3 },
      expected: { answerText: '8 circle' },
    },
  ],
});

type CompareValuesP = { values: number[]; ask: 'largest' | 'smallest' };
const compareValues = defineTemplate<CompareValuesP>({
  id: 'y1-num-compare-values',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Compare quantities; name and compare numbers',
  levelNotes: ['numbers 1-10', 'numbers 1-20', 'numbers 1-50', 'numbers 1-100'],
  sample: (rng, level) => {
    const max = Y1_MAX[level];
    const set = new Set<number>();
    while (set.size < 3) set.add(rng.int(1, max));
    return { values: [...set], ask: rng.chance(0.5) ? 'largest' : 'smallest' };
  },
  build: (p, ctx) => {
    const target = p.ask === 'largest' ? Math.max(...p.values) : Math.min(...p.values);
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: String(target) },
      p.values.filter((v) => v !== target).map((v) => ({ label: String(v) })),
    );
    return {
      difficultyBand: bandWithin(Y1_MAX[ctx.level]),
      widget: 'choice-tiles',
      prompt: {
        text:
          p.ask === 'largest'
            ? tr(ctx, 'Nombor yang paling besar?', 'Which number is the largest?')
            : tr(ctx, 'Nombor yang paling kecil?', 'Which number is the smallest?'),
      },
      options,
      acceptedAnswer,
      hint: tr(ctx, 'Lihat digit puluh dahulu.', 'Look at the tens digit first.'),
    };
  },
  fixtures: [{ params: { values: [14, 9, 31], ask: 'largest' }, expected: { answerText: '31' } }],
});

type TensOnesP = { n: number; ask: 'tens' | 'ones' };
const TENS_RANGE: Record<Level, [number, number]> = {
  1: [10, 20],
  2: [21, 50],
  3: [51, 99],
  4: [21, 99],
};
const tensOnes = defineTemplate<TensOnesP>({
  id: 'y1-num-tens-ones',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Place value and digit value (tens and ones)',
  levelNotes: ['10-20', '21-50', '51-99', '21-99'],
  arithmetic: true,
  sample: (rng, level) => {
    const [lo, hi] = TENS_RANGE[level];
    return { n: rng.int(lo, hi), ask: rng.chance(0.5) ? 'tens' : 'ones' };
  },
  build: (p, ctx) => {
    const tens = Math.floor(p.n / 10);
    const ones = p.n % 10;
    const expr =
      p.ask === 'tens'
        ? `${p.n} = ? ${tr(ctx, 'puluh', 'tens')} ${ones} ${tr(ctx, 'sa', 'ones')}`
        : `${p.n} = ${tens} ${tr(ctx, 'puluh', 'tens')} ? ${tr(ctx, 'sa', 'ones')}`;
    return numberBuilt({
      band: bandWithin(TENS_RANGE[ctx.level][1]),
      text: tr(ctx, 'Lengkapkan.', 'Complete.'),
      expression: expr,
      answer: p.ask === 'tens' ? tens : ones,
      hint: tr(
        ctx,
        'Digit di kiri ialah puluh, digit di kanan ialah sa.',
        'The left digit is tens, the right digit is ones.',
      ),
    });
  },
  recompute: (p) => String(p.ask === 'tens' ? Math.floor(Number(p.n) / 10) : Number(p.n) % 10),
  fixtures: [
    {
      params: { n: 47, ask: 'tens' },
      expected: { answerText: '4', expression: '47 = ? puluh 7 sa' },
    },
  ],
});

type DigitValueP = { n: number; ask: 'tens' | 'ones' };
const digitValue = defineTemplate<DigitValueP>({
  id: 'y1-num-digit-value',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Place value and digit value',
  levelNotes: ['12-19', '21-50 (distinct non-zero digits)', '21-99', '21-99'],
  sample: (rng, level) => {
    const [lo, hi] = level === 1 ? [12, 19] : level === 2 ? [21, 50] : [21, 99];
    let n: number;
    let guard = 0;
    do {
      n = rng.int(lo, hi);
      guard++;
    } while ((n % 10 === 0 || Math.floor(n / 10) === n % 10) && guard < 300);
    if (n % 10 === 0 || Math.floor(n / 10) === n % 10) n = level === 1 ? 12 : 23;
    return { n, ask: rng.chance(0.5) ? 'tens' : 'ones' };
  },
  build: (p, ctx) => {
    const tens = Math.floor(p.n / 10);
    const ones = p.n % 10;
    const digit = p.ask === 'tens' ? tens : ones;
    const value = p.ask === 'tens' ? tens * 10 : ones;
    const wrong = new Set<number>([digit, tens * 10, ones, ones * 10, p.n]);
    wrong.delete(value);
    const wrongList = [...wrong].slice(0, 3);
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: String(value) },
      wrongList.map((w) => ({ label: String(w) })),
    );
    return {
      difficultyBand: bandWithin(p.n <= 20 ? 20 : p.n <= 50 ? 50 : 100),
      widget: 'choice-tiles',
      prompt: {
        text: tr(
          ctx,
          `Nilai digit ${digit} dalam ${p.n}?`,
          `What is the value of digit ${digit} in ${p.n}?`,
        ),
        expression: String(p.n),
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Digit puluh bernilai puluh-puluh, bukan satu.',
        'A tens digit is worth tens, not ones.',
      ),
    };
  },
  fixtures: [{ params: { n: 47, ask: 'tens' }, expected: { answerText: '40' } }],
});

type BuildNumP = { n: number };
const buildNumber = defineTemplate<BuildNumP>({
  id: 'y1-num-build',
  topicId: TOPIC,
  widget: 'build-value',
  sk: SK,
  scope: 'Build 47 as 4 tens + 7 ones',
  levelNotes: ['10-20', '21-50', '51-99', '21-99'],
  arithmetic: true,
  sample: (rng, level) => {
    const [lo, hi] = TENS_RANGE[level];
    return { n: rng.int(lo, hi) };
  },
  build: (p, ctx) => ({
    difficultyBand: bandWithin(TENS_RANGE[ctx.level][1]),
    widget: 'build-value',
    prompt: { text: tr(ctx, 'Bina nombor ini.', 'Build this number.'), expression: String(p.n) },
    options: [
      { id: 'tens', label: tr(ctx, '10 (puluh)', '10 (tens)'), value: 10 },
      { id: 'ones', label: tr(ctx, '1 (sa)', '1 (ones)'), value: 1 },
    ],
    acceptedAnswer: { kind: 'number', value: String(p.n) },
    widgetConfig: { totalUnit: 'plain' },
    hint: tr(
      ctx,
      'Guna blok puluh dahulu, kemudian blok sa.',
      'Use tens blocks first, then ones blocks.',
    ),
  }),
  recompute: (p) => String(p.n),
  fixtures: [{ params: { n: 47 }, expected: { answerText: '47', expression: '47' } }],
});

type PatternP = { start: number; step: number; dir: 1 | -1; hole: number };
const PATTERN_CFG: Record<Level, { steps: number[]; max: number }> = {
  1: { steps: [1], max: 10 },
  2: { steps: [1, 2], max: 20 },
  3: { steps: [2, 5, 10], max: 50 },
  4: { steps: [1, 2, 5, 10], max: 100 },
};
const numberPattern = defineTemplate<PatternP>({
  id: 'y1-num-pattern',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Number patterns in 1s, 2s, 5s and 10s (complete 25, 30, 35, __)',
  levelNotes: [
    'counting by 1 within 10',
    'steps 1, 2 within 20',
    'steps 2, 5, 10 within 50, up or down',
    'steps 1, 2, 5, 10 within 100, up or down',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = PATTERN_CFG[level];
    const step = rng.pick(cfg.steps);
    const dir: 1 | -1 = level >= 3 && rng.chance(0.4) ? -1 : 1;
    const span = step * 4; // five terms
    // Every term stays within 1..max and never reaches zero; steps of 5 and 10 start on a multiple of the step.
    const lo = dir === 1 ? step : span + step;
    const hi = dir === 1 ? cfg.max - span : cfg.max;
    let start = rng.int(lo, Math.max(lo, hi));
    if (step >= 5)
      start =
        step * rng.int(Math.ceil(lo / step), Math.max(Math.ceil(lo / step), Math.floor(hi / step)));
    return { start, step, dir, hole: rng.int(1, 4) };
  },
  build: (p, ctx) => {
    const terms = Array.from({ length: 5 }, (_, i) => p.start + p.dir * p.step * i);
    const answer = terms[p.hole] as number;
    const shown = terms.map((t, i) => (i === p.hole ? '__' : String(t))).join(', ');
    return numberBuilt({
      band: bandWithin(PATTERN_CFG[ctx.level].max),
      text: tr(ctx, 'Sambung corak nombor.', 'Complete the number pattern.'),
      expression: shown,
      answer,
      hint: tr(
        ctx,
        'Cari beza antara dua nombor bersebelahan.',
        'Find the difference between neighbouring numbers.',
      ),
    });
  },
  recompute: (p) => String(Number(p.start) + Number(p.dir) * Number(p.step) * Number(p.hole)),
  fixtures: [
    {
      params: { start: 25, step: 5, dir: 1, hole: 2 },
      expected: { answerText: '35', expression: '25, 30, __, 40, 45' },
    },
  ],
});

type OrderP = { values: number[]; dir: 'asc' | 'desc' };
const ORDER_CFG: Record<Level, { count: number; max: number }> = {
  1: { count: 3, max: 10 },
  2: { count: 3, max: 20 },
  3: { count: 4, max: 50 },
  4: { count: 4, max: 100 },
};
const orderNumbers = defineTemplate<OrderP>({
  id: 'y1-num-order',
  topicId: TOPIC,
  widget: 'order-strip',
  sk: SK,
  scope: 'Compare and order numbers',
  levelNotes: [
    '3 numbers within 10',
    '3 numbers within 20',
    '4 numbers within 50',
    '4 numbers within 100',
  ],
  sample: (rng, level) => {
    const cfg = ORDER_CFG[level];
    const set = new Set<number>();
    while (set.size < cfg.count) set.add(rng.int(1, cfg.max));
    return { values: [...set], dir: rng.chance(0.5) ? 'asc' : 'desc' };
  },
  build: (p, ctx) => {
    const sorted = p.values.slice().sort((a, b) => (p.dir === 'asc' ? a - b : b - a));
    return orderBuilt(ctx, {
      band: bandWithin(ORDER_CFG[ctx.level].max),
      text:
        p.dir === 'asc'
          ? tr(ctx, 'Susun dari kecil ke besar.', 'Order from smallest to largest.')
          : tr(ctx, 'Susun dari besar ke kecil.', 'Order from largest to smallest.'),
      cards: sorted.map((v) => ({ id: `n${v}`, label: String(v) })),
      hint: tr(ctx, 'Cari nombor paling kecil dahulu.', 'Find the smallest number first.'),
    });
  },
  fixtures: [
    { params: { values: [30, 10, 20], dir: 'asc' }, expected: { answerText: '10 > 20 > 30' } },
  ],
});

type ComboP = { total: number; a: number };
const COMBO_TOTAL: Record<Level, [number, number]> = {
  1: [3, 6],
  2: [7, 10],
  3: [11, 14],
  4: [15, 18],
};
const combination = defineTemplate<ComboP>({
  id: 'y1-num-combination',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'One-digit number combinations (choose pairs that make 8)',
  levelNotes: [
    'totals 3-6',
    'totals 7-10',
    'totals 11-14 (one-digit parts)',
    'totals 15-18 (one-digit parts)',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const [lo, hi] = COMBO_TOTAL[level];
    const total = rng.int(lo, hi);
    return { total, a: rng.int(Math.max(1, total - 9), Math.min(9, total - 1)) };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: bandWithin(COMBO_TOTAL[ctx.level][1] <= 10 ? 10 : 20),
      text: tr(ctx, 'Cari nombor yang hilang.', 'Find the missing number.'),
      expression: `${p.a} + ? = ${p.total}`,
      answer: p.total - p.a,
      hint: tr(
        ctx,
        'Berapa lagi diperlukan untuk sampai ke jumlah?',
        'How many more to reach the total?',
      ),
    }),
  recompute: (p) => String(Number(p.total) - Number(p.a)),
  fixtures: [
    { params: { total: 8, a: 3 }, expected: { answerText: '5', expression: '3 + ? = 8' } },
  ],
});

export const Y1_NUMBER_TEMPLATES: QuestionTemplate[] = [
  countObjects,
  compareGroups,
  compareValues,
  tensOnes,
  digitValue,
  buildNumber,
  numberPattern,
  orderNumbers,
  combination,
];
