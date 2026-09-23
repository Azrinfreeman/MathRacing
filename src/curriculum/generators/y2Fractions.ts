import type { Rng } from '../../game/core/SeededRng';
import type { Level, QuestionTemplate } from '../schema';
import { tapBuilt } from './builders';
import { buildChoices, defineTemplate, tr } from './helpers';

const TOPIC = 'y2-fractions';
const SK = ['3.1-3.3'];

type Frac = [number, number]; // [numerator, denominator]

const MAX_DEN: Record<Level, number> = { 1: 4, 2: 5, 3: 8, 4: 10 };
const DEN_POOL: Record<Level, number[]> = {
  1: [2, 4],
  2: [2, 3, 4, 5],
  3: [3, 4, 5, 6, 8],
  4: [5, 6, 7, 8, 9, 10],
};

/** a/b and c/d are equal in value (exact integer cross-multiplication, no floats). */
export function sameValue(a: Frac, b: Frac): boolean {
  return a[0] * b[1] === b[0] * a[1];
}

function label(f: Frac): string {
  return `${f[0]}/${f[1]}`;
}

/** Proper fractions with a denominator up to `maxDen`. */
function properFractions(maxDen: number): Frac[] {
  const out: Frac[] = [];
  for (let d = 2; d <= maxDen; d++) for (let n = 1; n < d; n++) out.push([n, d]);
  return out;
}

/** Three wrong fractions, none equal in value to the answer or to each other; near-confusions first. */
function fractionDistractors(rng: Rng, answer: Frac, maxDen: number): Frac[] {
  const all = properFractions(maxDen).filter((f) => !sameValue(f, answer));
  const near = rng.shuffle(all.filter((f) => f[1] === answer[1] || f[0] === answer[0]));
  const far = rng.shuffle(all.filter((f) => !(f[1] === answer[1] || f[0] === answer[0])));
  const picked: Frac[] = [];
  for (const f of [...near, ...far]) {
    if (picked.length >= 3) break;
    if (picked.every((p) => !sameValue(p, f))) picked.push(f);
  }
  return picked;
}

type NameP = { num: number; den: number; style: 'bar' | 'pie'; wrong: Frac[] };
const name = defineTemplate<NameP>({
  id: 'y2-frac-name',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Halves, quarters and proper fractions with denominator up to 10 (shade 3/4)',
  levelNotes: ['halves and quarters', 'denominators 2-5', 'denominators 3-8', 'denominators 5-10'],
  sample: (rng, level) => {
    const den = rng.pick(DEN_POOL[level]);
    const num = rng.int(1, den - 1);
    return {
      num,
      den,
      style: den <= 8 && rng.chance(0.5) ? 'pie' : 'bar',
      wrong: fractionDistractors(rng, [num, den], MAX_DEN[level]),
    };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: label([p.num, p.den]) },
      p.wrong.map((f) => ({ label: label(f) })),
    );
    return {
      difficultyBand: `den-${p.den}`,
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Pecahan manakah yang diwarnakan?', 'Which fraction is shaded?'),
        visual: {
          kind: 'fraction',
          numerator: p.num,
          denominator: p.den,
          style: p.style,
          shaded: Array.from({ length: p.num }, (_, i) => i),
        },
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Kira bahagian berwarna, kemudian semua bahagian.',
        'Count the shaded parts, then all the parts.',
      ),
    };
  },
  fixtures: [
    {
      params: {
        num: 3,
        den: 4,
        style: 'bar',
        wrong: [
          [1, 4],
          [1, 3],
          [2, 3],
        ],
      },
      expected: { answerText: '3/4' },
    },
  ],
});

type ShadeP = { num: number; den: number };
const SHADE_POOL: Record<Level, number[]> = {
  1: [2, 4],
  2: [2, 3, 4],
  3: [3, 4, 5, 6, 8],
  4: [5, 6, 7, 8],
};
const shade = defineTemplate<ShadeP>({
  id: 'y2-frac-shade',
  topicId: TOPIC,
  widget: 'tap-picture',
  sk: SK,
  scope: 'Represent fractions (shade 3/4)',
  levelNotes: ['halves and quarters', 'denominators 2-4', 'denominators 3-8', 'denominators 5-8'],
  prerequisites: ['y2-frac-name'],
  sample: (rng, level) => {
    const den = rng.pick(SHADE_POOL[level]);
    return { num: rng.int(1, den - 1), den };
  },
  build: (p, ctx) =>
    tapBuilt({
      band: `den-${p.den}`,
      text: tr(
        ctx,
        `Ketik ${p.num} daripada ${p.den} bahagian yang sama.`,
        `Tap ${p.num} of the ${p.den} equal parts.`,
      ),
      expression: label([p.num, p.den]),
      options: Array.from({ length: p.den }, (_, i) => ({
        id: `p${i}`,
        visual: { kind: 'shape2d' as const, shape: 'rectangle' as const, color: '#d7e3f4' },
      })),
      acceptedAnswer: { kind: 'count', count: p.num },
      multi: true,
      columns: p.den <= 4 ? p.den : Math.ceil(p.den / 2),
      hint: tr(
        ctx,
        'Pengangka ialah bilangan bahagian yang diwarnakan.',
        'The top number is how many parts to shade.',
      ),
    }),
  fixtures: [{ params: { num: 3, den: 4 }, expected: { answerText: 'any 3', expression: '3/4' } }],
});

