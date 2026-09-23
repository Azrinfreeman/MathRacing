import type { Rng } from '../../game/core/SeededRng';
import type { Level, QuestionTemplate } from '../schema';
import { numberToWords } from '../text/vocab';
import { bandWithin, numberBuilt, orderBuilt } from './builders';
import { buildChoices, defineTemplate, tr } from './helpers';

const TOPIC = 'y2-numbers';
const SK = ['1.1-1.5'];

/** Upper bound of the number range for Year 2 number topics. */
const Y2_MAX: Record<Level, number> = { 1: 100, 2: 300, 3: 600, 4: 1000 };
const Y2_MIN: Record<Level, number> = { 1: 21, 2: 101, 3: 301, 4: 601 };
const ORDER_MIN: Record<Level, number> = { 1: 11, 2: 101, 3: 101, 4: 101 };

function digitsOf(n: number): number[] {
  return String(n).split('').map(Number);
}

/** Plausible wrong numerals for a target: digit swaps, neighbours by 1/10/100. */
function numeralDistractors(rng: Rng, n: number, max: number): number[] {
  const d = digitsOf(n);
  const cands = new Set<number>();
  if (d.length === 3) {
    const [h, t, o] = d as [number, number, number];
    cands.add(t * 100 + h * 10 + o);
    cands.add(h * 100 + o * 10 + t);
    cands.add(o * 100 + t * 10 + h);
  } else if (d.length === 2) {
    const [t, o] = d as [number, number];
    cands.add(o * 10 + t);
  }
  for (const delta of [10, -10, 100, -100, 1, -1]) cands.add(n + delta);
  const list = [...cands].filter((c) => c >= 1 && c <= max && c !== n);
  const picked = rng.shuffle(list).slice(0, 3);
  for (let fill = 1; picked.length < 3 && fill < 50; fill++) {
    const c = n + fill * 7;
    if (c <= max && c !== n && !picked.includes(c)) picked.push(c);
  }
  return picked;
}

type WordsP = { n: number; wrong: number[] };
const words = defineTemplate<WordsP>({
  id: 'y2-num-words',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Name and write numbers (match 430 to words)',
  levelNotes: ['21-100', '101-300', '301-600', '601-1000'],
  sample: (rng, level) => {
    const n = rng.int(Y2_MIN[level], Y2_MAX[level]);
    return { n, wrong: numeralDistractors(rng, n, 1000) };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: String(p.n) },
      p.wrong.map((w) => ({ label: String(w) })),
    );
    return {
      difficultyBand: bandWithin(Math.max(100, Math.ceil(p.n / 100) * 100)),
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Pilih nombor yang betul.', 'Choose the correct number.'),
        expression: numberToWords(p.n, ctx.language),
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Tulis ratus, puluh dan sa satu demi satu.',
        'Write the hundreds, tens and ones one at a time.',
      ),
    };
  },
  fixtures: [
    {
      params: { n: 430, wrong: [340, 403, 330] },
      expected: { answerText: '430', expression: 'empat ratus tiga puluh' },
    },
  ],
});

type CompareP = { a: number; b: number };
const COMPARE_CLOSE: Record<Level, (rng: Rng) => CompareP> = {
  1: (rng) => ({ a: rng.int(11, 100), b: rng.int(11, 100) }),
  2: (rng) => ({ a: rng.int(101, 300), b: rng.int(101, 300) }),
  3: (rng) => {
    const h = rng.int(1, 6) * 100;
    return { a: h + rng.int(0, 99), b: h + rng.int(0, 99) };
  },
  4: (rng) => {
    const base = rng.int(1, 9) * 100 + rng.int(0, 9) * 10;
    return { a: base + rng.int(0, 9), b: base + rng.int(0, 9) };
  },
};
const compare = defineTemplate<CompareP>({
  id: 'y2-num-compare',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Compare two values (compare 294 and 315)',
  levelNotes: [
    '11-100',
    '101-300',
    '301-600, same hundreds digit',
    'same hundreds and tens digits',
  ],
  sample: (rng, level) => {
    const make = COMPARE_CLOSE[level];
    let pair = make(rng);
    // Equal pairs are allowed but rare, so "=" is a real option without being a giveaway.
    if (pair.a === pair.b && !rng.chance(0.15)) {
      for (let i = 0; i < 20 && pair.a === pair.b; i++) pair = make(rng);
    }
    return pair;
  },
  build: (p, ctx) => {
    const correct = p.a < p.b ? '<' : p.a > p.b ? '>' : '=';
    const wrong = ['<', '>', '='].filter((s) => s !== correct);
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: correct },
      wrong.map((label) => ({ label })),
    );
    return {
      difficultyBand: bandWithin(
        Math.max(p.a, p.b) <= 100 ? 100 : Math.max(p.a, p.b) <= 300 ? 300 : 1000,
      ),
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Pilih simbol yang betul.', 'Choose the correct symbol.'),
        expression: `${p.a} ? ${p.b}`,
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Bandingkan digit ratus dahulu, kemudian puluh.',
        'Compare the hundreds first, then the tens.',
      ),
    };
  },
  fixtures: [
    { params: { a: 294, b: 315 }, expected: { answerText: '<', expression: '294 ? 315' } },
  ],
});

