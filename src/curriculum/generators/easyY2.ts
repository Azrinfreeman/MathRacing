import type { Level, LocalText, QuestionTemplate } from '../schema';
import type { BlockSet, ObjectShape } from '../visual';
import { blockValue } from '../visual';
import { FRUITS, OBJECT_COLORS, PETS, text } from '../text/vocab';
import { numberBuilt } from './builders';
import { COUNT_SHAPES, color, moneyItems, shapeCountTemplate } from './easyShared';
import { DIVIDE, MINUS, TIMES, defineTemplate, tr } from './helpers';

/**
 * Year 2 "Kira & taip" questions (DECISIONS #42). Numbers above 20 are drawn as base-ten blocks (flats of 100,
 * rods of 10, cubes), so even 999 is at most 27 things to count. Topic SK ranges as printed in the KPM plan.
 */

type Blocks = { h: number; t: number; o: number };
const toSet = (b: Blocks): BlockSet => ({ hundreds: b.h, tens: b.t, ones: b.o });
const value = (b: Blocks): number => blockValue(toSet(b));

/** Digit ranges per level: up to 50, 100, 500 and 999. */
function sampleBlocks(
  rng: { int(a: number, b: number): number },
  level: Level,
  maxHundreds = 9,
): Blocks {
  if (level === 1) return { h: 0, t: rng.int(1, 4), o: rng.int(0, 9) };
  if (level === 2) return { h: 0, t: rng.int(1, 9), o: rng.int(0, 9) };
  if (level === 3)
    return { h: rng.int(1, Math.min(4, maxHundreds)), t: rng.int(0, 9), o: rng.int(0, 9) };
  return { h: rng.int(1, maxHundreds), t: rng.int(0, 9), o: rng.int(0, 9) };
}

/**
 * Sums and differences show up to two sets of blocks at once, so their hundreds stay lower than in "Nombor
 * berapa?" (up to 299 and 599): every block stays large enough to count on a small tablet (DECISIONS #42).
 */
const ARITH_HUNDREDS: Record<Level, number> = { 1: 0, 2: 0, 3: 2, 4: 5 };

const BLOCK_HINT: LocalText = {
  bm: 'Kira ratus, kemudian puluh, kemudian sa.',
  en: 'Count the hundreds, then the tens, then the ones.',
};

// ------------------------------------------------------------------------------ 1.0 Whole numbers

type BlocksP = Blocks;
const blocks = defineTemplate<BlocksP>({
  id: 'y2-easy-blocks',
  topicId: 'y2-numbers',
  widget: 'number-pad',
  sk: ['1.1-1.5'],
  scope: 'Name and write numbers; place value (count base-ten blocks)',
  levelNotes: ['10-49', '10-99', '100-499', '100-999'],
  arithmetic: true,
  sample: (rng, level) => sampleBlocks(rng, level),
  build: (p, ctx) =>
    numberBuilt({
      band: `blocks-${ctx.level}`,
      text: tr(ctx, 'Nombor berapa?', 'What number is this?'),
      visual: { kind: 'base-ten', sets: [toSet(p)] },
      answer: value(p),
      hint: text(ctx.language, BLOCK_HINT),
    }),
  recompute: (p) => String(value(p)),
  fixtures: [{ params: { h: 1, t: 3, o: 6 }, level: 3, expected: { answerText: '136' } }],
});

// ------------------------------------------------------------------------------ 2.0 Operations

const O_TOPIC = 'y2-operations';
const O_SK = ['2.1-2.4'];