type CompareP = { a: Frac; b: Frac; ask: 'larger' | 'smaller' };
function sampleComparePair(rng: Rng, level: Level): [Frac, Frac] {
  for (let i = 0; i < 500; i++) {
    let a: Frac;
    let b: Frac;
    if (level <= 2) {
      const d = rng.pick(level === 1 ? [4, 5] : [5, 6, 8]);
      a = [rng.int(1, d - 1), d];
      b = [rng.int(1, d - 1), d];
    } else if (level === 3) {
      const n = rng.int(1, 3);
      const d1 = rng.int(n + 1, 8);
      const d2 = rng.int(n + 1, 8);
      a = [n, d1];
      b = [n, d2];
    } else {
      const d1 = rng.int(2, 8);
      const d2 = rng.int(2, 8);
      a = [rng.int(1, d1 - 1), d1];
      b = [rng.int(1, d2 - 1), d2];
    }
    if (!sameValue(a, b) && Math.abs(a[0] / a[1] - b[0] / b[1]) >= (level === 4 ? 0.12 : 0.1))
      return [a, b];
  }
  return [
    [1, 4],
    [3, 4],
  ];
}
const compareFractions = defineTemplate<CompareP>({
  id: 'y2-frac-compare',
  topicId: TOPIC,
  widget: 'tap-picture',
  sk: SK,
  scope: 'Compare fractions (choose the larger fraction)',
  levelNotes: [
    'same denominator 4 or 5',
    'same denominator 5, 6 or 8',
    'same numerator, different denominators',
    'different numerators and denominators, difference at least 0.12',
  ],
  prerequisites: ['y2-frac-name'],
  sample: (rng, level) => {
    const [a, b] = sampleComparePair(rng, level);
    return { a, b, ask: rng.chance(0.5) ? 'larger' : 'smaller' };
  },
  build: (p, ctx) => {
    const aValue = p.a[0] / p.a[1];
    const bValue = p.b[0] / p.b[1];
    const aWins = p.ask === 'larger' ? aValue > bValue : aValue < bValue;
    const bar = (f: Frac) => ({
      kind: 'fraction' as const,
      numerator: f[0],
      denominator: f[1],
      style: 'bar' as const,
      shaded: Array.from({ length: f[0] }, (_, i) => i),
    });
    return tapBuilt({
      band: 'compare',
      text:
        p.ask === 'larger'
          ? tr(ctx, 'Ketik pecahan yang lebih besar.', 'Tap the larger fraction.')
          : tr(ctx, 'Ketik pecahan yang lebih kecil.', 'Tap the smaller fraction.'),
      options: [
        { id: 'a', visual: bar(p.a) },
        { id: 'b', visual: bar(p.b) },
      ],
      acceptedAnswer: { kind: 'choice', optionId: aWins ? 'a' : 'b' },
      multi: false,
      columns: 1,
      hint: tr(
        ctx,
        'Bandingkan bahagian berwarna dalam kedua-dua bar.',
        'Compare the shaded parts of the two bars.',
      ),
    });
  },
  fixtures: [
    {
      params: { a: [1, 4], b: [3, 4], ask: 'larger' },
      expected: { answerText: 'fraction 3/4 bar' },
    },
  ],
});

const dec = (k: number): string => `0.${k}`;