type OrderP = { values: number[]; dir: 'asc' | 'desc' };
const ORDER_COUNT: Record<Level, number> = { 1: 3, 2: 3, 3: 4, 4: 4 };
const order = defineTemplate<OrderP>({
  id: 'y2-num-order',
  topicId: TOPIC,
  widget: 'order-strip',
  sk: SK,
  scope: 'Ascending and descending order',
  levelNotes: [
    '3 numbers within 100',
    '3 numbers within 300',
    '4 numbers within 600',
    '4 numbers within 1000',
  ],
  sample: (rng, level) => {
    const set = new Set<number>();
    while (set.size < ORDER_COUNT[level]) set.add(rng.int(ORDER_MIN[level], Y2_MAX[level]));
    return { values: [...set], dir: rng.chance(0.5) ? 'asc' : 'desc' };
  },
  build: (p, ctx) => {
    const sorted = p.values.slice().sort((a, b) => (p.dir === 'asc' ? a - b : b - a));
    return orderBuilt(ctx, {
      band: bandWithin(Y2_MAX[ctx.level]),
      text:
        p.dir === 'asc'
          ? tr(ctx, 'Susun tertib menaik.', 'Order from smallest to largest.')
          : tr(ctx, 'Susun tertib menurun.', 'Order from largest to smallest.'),
      cards: sorted.map((v) => ({ id: `n${v}`, label: String(v) })),
      hint: tr(ctx, 'Bandingkan digit ratus dahulu.', 'Compare the hundreds digit first.'),
    });
  },
  fixtures: [
    {
      params: { values: [315, 294, 430], dir: 'asc' },
      expected: { answerText: '294 > 315 > 430' },
    },
  ],
});

type PlaceP = { n: number; pos: 0 | 1 | 2; mode: 'value' | 'digit' };
const PLACE_RANGE: Record<Level, [number, number]> = {
  1: [11, 99],
  2: [101, 300],
  3: [301, 600],
  4: [101, 999],
};
const placeValue = defineTemplate<PlaceP>({
  id: 'y2-num-place-value',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Place value and digit value (decompose 136)',
  levelNotes: ['11-99', '101-300', '301-600', '101-999, value or digit'],
  arithmetic: true,
  sample: (rng, level) => {
    const [lo, hi] = PLACE_RANGE[level];
    for (let i = 0; i < 400; i++) {
      const n = rng.int(lo, hi);
      const ds = digitsOf(n);
      // Every digit distinct (so "digit 3" is unambiguous) and non-zero (a zero digit has no interesting value).
      if (new Set(ds).size !== ds.length || ds.includes(0)) continue;
      const pos = rng.int(0, ds.length - 1) as 0 | 1 | 2;
      const mode: 'value' | 'digit' = level === 4 && rng.chance(0.5) ? 'digit' : 'value';
      return { n, pos, mode };
    }
    return { n: level === 1 ? 46 : 136, pos: 1, mode: 'value' };
  },
  build: (p, ctx) => {
    const ds = digitsOf(p.n);
    const digit = ds[ds.length - 1 - p.pos] as number;
    const placeName = [
      tr(ctx, 'sa', 'ones'),
      tr(ctx, 'puluh', 'tens'),
      tr(ctx, 'ratus', 'hundreds'),
    ][p.pos] as string;
    const value = digit * 10 ** p.pos;
    return numberBuilt({
      band: bandWithin(p.n <= 100 ? 100 : p.n <= 300 ? 300 : 1000),
      text:
        p.mode === 'value'
          ? tr(
              ctx,
              `Nilai digit ${digit} dalam ${p.n}?`,
              `What is the value of the digit ${digit} in ${p.n}?`,
            )
          : tr(
              ctx,
              `Digit tempat ${placeName} dalam ${p.n}?`,
              `Which digit is in the ${placeName} place of ${p.n}?`,
            ),
      expression: String(p.n),
      answer: p.mode === 'value' ? value : digit,
      hint: tr(ctx, 'Tempat digit menentukan nilainya.', 'The place of a digit decides its value.'),
    });
  },
  recompute: (p) => {
    const ds = String(p.n).split('').map(Number);
    const digit = ds[ds.length - 1 - p.pos] as number;
    return String(p.mode === 'value' ? digit * 10 ** p.pos : digit);
  },
  fixtures: [
    {
      params: { n: 136, pos: 1, mode: 'value' },
      expected: { answerText: '30', expression: '136' },
    },
  ],
});

