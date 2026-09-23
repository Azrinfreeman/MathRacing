import type { Rng } from '../../game/core/SeededRng';
import type { Level, QuestionTemplate } from '../schema';
import { bandWithin, numberBuilt } from './builders';
import { DIVIDE, MINUS, TIMES, defineTemplate, tr } from './helpers';

const TOPIC = 'y2-operations';
const SK = ['2.1-2.4'];

/** Random operands with a bounded total; `regroup` forces a carry in the ones column. */
function sampleAddends(rng: Rng, count: number, max: number, regroup: boolean, min = 1): number[] {
  for (let i = 0; i < 500; i++) {
    const parts = Array.from({ length: count }, () =>
      rng.int(min, Math.max(min, max - (count - 1) * min)),
    );
    const total = parts.reduce((s, v) => s + v, 0);
    if (total > max) continue;
    if (regroup && parts.reduce((s, v) => s + (v % 10), 0) < 10) continue;
    return parts;
  }
  return Array.from({ length: count }, () => min);
}

type AddP = { parts: number[] };
const ADD_CFG: Record<Level, { count: number; max: number; regroup: boolean; min: number }> = {
  1: { count: 2, max: 100, regroup: false, min: 10 },
  2: { count: 2, max: 1000, regroup: true, min: 100 },
  3: { count: 3, max: 1000, regroup: false, min: 20 },
  4: { count: 3, max: 1000, regroup: true, min: 50 },
};
const add = defineTemplate<AddP>({
  id: 'y2-op-add',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Add up to three numbers within 1000 (115 + 20 + 30)',
  levelNotes: [
    'two numbers, sum within 100',
    'two numbers, sum within 1000, regrouping',
    'three numbers, sum within 1000',
    'three numbers, sum within 1000, regrouping',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = ADD_CFG[level];
    return { parts: sampleAddends(rng, cfg.count, cfg.max, cfg.regroup, cfg.min) };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: bandWithin(ADD_CFG[ctx.level].max),
      text: tr(ctx, 'Berapakah jumlahnya?', 'What is the total?'),
      expression: `${p.parts.join(' + ')} = ?`,
      answer: p.parts.reduce((s, v) => s + v, 0),
      hint: tr(
        ctx,
        'Tambah ratus, puluh dan sa secara berasingan.',
        'Add the hundreds, tens and ones separately.',
      ),
    }),
  recompute: (p) => String(p.parts.reduce((s, v) => s + v, 0)),
  fixtures: [
    {
      params: { parts: [115, 20, 30] },
      expected: { answerText: '165', expression: '115 + 20 + 30 = ?' },
    },
  ],
});

type SubP = { start: number; takes: number[] };
const SUB_CFG: Record<Level, { count: number; max: number; regroup: boolean }> = {
  1: { count: 1, max: 100, regroup: false },
  2: { count: 1, max: 1000, regroup: true },
  3: { count: 2, max: 1000, regroup: false },
  4: { count: 2, max: 1000, regroup: true },
};
const sub = defineTemplate<SubP>({
  id: 'y2-op-sub',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Subtract up to three numbers within 1000 (850 - 167)',
  levelNotes: [
    'two numbers within 100',
    'two numbers within 1000, regrouping',
    'three numbers within 1000',
    'three numbers within 1000, regrouping',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = SUB_CFG[level];
    const lo = level === 1 ? 20 : 200;
    for (let i = 0; i < 500; i++) {
      const start = rng.int(lo, cfg.max);
      const takes: number[] = [];
      let left = start;
      let borrowed = false;
      for (let k = 0; k < cfg.count; k++) {
        // each take is at most an even share of what is left, so the result can never go negative
        const t = rng.int(1, Math.floor(left / (cfg.count - k + 1)));
        if (left % 10 < t % 10) borrowed = true;
        takes.push(t);
        left -= t;
      }
      if (!cfg.regroup || borrowed) return { start, takes };
    }
    return { start: lo + 30, takes: Array.from({ length: cfg.count }, () => 10) };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: bandWithin(SUB_CFG[ctx.level].max),
      text: tr(ctx, 'Berapakah bakinya?', 'What is left?'),
      expression: `${p.start} ${MINUS} ${p.takes.join(` ${MINUS} `)} = ?`,
      answer: p.start - p.takes.reduce((s, v) => s + v, 0),
      hint: tr(
        ctx,
        'Tolak ratus, puluh dan sa. Semak dengan menambah.',
        'Subtract hundreds, tens and ones. Check by adding.',
      ),
    }),
  recompute: (p) => String(p.takes.reduce((left, t) => left - t, p.start)),
  fixtures: [
    {
      params: { start: 850, takes: [167] },
      expected: { answerText: '683', expression: `850 ${MINUS} 167 = ?` },
    },
  ],
});