type DecMatchP = { k: number; dir: 'frac-to-dec' | 'dec-to-frac'; wrong: string[] };
const decMatch = defineTemplate<DecMatchP>({
  id: 'y2-frac-decimal-match',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Tenths as decimals 0.1 to 0.9 (match 7/10 to 0.7)',
  levelNotes: [
    'fraction to decimal, other tenths as distractors',
    'decimal to fraction, other tenths',
    'fraction to decimal with 0.0k and k.0 distractors',
    'either direction with common misconceptions',
  ],
  sample: (rng, level) => {
    const k = rng.int(1, 9);
    const dir: 'frac-to-dec' | 'dec-to-frac' =
      level === 1 || level === 3
        ? 'frac-to-dec'
        : level === 2
          ? 'dec-to-frac'
          : rng.chance(0.5)
            ? 'frac-to-dec'
            : 'dec-to-frac';
    const others = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((j) => j !== k));
    let wrong: string[];
    if (dir === 'frac-to-dec') {
      wrong =
        level >= 3 ? [`0.0${k}`, `${k}.0`, dec(others[0] as number)] : others.slice(0, 3).map(dec);
    } else {
      wrong =
        level >= 3
          ? [`${k}/100`, k === 1 ? `${others[1]}/10` : `1/${k}`, `${others[0]}/10`]
          : others.slice(0, 3).map((j) => `${j}/10`);
    }
    return { k, dir, wrong };
  },
  build: (p, ctx) => {
    const fromFrac = p.dir === 'frac-to-dec';
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: fromFrac ? dec(p.k) : `${p.k}/10` },
      p.wrong.map((w) => ({ label: w })),
    );
    return {
      difficultyBand: fromFrac ? 'fraction-to-decimal' : 'decimal-to-fraction',
      widget: 'choice-tiles',
      prompt: {
        text: fromFrac
          ? tr(ctx, 'Tukar kepada perpuluhan.', 'Change to a decimal.')
          : tr(ctx, 'Tukar kepada pecahan.', 'Change to a fraction.'),
        expression: fromFrac ? `${p.k}/10` : dec(p.k),
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Sepersepuluh ialah 0.1. Kira berapa persepuluh.',
        'One tenth is 0.1. Count how many tenths.',
      ),
    };
  },
  fixtures: [
    {
      params: { k: 7, dir: 'frac-to-dec', wrong: ['0.3', '0.6', '0.1'] },
      expected: { answerText: '0.7', expression: '7/10' },
    },
  ],
});

type DecCompareP = { tenths: number[]; forms: Array<'dec' | 'frac'>; ask: 'largest' | 'smallest' };
const DEC_COUNT: Record<Level, number> = { 1: 2, 2: 3, 3: 3, 4: 3 };
const decCompare = defineTemplate<DecCompareP>({
  id: 'y2-frac-decimal-compare',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Compare decimals exactly (compare 0.6 and 0.8)',
  levelNotes: [
    'two decimals',
    'three decimals',
    'three decimals, smallest or largest',
    'three values mixing decimals and tenths fractions',
  ],
  prerequisites: ['y2-frac-decimal-match'],
  sample: (rng, level) => {
    const set = new Set<number>();
    while (set.size < DEC_COUNT[level]) set.add(rng.int(1, 9));
    const tenths = [...set];
    return {
      tenths,
      forms: tenths.map(() => (level === 4 && rng.chance(0.5) ? 'frac' : 'dec')),
      ask: rng.chance(0.5) ? 'largest' : 'smallest',
    };
  },
  build: (p, ctx) => {
    const fmt = (i: number): string =>
      p.forms[i] === 'frac' ? `${p.tenths[i]}/10` : dec(p.tenths[i] as number);
    const target = p.ask === 'largest' ? Math.max(...p.tenths) : Math.min(...p.tenths);
    const targetIdx = p.tenths.indexOf(target);
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: fmt(targetIdx) },
      p.tenths
        .map((_, i) => i)
        .filter((i) => i !== targetIdx)
        .map((i) => ({ label: fmt(i) })),
    );
    return {
      difficultyBand: `values-${p.tenths.length}`,
      widget: 'choice-tiles',
      prompt: {
        text:
          p.ask === 'largest'
            ? tr(ctx, 'Yang mana paling besar?', 'Which is the largest?')
            : tr(ctx, 'Yang mana paling kecil?', 'Which is the smallest?'),
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Bandingkan digit selepas titik perpuluhan.',
        'Compare the digit after the decimal point.',
      ),
    };
  },
  fixtures: [
    {
      params: { tenths: [6, 8], forms: ['dec', 'dec'], ask: 'largest' },
      expected: { answerText: '0.8' },
    },
  ],
});

export const Y2_FRACTION_TEMPLATES: QuestionTemplate[] = [
  name,
  shade,
  compareFractions,
  decMatch,
  decCompare,
];