/** Split every digit of a total into two addends, so the sum never regroups; both addends are at least 1. */
type AddP = { a: Blocks; b: Blocks };
const add = defineTemplate<AddP>({
  id: 'y2-easy-add',
  topicId: O_TOPIC,
  widget: 'number-pad',
  sk: O_SK,
  scope: 'Add within 1000 without regrouping (two sets of blocks: count them all)',
  levelNotes: ['sum 10-49', 'sum 10-99', 'sum 100-299', 'sum 100-599'],
  arithmetic: true,
  sample: (rng, level) => {
    for (let guard = 0; guard < 50; guard++) {
      const total = sampleBlocks(rng, level, ARITH_HUNDREDS[level]);
      const split = (d: number): [number, number] => {
        const x = rng.int(0, d);
        return [x, d - x];
      };
      const [ah, bh] = split(total.h);
      const [at, bt] = split(total.t);
      const [ao, bo] = split(total.o);
      const a = { h: ah, t: at, o: ao };
      const b = { h: bh, t: bt, o: bo };
      if (value(a) > 0 && value(b) > 0) return { a, b };
    }
    return { a: { h: 0, t: 1, o: 2 }, b: { h: 0, t: 1, o: 3 } };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `sum-${ctx.level}`,
      text: tr(ctx, 'Berapa semua?', 'How many altogether?'),
      expression: `${value(p.a)} + ${value(p.b)} = ?`,
      visual: { kind: 'base-ten', sets: [toSet(p.a), toSet(p.b)] },
      answer: value(p.a) + value(p.b),
      hint: text(ctx.language, BLOCK_HINT),
    }),
  recompute: (p) => String(value(p.a) + value(p.b)),
  fixtures: [
    {
      params: { a: { h: 0, t: 2, o: 3 }, b: { h: 0, t: 1, o: 4 } },
      level: 1,
      expected: { answerText: '37', expression: '23 + 14 = ?' },
    },
  ],
});

/** Cross out part of each place (never more than drawn), so nothing needs regrouping. */
type SubP = { a: Blocks; c: Blocks };
const sub = defineTemplate<SubP>({
  id: 'y2-easy-sub',
  topicId: O_TOPIC,
  widget: 'number-pad',
  sk: O_SK,
  scope: 'Subtract within 1000 without regrouping (blocks crossed out: how many are left?)',
  levelNotes: ['from 10-49', 'from 10-99', 'from 100-299', 'from 100-599'],
  arithmetic: true,
  sample: (rng, level) => {
    for (let guard = 0; guard < 50; guard++) {
      const a = sampleBlocks(rng, level, ARITH_HUNDREDS[level]);
      const c = { h: rng.int(0, a.h), t: rng.int(0, a.t), o: rng.int(0, a.o) };
      if (value(c) > 0 && value(a) - value(c) > 0) return { a, c };
    }
    return { a: { h: 0, t: 3, o: 5 }, c: { h: 0, t: 1, o: 2 } };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `from-${ctx.level}`,
      text: tr(ctx, 'Berapa tinggal?', 'How many are left?'),
      expression: `${value(p.a)} ${MINUS} ${value(p.c)} = ?`,
      visual: { kind: 'base-ten', sets: [toSet(p.a)], crossed: toSet(p.c) },
      answer: value(p.a) - value(p.c),
      hint: tr(
        ctx,
        'Kira blok yang tidak dipangkah sahaja.',
        'Count only the blocks not crossed out.',
      ),
    }),
  recompute: (p) => String(value(p.a) - value(p.c)),
  fixtures: [
    {
      params: { a: { h: 0, t: 3, o: 5 }, c: { h: 0, t: 1, o: 2 } },
      level: 1,
      expected: { answerText: '23', expression: `35 ${MINUS} 12 = ?` },
    },
  ],
});