type MulP = { table: number; times: number };
const MUL_TABLES: Record<Level, number[]> = {
  1: [2, 5],
  2: [3, 4],
  3: [10, 2, 5],
  4: [2, 3, 4, 5, 10],
};
const mul = defineTemplate<MulP>({
  id: 'y2-op-mul',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Multiplication facts and one-digit x 10 (3 x 2; 8 x 10)',
  levelNotes: [
    'tables 2 and 5',
    'tables 3 and 4',
    'tables 10, 2 and 5',
    'tables 2, 3, 4, 5, 10 mixed',
  ],
  arithmetic: true,
  sample: (rng, level) => ({
    table: rng.pick(MUL_TABLES[level]),
    times: rng.int(level === 4 ? 2 : 1, 10),
  }),
  build: (p, ctx) =>
    numberBuilt({
      band: `table-${p.table}`,
      text: tr(ctx, 'Berapakah hasil darabnya?', 'What is the product?'),
      expression: `${p.times} ${TIMES} ${p.table} = ?`,
      answer: p.table * p.times,
      hint: tr(ctx, `Kira melangkau dalam ${p.table}.`, `Skip count in ${p.table}s.`),
      supportVisual: {
        kind: 'objects',
        groups: Array.from({ length: Math.min(p.times, 6) }, (_, i) => ({
          count: Math.min(p.table, 10),
          shape: 'circle' as const,
          color: i % 2 === 0 ? '#2e86de' : '#f2a900',
        })),
      },
    }),
  recompute: (p) => String(p.table * p.times),
  fixtures: [
    {
      params: { table: 2, times: 3 },
      expected: { answerText: '6', expression: `3 ${TIMES} 2 = ?` },
    },
  ],
});

type DivP = { divisor: number; quotient: number };
const DIV_DIVISORS: Record<Level, number[]> = {
  1: [2, 5],
  2: [3, 4],
  3: [10],
  4: [2, 3, 4, 5, 10],
};
const div = defineTemplate<DivP>({
  id: 'y2-op-div',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Division facts and two-digit / 10 (60 / 10)',
  levelNotes: [
    'divide by 2 or 5',
    'divide by 3 or 4',
    'divide two-digit multiples of 10 by 10',
    'mixed, exact division only',
  ],
  remainderAllowed: false,
  prerequisites: ['y2-op-mul'],
  arithmetic: true,
  sample: (rng, level) => {
    const divisor = rng.pick(DIV_DIVISORS[level]);
    return { divisor, quotient: divisor === 10 ? rng.int(1, 9) : rng.int(1, 10) };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `divisor-${p.divisor}`,
      text: tr(ctx, 'Berapakah hasil bahagi? (tiada baki)', 'What is the quotient? (no remainder)'),
      expression: `${p.divisor * p.quotient} ${DIVIDE} ${p.divisor} = ?`,
      answer: p.quotient,
      hint: tr(
        ctx,
        'Berapa kumpulan yang sama boleh dibuat?',
        'How many equal groups can you make?',
      ),
    }),
  recompute: (p) => {
    const dividend = p.divisor * p.quotient;
    return String(dividend / p.divisor);
  },
  fixtures: [
    {
      params: { divisor: 10, quotient: 6 },
      expected: { answerText: '6', expression: `60 ${DIVIDE} 10 = ?` },
    },
  ],
});

type RemP = { divisor: number; quotient: number; remainder: number; ask: 'quotient' | 'remainder' };
const REM_CFG: Record<Level, { divisors: number[]; maxQ: number }> = {
  1: { divisors: [2], maxQ: 4 },
  2: { divisors: [2, 3], maxQ: 6 },
  3: { divisors: [2, 3, 4, 5], maxQ: 6 },
  4: { divisors: [2, 3, 4, 5], maxQ: 9 },
};
const divRemainder = defineTemplate<RemP>({
  id: 'y2-op-div-remainder',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Division with remainders (share 17 into groups of 5)',
  levelNotes: [
    'divide by 2',
    'divide by 2 or 3',
    'divide by 2-5, quotient up to 6',
    'divide by 2-5, quotient up to 9',
  ],
  remainderAllowed: true,
  prerequisites: ['y2-op-div'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = REM_CFG[level];
    const divisor = rng.pick(cfg.divisors);
    return {
      divisor,
      quotient: rng.int(1, cfg.maxQ),
      remainder: rng.int(1, divisor - 1),
      ask: rng.chance(0.5) ? 'quotient' : 'remainder',
    };
  },
  build: (p, ctx) => {
    const dividend = p.divisor * p.quotient + p.remainder;
    const baki = tr(ctx, 'baki', 'remainder');
    // The keypad takes one number, so the remainder is asked as its own item: the sentence shows the
    // other part of "quotient r remainder" and the pupil types the missing one.
    const expression =
      p.ask === 'quotient'
        ? `${dividend} ${DIVIDE} ${p.divisor} = ? ${baki} ${p.remainder}`
        : `${dividend} ${DIVIDE} ${p.divisor} = ${p.quotient} ${baki} ?`;
    return numberBuilt({
      band: `divisor-${p.divisor}`,
      text:
        p.ask === 'quotient'
          ? tr(ctx, 'Berapa kumpulan penuh?', 'How many full groups?')
          : tr(ctx, 'Berapakah bakinya?', 'What is the remainder?'),
      expression,
      answer: p.ask === 'quotient' ? p.quotient : p.remainder,
      hint: tr(
        ctx,
        'Bahagi sama banyak. Yang tinggal ialah baki.',
        'Share equally. What is left over is the remainder.',
      ),
    });
  },
  recompute: (p) => {
    const dividend = p.divisor * p.quotient + p.remainder;
    return String(p.ask === 'quotient' ? Math.floor(dividend / p.divisor) : dividend % p.divisor);
  },
  fixtures: [
    {
      params: { divisor: 5, quotient: 3, remainder: 2, ask: 'remainder' },
      expected: { answerText: '2', expression: `17 ${DIVIDE} 5 = 3 baki ?` },
    },
  ],
});

export const Y2_OPERATION_TEMPLATES: QuestionTemplate[] = [add, sub, mul, div, divRemainder];