type BuildP = { n: number };
const BUILD_RANGE: Record<Level, [number, number]> = {
  1: [21, 99],
  2: [101, 300],
  3: [301, 600],
  4: [601, 999],
};
const buildNumber = defineTemplate<BuildP>({
  id: 'y2-num-build',
  topicId: TOPIC,
  widget: 'build-value',
  sk: SK,
  scope: 'Build 136 with place-value blocks',
  levelNotes: ['21-99', '101-300', '301-600', '601-999 (digit sum at most 16)'],
  arithmetic: true,
  sample: (rng, level) => {
    const [lo, hi] = BUILD_RANGE[level];
    for (let i = 0; i < 400; i++) {
      const n = rng.int(lo, hi);
      if (digitsOf(n).reduce((s, d) => s + d, 0) <= 16) return { n };
    }
    return { n: lo };
  },
  build: (p, ctx) => ({
    difficultyBand: bandWithin(p.n <= 100 ? 100 : p.n <= 300 ? 300 : 1000),
    widget: 'build-value',
    prompt: {
      text: tr(ctx, 'Bina nombor ini dengan blok.', 'Build this number with blocks.'),
      expression: String(p.n),
    },
    options: [
      ...(p.n >= 100
        ? [{ id: 'h', label: tr(ctx, '100 (ratus)', '100 (hundreds)'), value: 100 }]
        : []),
      { id: 't', label: tr(ctx, '10 (puluh)', '10 (tens)'), value: 10 },
      { id: 'o', label: tr(ctx, '1 (sa)', '1 (ones)'), value: 1 },
    ],
    acceptedAnswer: { kind: 'number', value: String(p.n) },
    widgetConfig: { totalUnit: 'plain' },
    hint: tr(
      ctx,
      'Guna blok ratus dahulu, kemudian puluh, kemudian sa.',
      'Use hundreds first, then tens, then ones.',
    ),
  }),
  recompute: (p) => String(p.n),
  fixtures: [{ params: { n: 136 }, expected: { answerText: '136', expression: '136' } }],
});

type PatternP = { start: number; step: number; dir: 1 | -1; hole: number };
const PATTERN_CFG: Record<Level, { steps: number[]; max: number }> = {
  1: { steps: [2, 5, 10], max: 100 },
  2: { steps: [5, 10, 20], max: 300 },
  3: { steps: [10, 20, 50, 100], max: 600 },
  4: { steps: [10, 20, 50, 100], max: 1000 },
};
const pattern = defineTemplate<PatternP>({
  id: 'y2-num-pattern',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Number patterns (complete a sequence)',
  levelNotes: [
    'steps 2, 5, 10 within 100',
    'steps 5, 10, 20 within 300',
    'steps 10, 20, 50, 100 within 600',
    'steps 10, 20, 50, 100 within 1000',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = PATTERN_CFG[level];
    const step = rng.pick(cfg.steps);
    const dir: 1 | -1 = rng.chance(0.4) ? -1 : 1;
    const span = step * 4;
    const lo = dir === 1 ? step : span + step;
    const hi = dir === 1 ? cfg.max - span : cfg.max;
    const kLo = Math.ceil(lo / step);
    const kHi = Math.max(kLo, Math.floor(hi / step));
    return { start: step * rng.int(kLo, kHi), step, dir, hole: rng.int(1, 4) };
  },
  build: (p, ctx) => {
    const terms = Array.from({ length: 5 }, (_, i) => p.start + p.dir * p.step * i);
    const shown = terms.map((t, i) => (i === p.hole ? '__' : String(t))).join(', ');
    return numberBuilt({
      band: bandWithin(PATTERN_CFG[ctx.level].max),
      text: tr(ctx, 'Sambung corak nombor.', 'Complete the number pattern.'),
      expression: shown,
      answer: terms[p.hole] as number,
      hint: tr(
        ctx,
        'Cari beza antara dua nombor bersebelahan.',
        'Find the difference between neighbouring numbers.',
      ),
    });
  },
  recompute: (p) => String(p.start + p.dir * p.step * p.hole),
  fixtures: [
    {
      params: { start: 100, step: 100, dir: 1, hole: 2 },
      expected: { answerText: '300', expression: '100, 200, __, 400, 500' },
    },
  ],
});