const MUL: Record<Level, { sizes: number[]; maxGroups: number }> = {
  1: { sizes: [2, 5, 10], maxGroups: 5 },
  2: { sizes: [2, 3, 4, 5], maxGroups: 5 },
  3: { sizes: [2, 3, 4, 5, 10], maxGroups: 6 },
  4: { sizes: [2, 3, 4, 5, 10], maxGroups: 10 },
};
type MulP = { groups: number; size: number; shape: ObjectShape; colorIdx: number };
const mul = defineTemplate<MulP>({
  id: 'y2-easy-mul',
  topicId: O_TOPIC,
  widget: 'number-pad',
  sk: O_SK,
  scope: 'Multiplication facts as equal groups (3 groups of 4: count them all)',
  levelNotes: [
    'groups of 2, 5, 10; up to 5 groups',
    'groups of 2-5; up to 5 groups',
    'groups of 2-5 or 10; up to 6 groups',
    'groups of 2-5 (up to 10 groups) or 10 (up to 5)',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const size = rng.pick(MUL[level].sizes);
    const maxGroups = size === 10 ? Math.min(5, MUL[level].maxGroups) : MUL[level].maxGroups;
    return {
      groups: rng.int(2, maxGroups),
      size,
      shape: rng.pick(COUNT_SHAPES),
      colorIdx: rng.int(0, OBJECT_COLORS.length - 1),
    };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `x${p.size}`,
      text: tr(ctx, 'Berapa semua?', 'How many altogether?'),
      expression: `${p.groups} ${TIMES} ${p.size} = ?`,
      visual: {
        kind: 'equal-groups',
        groups: p.groups,
        perGroup: p.size,
        shape: p.shape,
        color: color(p.colorIdx),
      },
      answer: p.groups * p.size,
      hint: tr(
        ctx,
        `Kira lompat ${p.size}: ${p.size}, ${p.size * 2}, ...`,
        `Skip count in ${p.size}s: ${p.size}, ${p.size * 2}, ...`,
      ),
    }),
  recompute: (p) => String(p.groups * p.size),
  fixtures: [
    {
      params: { groups: 3, size: 4, shape: 'circle', colorIdx: 0 },
      level: 2,
      expected: { answerText: '12', expression: `3 ${TIMES} 4 = ?` },
    },
  ],
});

const DIV: Record<Level, { groups: number[]; maxEach: number }> = {
  1: { groups: [2], maxEach: 5 },
  2: { groups: [2, 5], maxEach: 5 },
  3: { groups: [2, 3, 4, 5], maxEach: 6 },
  4: { groups: [2, 3, 4, 5, 10], maxEach: 10 },
};
type DivP = { groups: number; each: number; shape: ObjectShape; colorIdx: number };
const div = defineTemplate<DivP>({
  id: 'y2-easy-div',
  topicId: O_TOPIC,
  widget: 'number-pad',
  sk: O_SK,
  scope: 'Division facts as equal sharing (how many in each group?)',
  levelNotes: [
    'share into 2 groups, 1-5 each',
    'share into 2 or 5 groups, 1-5 each',
    'share into 2-5 groups, 1-6 each',
    'share into 2-5 groups (1-10 each) or 10 groups (1-5 each)',
  ],
  remainderAllowed: false,
  arithmetic: true,
  sample: (rng, level) => {
    const groupCount = rng.pick(DIV[level].groups);
    return {
      groups: groupCount,
      each: rng.int(1, groupCount === 10 ? 5 : DIV[level].maxEach),
      shape: rng.pick(COUNT_SHAPES),
      colorIdx: rng.int(0, OBJECT_COLORS.length - 1),
    };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `share-${p.groups}`,
      text: tr(ctx, 'Berapa dalam setiap kumpulan?', 'How many in each group?'),
      expression: `${p.groups * p.each} ${DIVIDE} ${p.groups} = ?`,
      visual: {
        kind: 'equal-groups',
        groups: p.groups,
        perGroup: p.each,
        shape: p.shape,
        color: color(p.colorIdx),
      },
      answer: p.each,
      hint: tr(ctx, 'Kira satu kumpulan sahaja.', 'Count just one group.'),
    }),
  recompute: (p) => String(p.each),
  fixtures: [
    {
      params: { groups: 3, each: 4, shape: 'star', colorIdx: 0 },
      level: 3,
      expected: { answerText: '4', expression: `12 ${DIVIDE} 3 = ?` },
    },
  ],
});

// ------------------------------------------------------------------------------ 3.0 Fractions

