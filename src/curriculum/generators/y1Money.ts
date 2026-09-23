import type { Level, QuestionTemplate } from '../schema';
import type { MoneyItem, VisualModel } from '../visual';
import { numberBuilt, tapBuilt } from './builders';
import { MINUS, buildChoices, defineTemplate, tr } from './helpers';

const TOPIC = 'y1-money';
const SK = ['3.1-3.2'];

/** Malaysian denominations used in Year 1, in sen. Coins are below RM1; notes are whole ringgit. */
export const COINS_SEN = [5, 10, 20, 50] as const;
export const NOTES_SEN = [100, 500, 1000] as const;

export function denominationLabel(sen: number): string {
  return sen < 100 ? `${sen} sen` : `RM${sen / 100}`;
}

export function moneyItem(valueSen: number): MoneyItem {
  return { type: valueSen < 100 ? 'coin' : 'note', valueSen };
}

function moneyVisual(values: number[]): VisualModel {
  return { kind: 'money', items: values.map(moneyItem) };
}

function unitFactor(unit: 'sen' | 'rm'): number {
  return unit === 'sen' ? 1 : 100;
}

const IDENTIFY_POOL: Record<Level, number[]> = {
  1: [5, 10, 20, 50],
  2: [5, 10, 20, 50, 100],
  3: [5, 10, 20, 50, 100, 500],
  4: [5, 10, 20, 50, 100, 500, 1000],
};

type IdentifyP = { valueSen: number; wrongSen: number[] };
const identify = defineTemplate<IdentifyP>({
  id: 'y1-money-identify',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Recognise Malaysian coins and notes',
  levelNotes: [
    'coins 5-50 sen',
    'coins and RM1',
    'coins, RM1 and RM5',
    'coins and notes up to RM10',
  ],
  sample: (rng, level) => {
    const pool = IDENTIFY_POOL[level];
    const valueSen = rng.pick(pool);
    const wrongSen = rng.shuffle(pool.filter((v) => v !== valueSen)).slice(0, 3);
    return { valueSen, wrongSen };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: denominationLabel(p.valueSen) },
      p.wrongSen.map((w) => ({ label: denominationLabel(w) })),
    );
    return {
      difficultyBand: `pool-${IDENTIFY_POOL[ctx.level].length}`,
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Berapakah nilai wang ini?', 'What is the value of this money?'),
        visual: moneyVisual([p.valueSen]),
      },
      options,
      acceptedAnswer,
      hint: tr(ctx, 'Baca nombor pada wang itu.', 'Read the number on the money.'),
    };
  },
  fixtures: [
    { params: { valueSen: 20, wrongSen: [5, 10, 50] }, expected: { answerText: '20 sen' } },
  ],
});

type CompareP = { setA: number[]; setB: number[]; ask: 'more' | 'less' };
const COMPARE_CFG: Record<Level, { pool: number[]; size: [number, number]; max: number }> = {
  1: { pool: [5, 10, 20, 50], size: [1, 1], max: 50 },
  2: { pool: [5, 10, 20, 50], size: [1, 3], max: 150 },
  3: { pool: [5, 10, 20, 50, 100, 500], size: [1, 2], max: 1000 },
  4: { pool: [10, 20, 50, 100, 500, 1000], size: [1, 3], max: 1000 },
};
const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0);
const compareMoney = defineTemplate<CompareP>({
  id: 'y1-money-compare',
  topicId: TOPIC,
  widget: 'tap-picture',
  sk: SK,
  scope: 'Compare the value of Malaysian money',
  levelNotes: [
    'one coin each',
    '1-3 coins each, totals within RM1.50',
    '1-2 coins/notes each, totals within RM10',
    '1-3 coins/notes each, totals within RM10',
  ],
  prerequisites: ['y1-money-identify'],
  sample: (rng, level) => {
    const cfg = COMPARE_CFG[level];
    const draw = (): number[] =>
      Array.from({ length: rng.int(cfg.size[0], cfg.size[1]) }, () => rng.pick(cfg.pool));
    for (let i = 0; i < 500; i++) {
      const a = draw();
      const b = draw();
      if (sum(a) <= cfg.max && sum(b) <= cfg.max && Math.abs(sum(a) - sum(b)) >= 10) {
        return { setA: a, setB: b, ask: rng.chance(0.5) ? 'more' : 'less' };
      }
    }
    return { setA: [50], setB: [10], ask: 'more' };
  },
  build: (p, ctx) => {
    const aWins = p.ask === 'more' ? sum(p.setA) > sum(p.setB) : sum(p.setA) < sum(p.setB);
    return tapBuilt({
      band: `max-${COMPARE_CFG[ctx.level].max}sen`,
      text:
        p.ask === 'more'
          ? tr(ctx, 'Ketik wang yang lebih bernilai.', 'Tap the money worth more.')
          : tr(ctx, 'Ketik wang yang kurang bernilai.', 'Tap the money worth less.'),
      options: [
        { id: 'a', visual: moneyVisual(p.setA) },
        { id: 'b', visual: moneyVisual(p.setB) },
      ],
      acceptedAnswer: { kind: 'choice', optionId: aWins ? 'a' : 'b' },
      multi: false,
      columns: 2,
      hint: tr(ctx, 'Tambah nilai setiap kumpulan wang.', 'Add up the value of each set.'),
    });
  },
  fixtures: [
    {
      params: { setA: [50], setB: [10, 20], ask: 'more' },
      expected: { answerText: 'money 50 sen' },
    },
  ],
});

