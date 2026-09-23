import type { Level, QuestionTemplate } from '../schema';
import { numberBuilt } from './builders';
import { DIVIDE, MINUS, TIMES, defineTemplate, tr } from './helpers';

const TOPIC = 'y2-money';
const SK = ['4.1-4.5'];

/** All Year 2 money items are whole ringgit values up to RM100, stored in exact integer sen. */
const rmText = (sen: number): string => `RM${sen / 100}`;
const toSen = (rm: number): number => rm * 100;
const total = (values: number[]): number => values.reduce((s, v) => s + v, 0);

const NOTE_PARTS = [1, 5, 10, 20, 50];

type BuildP = { targetSen: number };
const BUILD_RANGE: Record<Level, [number, number]> = {
  1: [6, 25],
  2: [26, 60],
  3: [61, 99],
  4: [20, 100],
};
const buildMoney = defineTemplate<BuildP>({
  id: 'y2-money-build',
  topicId: TOPIC,
  widget: 'build-value',
  sk: SK,
  scope: 'Recognise and determine Malaysian money to RM100 (make RM20 three ways)',
  levelNotes: ['RM6-RM25', 'RM26-RM60', 'RM61-RM99', 'RM20-RM100'],
  sample: (rng, level) => ({
    targetSen: toSen(rng.int(BUILD_RANGE[level][0], BUILD_RANGE[level][1])),
  }),
  build: (p, ctx) => ({
    difficultyBand: `max-${BUILD_RANGE[ctx.level][1]}`,
    widget: 'build-value',
    prompt: {
      text: tr(ctx, 'Bina jumlah wang ini.', 'Make this amount of money.'),
      expression: rmText(p.targetSen),
    },
    options: NOTE_PARTS.map((part) => ({
      id: `n${part}`,
      label: `RM${part}`,
      value: part,
      visual: { kind: 'money' as const, items: [{ type: 'note' as const, valueSen: toSen(part) }] },
    })),
    acceptedAnswer: { kind: 'number', value: String(p.targetSen / 100) },
    widgetConfig: { totalUnit: 'rm' },
    hint: tr(
      ctx,
      'Mula dengan wang kertas yang paling bernilai.',
      'Start with the most valuable note.',
    ),
  }),
  recompute: (p) => String(p.targetSen / 100),
  fixtures: [{ params: { targetSen: 2900 }, expected: { answerText: '29', expression: 'RM29' } }],
});

type AddP = { valuesSen: number[] };
const ADD_CFG: Record<Level, { count: number; max: number }> = {
  1: { count: 2, max: 30 },
  2: { count: 2, max: 100 },
  3: { count: 3, max: 100 },
  4: { count: 3, max: 100 },
};
const addMoney = defineTemplate<AddP>({
  id: 'y2-money-add',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Add up to three money values within RM100 (RM29 + RM13)',
  levelNotes: [
    'two values, total within RM30',
    'two values, total within RM100',
    'three values, total within RM100',
    'three values, total within RM100, regrouping',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = ADD_CFG[level];
    for (let i = 0; i < 500; i++) {
      const parts = Array.from({ length: cfg.count }, () =>
        rng.int(2, Math.floor(cfg.max / cfg.count) + 10),
      );
      const sum = total(parts);
      if (sum > cfg.max) continue;
      if (level === 4 && parts.reduce((s, v) => s + (v % 10), 0) < 10) continue;
      return { valuesSen: parts.map(toSen) };
    }
    return { valuesSen: Array.from({ length: cfg.count }, () => toSen(5)) };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `max-${ADD_CFG[ctx.level].max}`,
      text: tr(ctx, 'Berapakah jumlah wang?', 'How much money in total?'),
      expression: `${p.valuesSen.map(rmText).join(' + ')} = ?`,
      unit: 'RM',
      answer: total(p.valuesSen) / 100,
      hint: tr(ctx, 'Tambah ringgit dengan ringgit.', 'Add ringgit to ringgit.'),
    }),
  recompute: (p) => String(p.valuesSen.reduce((s, v) => s + v, 0) / 100),
  fixtures: [
    {
      params: { valuesSen: [2900, 1300] },
      expected: { answerText: '42', expression: 'RM29 + RM13 = ?' },
    },
  ],
});