const DENOMS: Record<Level, number[]> = {
  1: [2, 4],
  2: [2, 3, 4, 5, 6],
  3: [2, 3, 4, 5, 6, 8],
  4: [2, 3, 4, 5, 6, 8, 10],
};
type PartsP = { den: number; num: number; pie: boolean; askShaded: boolean };
const fractionParts = defineTemplate<PartsP>({
  id: 'y2-easy-fraction-parts',
  topicId: 'y2-fractions',
  widget: 'number-pad',
  sk: ['3.1-3.3'],
  scope: 'Represent fractions (count the coloured parts and all the parts)',
  levelNotes: ['halves, quarters', 'up to sixths', 'up to eighths', 'up to tenths'],
  arithmetic: true,
  sample: (rng, level) => {
    const den = rng.pick(DENOMS[level]);
    return { den, num: rng.int(1, den - 1), pie: rng.chance(0.5), askShaded: rng.chance(0.6) };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `d${p.den}`,
      text: p.askShaded
        ? tr(ctx, 'Berapa bahagian berwarna?', 'How many parts are coloured?')
        : tr(ctx, 'Berapa bahagian semuanya?', 'How many parts altogether?'),
      visual: {
        kind: 'fraction',
        numerator: p.num,
        denominator: p.den,
        style: p.pie ? 'pie' : 'bar',
      },
      answer: p.askShaded ? p.num : p.den,
      hint: p.askShaded
        ? tr(ctx, 'Kira bahagian yang berwarna sahaja.', 'Count only the coloured parts.')
        : tr(
            ctx,
            'Kira setiap bahagian, berwarna atau tidak.',
            'Count every part, coloured or not.',
          ),
    }),
  recompute: (p) => String(p.askShaded ? p.num : p.den),
  fixtures: [
    {
      params: { den: 4, num: 3, pie: false, askShaded: true },
      level: 1,
      expected: { answerText: '3' },
    },
  ],
});

// ------------------------------------------------------------------------------ 4.0 Money

type MoneyP = { tens: number; fives: number; ones: number };
const money = defineTemplate<MoneyP>({
  id: 'y2-easy-money',
  topicId: 'y2-money',
  widget: 'number-pad',
  sk: ['4.1-4.5'],
  scope: 'Recognise and determine the value of Malaysian money to RM100 (count the notes)',
  levelNotes: [
    '1-10 RM1 notes',
    'RM5 and RM1 notes, up to RM20',
    'RM10, RM5 and RM1 notes, up to RM50',
    'RM10, RM5 and RM1 notes, up to RM100',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    if (level === 1) return { tens: 0, fives: 0, ones: rng.int(1, 10) };
    if (level === 2) return { tens: 0, fives: rng.int(1, 2), ones: rng.int(1, 5) };
    if (level === 3) return { tens: rng.int(1, 3), fives: rng.int(0, 1), ones: rng.int(0, 4) };
    return { tens: rng.int(3, 8), fives: rng.int(0, 1), ones: rng.int(0, 4) };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `notes-${ctx.level}`,
      text: tr(ctx, 'Berapa ringgit?', 'How many ringgit?'),
      visual: moneyItems([
        ...Array.from({ length: p.tens }, () => 1000),
        ...Array.from({ length: p.fives }, () => 500),
        ...Array.from({ length: p.ones }, () => 100),
      ]),
      unit: 'RM',
      answer: p.tens * 10 + p.fives * 5 + p.ones,
      hint: tr(
        ctx,
        'Kira RM10 dahulu, kemudian RM5, kemudian RM1.',
        'Count the RM10 notes first, then RM5, then RM1.',
      ),
    }),
  recompute: (p) => String(p.tens * 10 + p.fives * 5 + p.ones),
  fixtures: [{ params: { tens: 2, fives: 1, ones: 3 }, level: 3, expected: { answerText: '28' } }],
});

// ------------------------------------------------------------------------------ 5.0 Time