type BuildP = { targetSen: number; unit: 'sen' | 'rm' };
const BUILD_CFG: Record<Level, { unit: 'sen' | 'rm'; parts: number[]; targets: number[] }> = {
  1: { unit: 'sen', parts: [10, 20, 50], targets: [20, 30, 40, 50] },
  2: { unit: 'sen', parts: [5, 10, 20, 50], targets: [15, 25, 35, 45, 55, 65, 70, 75, 85, 95] },
  3: { unit: 'rm', parts: [1, 5], targets: [2, 3, 4, 6, 7] },
  4: { unit: 'rm', parts: [1, 5, 10], targets: [6, 7, 8, 9, 10] },
};
const buildMoney = defineTemplate<BuildP>({
  id: 'y1-money-build',
  topicId: TOPIC,
  widget: 'build-value',
  sk: SK,
  scope: 'Build 70 sen; choose an equivalent set for RM6',
  levelNotes: [
    '20-50 sen with 10/20/50 sen coins',
    '15-95 sen with 5/10/20/50 sen coins',
    'RM2-RM7 with RM1 and RM5 notes',
    'RM6-RM10 with RM1, RM5, RM10 notes',
  ],
  prerequisites: ['y1-money-identify'],
  sample: (rng, level) => {
    const cfg = BUILD_CFG[level];
    return { targetSen: rng.pick(cfg.targets) * unitFactor(cfg.unit), unit: cfg.unit };
  },
  build: (p, ctx) => {
    const cfg = BUILD_CFG[ctx.level];
    const display = p.targetSen / unitFactor(p.unit);
    return {
      difficultyBand: cfg.unit === 'sen' ? 'sen' : 'ringgit',
      widget: 'build-value',
      prompt: {
        text: tr(ctx, 'Bina jumlah wang ini.', 'Make this amount of money.'),
        expression: p.unit === 'sen' ? `${display} sen` : `RM${display}`,
      },
      options: cfg.parts.map((part) => ({
        id: `p${part}`,
        label: p.unit === 'sen' ? `${part} sen` : `RM${part}`,
        value: part,
        visual: moneyVisual([part * unitFactor(p.unit)]),
      })),
      acceptedAnswer: { kind: 'number', value: String(display) },
      widgetConfig: { totalUnit: p.unit },
      hint: tr(
        ctx,
        'Mula dengan wang yang paling bernilai.',
        'Start with the most valuable money.',
      ),
    };
  },
  recompute: (p) => String(p.targetSen / unitFactor(p.unit)),
  fixtures: [
    {
      params: { targetSen: 70, unit: 'sen' },
      expected: { answerText: '70', expression: '70 sen' },
    },
  ],
});

type ExchangeP = { fromSen: number; toSen: number };
const EXCHANGES: Record<Level, Array<[number, number]>> = {
  1: [
    [20, 10],
    [10, 5],
    [50, 10],
  ],
  2: [
    [100, 50],
    [100, 20],
    [100, 10],
    [50, 5],
  ],
  3: [
    [500, 100],
    [1000, 500],
    [100, 50],
  ],
  4: [
    [1000, 100],
    [500, 100],
    [1000, 500],
    [100, 20],
  ],
};
const exchange = defineTemplate<ExchangeP>({
  id: 'y1-money-exchange',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Exchange money from sen to RM1 and ringgit notes to RM10',
  levelNotes: [
    'sen coins to smaller sen coins',
    'RM1 to sen coins',
    'RM5/RM10 notes to smaller notes',
    'RM10/RM5 to RM1; RM1 to 20 sen',
  ],
  prerequisites: ['y1-money-identify'],
  arithmetic: true,
  sample: (rng, level) => {
    const [fromSen, toSen] = rng.pick(EXCHANGES[level]);
    return { fromSen, toSen };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: ctx.level <= 2 ? 'sen' : 'ringgit',
      text: tr(ctx, 'Tukar wang. Berapa keping?', 'Exchange money. How many pieces?'),
      expression: tr(
        ctx,
        `1 keping ${denominationLabel(p.fromSen)} = ? keping ${denominationLabel(p.toSen)}`,
        `1 piece of ${denominationLabel(p.fromSen)} = ? pieces of ${denominationLabel(p.toSen)}`,
      ),
      answer: p.fromSen / p.toSen,
      hint: tr(
        ctx,
        'Berapa kali nilai kecil muat dalam nilai besar?',
        'How many small ones make the big one?',
      ),
    }),
  recompute: (p) => String(p.fromSen / p.toSen),
  fixtures: [
    {
      params: { fromSen: 100, toSen: 20 },
      expected: { answerText: '5', expression: '1 keping RM1 = ? keping 20 sen' },
    },
  ],
});