type SubP = { paidSen: number; costsSen: number[] };
const SUB_CFG: Record<Level, { paid: number; costs: number }> = {
  1: { paid: 10, costs: 1 },
  2: { paid: 50, costs: 1 },
  3: { paid: 100, costs: 1 },
  4: { paid: 100, costs: 2 },
};
const subMoney = defineTemplate<SubP>({
  id: 'y2-money-sub',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Subtract money and find change (change from RM54)',
  levelNotes: [
    'change from RM10',
    'change from RM50',
    'change from RM100',
    'change from RM100 after two purchases',
  ],
  prerequisites: ['y2-money-add'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = SUB_CFG[level];
    if (cfg.costs === 1)
      return { paidSen: toSen(cfg.paid), costsSen: [toSen(rng.int(1, cfg.paid - 1))] };
    const a = rng.int(5, 60);
    const b = rng.int(5, cfg.paid - a - 1);
    return { paidSen: toSen(cfg.paid), costsSen: [toSen(a), toSen(b)] };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `paid-${p.paidSen / 100}`,
      text:
        p.costsSen.length === 1
          ? tr(
              ctx,
              `Bayar ${rmText(p.paidSen)}. Harga ${rmText(p.costsSen[0] as number)}. Baki?`,
              `Pay ${rmText(p.paidSen)}. Price ${rmText(p.costsSen[0] as number)}. Change?`,
            )
          : tr(
              ctx,
              'Bayar RM100. Baki selepas dua pembelian?',
              'Pay RM100. Change after two purchases?',
            ),
      expression: `${rmText(p.paidSen)} ${MINUS} ${p.costsSen.map(rmText).join(` ${MINUS} `)} = ?`,
      unit: 'RM',
      answer: (p.paidSen - total(p.costsSen)) / 100,
      hint: tr(
        ctx,
        'Tolak harga daripada wang yang dibayar.',
        'Take the price away from the money paid.',
      ),
    }),
  recompute: (p) => String((p.paidSen - p.costsSen.reduce((s, v) => s + v, 0)) / 100),
  fixtures: [
    {
      params: { paidSen: 10000, costsSen: [5400] },
      expected: { answerText: '46', expression: `RM100 ${MINUS} RM54 = ?` },
    },
  ],
});

type MulP = { unitSen: number; times: number };
const MUL_CFG: Record<Level, { units: number[]; times: number[]; max: number }> = {
  1: { units: [1, 2, 5], times: [2, 3, 4, 5], max: 30 },
  2: { units: [2, 3, 4, 5, 10], times: [2, 3, 4, 5], max: 50 },
  3: { units: [5, 10, 6, 8], times: [3, 4, 5, 6, 7, 8, 9, 10], max: 100 },
  4: {
    units: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20],
    times: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    max: 100,
  },
};
const mulMoney = defineTemplate<MulP>({
  id: 'y2-money-mul',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Multiply money within RM100 (RM5 x 5)',
  levelNotes: [
    'RM1, RM2, RM5 x 2-5, within RM30',
    'RM2-RM10 x 2-5, within RM50',
    'up to RM10 x 3-10, within RM100',
    'RM2-RM20 x 2-10, within RM100',
  ],
  prerequisites: ['y2-op-mul'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = MUL_CFG[level];
    for (let i = 0; i < 300; i++) {
      const unit = rng.pick(cfg.units);
      const times = rng.pick(cfg.times);
      if (unit * times <= cfg.max) return { unitSen: toSen(unit), times };
    }
    return { unitSen: toSen(2), times: 2 };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `max-${MUL_CFG[ctx.level].max}`,
      text: tr(ctx, 'Berapakah jumlah wang?', 'How much money in total?'),
      expression: `${rmText(p.unitSen)} ${TIMES} ${p.times} = ?`,
      unit: 'RM',
      answer: (p.unitSen * p.times) / 100,
      hint: tr(
        ctx,
        'Tambah berulang atau guna sifir.',
        'Use repeated addition or your times table.',
      ),
    }),
  recompute: (p) => String((p.unitSen / 100) * p.times),
  fixtures: [
    {
      params: { unitSen: 500, times: 5 },
      expected: { answerText: '25', expression: `RM5 ${TIMES} 5 = ?` },
    },
  ],
});

type DivP = { divisor: number; quotientRm: number };
const DIV_CFG: Record<Level, { divisors: number[]; maxTotal: number }> = {
  1: { divisors: [2, 5, 10], maxTotal: 50 },
  2: { divisors: [2, 3, 4, 5, 10], maxTotal: 60 },
  3: { divisors: [2, 3, 4, 5, 6, 8, 10], maxTotal: 100 },
  4: { divisors: [2, 3, 4, 5, 6, 7, 8, 9, 10], maxTotal: 100 },
};
const divMoney = defineTemplate<DivP>({
  id: 'y2-money-div',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Divide money within RM100 (RM48 / 6)',
  levelNotes: [
    'RM50 or less shared by 2, 5, 10',
    'RM60 or less shared by 2-5, 10',
    'RM100 or less shared by 2-6, 8, 10',
    'RM100 or less shared by 2-10',
  ],
  remainderAllowed: false,
  prerequisites: ['y2-op-div'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = DIV_CFG[level];
    for (let i = 0; i < 300; i++) {
      const divisor = rng.pick(cfg.divisors);
      const maxQ = Math.floor(cfg.maxTotal / divisor);
      if (maxQ < 1) continue;
      return { divisor, quotientRm: rng.int(1, maxQ) };
    }
    return { divisor: 2, quotientRm: 5 };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `max-${DIV_CFG[ctx.level].maxTotal}`,
      text: tr(
        ctx,
        'Berapakah bahagian setiap orang? (tiada baki)',
        'How much does each share get? (no remainder)',
      ),
      expression: `${rmText(toSen(p.divisor * p.quotientRm))} ${DIVIDE} ${p.divisor} = ?`,
      unit: 'RM',
      answer: p.quotientRm,
      hint: tr(ctx, 'Bahagi sama banyak.', 'Share equally.'),
    }),
  recompute: (p) => String((p.divisor * p.quotientRm) / p.divisor),
  fixtures: [
    {
      params: { divisor: 6, quotientRm: 8 },
      expected: { answerText: '8', expression: `RM48 ${DIVIDE} 6 = ?` },
    },
  ],
});

export const Y2_MONEY_TEMPLATES: QuestionTemplate[] = [
  buildMoney,
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
];