type ClockP = { hour: number; minute: number };
const clock = defineTemplate<ClockP>({
  id: 'y2-easy-clock',
  topicId: 'y2-time',
  widget: 'number-pad',
  sk: ['5.1-5.2'],
  scope: 'Read an analogue clock: the hour, then the minutes in fives',
  levelNotes: [
    'the hour',
    'the hour',
    'minutes past the hour, in fives',
    'minutes past the hour, in fives',
  ],
  arithmetic: true,
  sample: (rng, level) => ({
    hour: rng.int(1, 12),
    minute: level <= 2 ? 0 : 5 * rng.int(1, 11),
  }),
  build: (p, ctx) =>
    numberBuilt({
      band: p.minute === 0 ? 'hour' : 'minutes-5',
      text:
        p.minute === 0
          ? tr(ctx, 'Pukul berapa?', 'What hour is it?')
          : tr(ctx, 'Berapa minit?', 'How many minutes past?'),
      visual:
        p.minute === 0
          ? { kind: 'clock', hour: p.hour, minute: 0 }
          : { kind: 'clock', hour: p.hour, minute: p.minute, fives: true },
      answer: p.minute === 0 ? p.hour : p.minute,
      hint:
        p.minute === 0
          ? tr(ctx, 'Lihat jarum pendek.', 'Look at the short hand.')
          : tr(
              ctx,
              'Lihat jarum panjang. Kira lima-lima.',
              'Look at the long hand. Count in fives.',
            ),
    }),
  recompute: (p) => String(p.minute === 0 ? p.hour : p.minute),
  fixtures: [
    { params: { hour: 7, minute: 0 }, level: 1, expected: { answerText: '7' } },
    { params: { hour: 3, minute: 20 }, level: 3, expected: { answerText: '20' } },
  ],
});

// ------------------------------------------------------------------------------ 6.0 Measurement

const RULER: Record<Level, { min: number; max: number }> = {
  1: { min: 2, max: 10 },
  2: { min: 3, max: 15 },
  3: { min: 4, max: 20 },
  4: { min: 4, max: 20 },
};
type RulerP = { lengthCm: number; maxCm: number };
const ruler = defineTemplate<RulerP>({
  id: 'y2-easy-ruler',
  topicId: 'y2-measurement',
  widget: 'number-pad',
  sk: ['6.1-6.3'],
  scope: 'Measure length in centimetres with a ruler',
  levelNotes: ['2-10 cm', '3-15 cm', '4-20 cm', '4-20 cm'],
  arithmetic: true,
  sample: (rng, level) => ({
    lengthCm: rng.int(RULER[level].min, RULER[level].max),
    maxCm: RULER[level].max,
  }),
  build: (p, ctx) =>
    numberBuilt({
      band: `ruler-${p.maxCm}`,
      text: tr(ctx, 'Berapa cm panjangnya?', 'How many cm long?'),
      visual: { kind: 'ruler', lengthCm: p.lengthCm, maxCm: p.maxCm },
      unit: 'cm',
      answer: p.lengthCm,
      hint: tr(ctx, 'Mula dari 0 dan kira setiap cm.', 'Start at 0 and count each cm.'),
    }),
  recompute: (p) => String(p.lengthCm),
  fixtures: [{ params: { lengthCm: 7, maxCm: 10 }, expected: { answerText: '7' } }],
});

const CUP: Record<Level, { max: number; step: number }> = {
  1: { max: 500, step: 100 },
  2: { max: 1000, step: 100 },
  3: { max: 1000, step: 100 },
  4: { max: 1000, step: 50 },
};
type CupP = { ml: number; maxMl: number };
const cup = defineTemplate<CupP>({
  id: 'y2-easy-cup',
  topicId: 'y2-measurement',
  widget: 'number-pad',
  sk: ['6.1-6.3'],
  scope: 'Measure liquid volume in millilitres with a measuring cup',
  levelNotes: [
    '100s, cup to 500 ml',
    '100s, cup to 1000 ml',
    '100s, cup to 1000 ml',
    '50s, cup to 1000 ml',
  ],
  arithmetic: true,
  sample: (rng, level) => ({
    ml: CUP[level].step * rng.int(1, CUP[level].max / CUP[level].step - 1),
    maxMl: CUP[level].max,
  }),
  build: (p, ctx) =>
    numberBuilt({
      band: `cup-${p.maxMl}`,
      text: tr(ctx, 'Berapa ml air?', 'How many ml of water?'),
      visual: { kind: 'cup', ml: p.ml, maxMl: p.maxMl },
      unit: 'ml',
      answer: p.ml,
      hint: tr(ctx, 'Baca garisan pada aras air.', 'Read the line at the water level.'),
    }),
  recompute: (p) => String(p.ml),
  fixtures: [{ params: { ml: 300, maxMl: 500 }, level: 1, expected: { answerText: '300' } }],
});