type AddP = { valuesSen: number[]; unit: 'sen' | 'rm' };
const ADD_CFG: Record<Level, { unit: 'sen' | 'rm'; count: number; step: number; max: number }> = {
  1: { unit: 'sen', count: 2, step: 10, max: 50 },
  2: { unit: 'sen', count: 2, step: 5, max: 100 },
  3: { unit: 'rm', count: 2, step: 1, max: 10 },
  4: { unit: 'rm', count: 3, step: 1, max: 10 },
};
function fmt(sen: number, unit: 'sen' | 'rm'): string {
  return unit === 'sen' ? `${sen} sen` : `RM${sen / 100}`;
}
const addMoney = defineTemplate<AddP>({
  id: 'y1-money-add',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Add money within RM10 (calculate RM5 + RM3)',
  levelNotes: [
    'sen in tens, total within 50 sen',
    'sen in fives, total within 100 sen',
    'two RM values, total within RM10',
    'three RM values, total within RM10',
  ],
  prerequisites: ['y1-op-add'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = ADD_CFG[level];
    // Work in "steps" (10 sen, 5 sen or RM1) and convert to exact integer sen at the end.
    const perStep = cfg.unit === 'rm' ? 100 : cfg.step;
    const maxSteps = cfg.max / cfg.step;
    for (let i = 0; i < 300; i++) {
      const parts = Array.from({ length: cfg.count }, () => rng.int(1, maxSteps - cfg.count + 1));
      if (sum(parts) <= maxSteps)
        return { valuesSen: parts.map((v) => v * perStep), unit: cfg.unit };
    }
    return { valuesSen: Array.from({ length: cfg.count }, () => perStep), unit: cfg.unit };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: p.unit === 'sen' ? 'sen' : 'ringgit',
      text: tr(ctx, 'Berapakah jumlah wang?', 'How much money in total?'),
      expression: `${p.valuesSen.map((v) => fmt(v, p.unit)).join(' + ')} = ?`,
      unit: p.unit === 'sen' ? 'sen' : 'RM',
      answer: sum(p.valuesSen) / unitFactor(p.unit),
      hint: tr(ctx, 'Tambah nilai wang satu demi satu.', 'Add the money one at a time.'),
    }),
  recompute: (p) => String(p.valuesSen.reduce((s, v) => s + v, 0) / unitFactor(p.unit)),
  fixtures: [
    {
      params: { valuesSen: [500, 300], unit: 'rm' },
      expected: { answerText: '8', expression: 'RM5 + RM3 = ?' },
    },
  ],
});

type SubP = { aSen: number; bSen: number; unit: 'sen' | 'rm'; applied: boolean };
const SUB_CFG: Record<Level, { unit: 'sen' | 'rm'; step: number; max: number; applied: boolean }> =
  {
    1: { unit: 'sen', step: 10, max: 100, applied: false },
    2: { unit: 'sen', step: 5, max: 100, applied: false },
    3: { unit: 'rm', step: 1, max: 10, applied: false },
    4: { unit: 'rm', step: 1, max: 10, applied: true },
  };
const subMoney = defineTemplate<SubP>({
  id: 'y1-money-sub',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Subtract money within RM10 (find change from RM10)',
  levelNotes: [
    'sen in tens within 100 sen',
    'sen in fives within 100 sen',
    'RM within RM10',
    'RM within RM10, change from a purchase',
  ],
  prerequisites: ['y1-op-sub'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = SUB_CFG[level];
    const units = cfg.max / cfg.step;
    const a = rng.int(2, units);
    const b = rng.int(1, a - 1);
    const perUnit = cfg.unit === 'rm' ? 100 : cfg.step;
    return { aSen: a * perUnit, bSen: b * perUnit, unit: cfg.unit, applied: cfg.applied };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: p.unit === 'sen' ? 'sen' : 'ringgit',
      text: p.applied
        ? tr(
            ctx,
            `Beli ${fmt(p.bSen, p.unit)}. Bayar ${fmt(p.aSen, p.unit)}. Baki?`,
            `Buy ${fmt(p.bSen, p.unit)}. Pay ${fmt(p.aSen, p.unit)}. Change?`,
          )
        : tr(ctx, 'Berapakah bakinya?', 'How much is left?'),
      expression: `${fmt(p.aSen, p.unit)} ${MINUS} ${fmt(p.bSen, p.unit)} = ?`,
      unit: p.unit === 'sen' ? 'sen' : 'RM',
      answer: (p.aSen - p.bSen) / unitFactor(p.unit),
      hint: tr(
        ctx,
        'Tolak nilai yang dibelanjakan daripada yang dibayar.',
        'Take the price away from the money paid.',
      ),
    }),
  recompute: (p) => String((p.aSen - p.bSen) / unitFactor(p.unit)),
  fixtures: [
    {
      params: { aSen: 1000, bSen: 600, unit: 'rm', applied: true },
      expected: { answerText: '4', expression: `RM10 ${MINUS} RM6 = ?` },
    },
  ],
});

export const Y1_MONEY_TEMPLATES: QuestionTemplate[] = [
  identify,
  compareMoney,
  buildMoney,
  exchange,
  addMoney,
  subMoney,
];