type NearestP = { n: number; unit: 10 | 100; target: number; others: number[] };
const nearest = defineTemplate<NearestP>({
  id: 'y2-num-estimate',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Reasonable estimation (estimate against 100)',
  levelNotes: [
    'nearest of three tens within 100',
    'nearest of three tens within 300',
    'nearest of three hundreds within 600',
    'nearest of three hundreds within 1000',
  ],
  sample: (rng, level) => {
    const unit: 10 | 100 = level <= 2 ? 10 : 100;
    const max = Y2_MAX[level];
    const kMax = Math.floor(max / unit);
    const target = unit * rng.int(2, kMax - 1);
    const offset = rng.int(1, Math.floor(unit * 0.3));
    const n = target + (rng.chance(0.5) ? offset : -offset);
    const others = rng
      .shuffle(
        [target - unit, target + unit, target + 2 * unit, target - 2 * unit].filter(
          (v) => v >= unit && v <= max,
        ),
      )
      .slice(0, 2);
    return { n, unit, target, others };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: String(p.target) },
      p.others.map((o) => ({ label: String(o) })),
    );
    return {
      difficultyBand: `nearest-${p.unit}`,
      widget: 'choice-tiles',
      prompt: {
        text: tr(
          ctx,
          `${p.n} hampir dengan nombor yang mana?`,
          `Which number is ${p.n} closest to?`,
        ),
        expression: String(p.n),
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Letakkan nombor pada garis nombor. Yang mana paling dekat?',
        'Picture the number on a number line. Which is nearest?',
      ),
    };
  },
  fixtures: [
    {
      params: { n: 98, unit: 10, target: 100, others: [80, 120] },
      expected: { answerText: '100', expression: '98' },
    },
  ],
});

type RoundP = { n: number; unit: 10 | 100 };
const roundTemplate = defineTemplate<RoundP>({
  id: 'y2-num-round',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Round to the nearest ten and hundred (round 347)',
  levelNotes: [
    'nearest ten, 11-99, no ties',
    'nearest ten, 101-999, no ties',
    'nearest hundred, 101-999, no ties',
    'nearest ten or hundred, ties included (5 rounds up)',
  ],
  prerequisites: ['y2-num-place-value'],
  arithmetic: true,
  sample: (rng, level) => {
    const unit: 10 | 100 =
      level === 1 || level === 2 ? 10 : level === 3 ? 100 : rng.chance(0.5) ? 10 : 100;
    const lo = level === 1 ? 11 : 101;
    const hi = level === 1 ? 99 : 999;
    for (let i = 0; i < 400; i++) {
      const n = rng.int(lo, hi);
      const tie = n % unit === unit / 2;
      if (unit === 10 && n % 10 === 0) continue;
      if (unit === 100 && n % 100 === 0) continue;
      if (tie && level < 4) continue;
      return { n, unit };
    }
    return { n: 347, unit: 10 };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: p.unit === 10 ? 'nearest-ten' : 'nearest-hundred',
      text:
        p.unit === 10
          ? tr(ctx, 'Bundarkan kepada puluh terdekat.', 'Round to the nearest ten.')
          : tr(ctx, 'Bundarkan kepada ratus terdekat.', 'Round to the nearest hundred.'),
      expression: String(p.n),
      answer: Math.floor((p.n + p.unit / 2) / p.unit) * p.unit,
      hint: tr(
        ctx,
        'Lihat digit di sebelah kanan. 5 dan ke atas: bundar ke atas.',
        'Look at the digit to the right. 5 or more: round up.',
      ),
    }),
  recompute: (p) => String(Math.round((p.n + 1e-9) / p.unit) * p.unit),
  fixtures: [{ params: { n: 347, unit: 10 }, expected: { answerText: '350', expression: '347' } }],
});

export const Y2_NUMBER_TEMPLATES: QuestionTemplate[] = [
  words,
  compare,
  order,
  placeValue,
  buildNumber,
  pattern,
  nearest,
  roundTemplate,
];