// ------------------------------------------------------------------------------ 7.0 Space

const shapeCount = shapeCountTemplate({
  id: 'y2-easy-shape-count',
  topicId: 'y2-space',
  sk: ['7.1-7.2'],
  pools: {
    1: ['triangle', 'square', 'rectangle', 'pentagon'],
    2: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'],
    3: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'],
    4: ['pentagon', 'hexagon', 'octagon'],
  },
  cornersFrom: 2,
});

// ------------------------------------------------------------------------------ 8.0 Data

const CHART: Record<Level, { bars: number; scale: number; max: number }> = {
  1: { bars: 3, scale: 1, max: 10 },
  2: { bars: 4, scale: 1, max: 10 },
  3: { bars: 4, scale: 2, max: 20 },
  4: { bars: 5, scale: 5, max: 50 },
};
const Y_TITLE: LocalText = { bm: 'Bilangan murid', en: 'Number of pupils' };
type BarP = { pets: boolean; labelIdx: number[]; values: number[]; ask: number };
const barRead = defineTemplate<BarP>({
  id: 'y2-easy-bar-read',
  topicId: 'y2-data',
  widget: 'number-pad',
  sk: ['8.1-8.2'],
  scope: 'Read a bar chart (how many pupils chose mango?)',
  levelNotes: ['3 bars, scale 1', '4 bars, scale 1', '4 bars, scale 2', '5 bars, scale 5'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = CHART[level];
    const pets = rng.chance(0.5);
    const names = pets ? PETS : FRUITS;
    const labelIdx = rng.shuffle(names.map((_, i) => i)).slice(0, cfg.bars);
    return {
      pets,
      labelIdx,
      values: labelIdx.map(() => cfg.scale * rng.int(1, cfg.max / cfg.scale)),
      ask: rng.int(0, cfg.bars - 1),
    };
  },
  build: (p, ctx) => {
    const cfg = CHART[ctx.level];
    const names = p.pets ? PETS : FRUITS;
    const categories = p.labelIdx.map((li, i) => ({
      label: text(ctx.language, names[li] as LocalText),
      value: p.values[i] as number,
      color: color(i),
    }));
    const bar = categories[p.ask];
    if (!bar) throw new Error('y2-easy-bar-read: ask index out of range');
    return numberBuilt({
      band: `scale-${cfg.scale}`,
      text: tr(
        ctx,
        `Berapa murid pilih ${bar.label.toLowerCase()}?`,
        `How many chose ${bar.label.toLowerCase()}?`,
      ),
      visual: {
        kind: 'bar-chart',
        categories,
        scale: cfg.scale,
        max: cfg.max,
        yTitle: text(ctx.language, Y_TITLE),
      },
      answer: bar.value,
      hint: tr(
        ctx,
        'Ikut hujung bar ke nombor di tepi.',
        'Follow the top of the bar to the numbers.',
      ),
    });
  },
  recompute: (p) => String(p.values[p.ask]),
  fixtures: [
    {
      params: { pets: false, labelIdx: [0, 1, 2], values: [6, 3, 9], ask: 0 },
      level: 1,
      expected: { answerText: '6' },
    },
  ],
});

export const Y2_EASY_TEMPLATES: QuestionTemplate[] = [
  blocks,
  add,
  sub,
  mul,
  div,
  fractionParts,
  money,
  clock,
  ruler,
  cup,
  shapeCount,
  barRead,
];
