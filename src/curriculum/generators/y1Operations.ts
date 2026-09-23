import type { Level, QuestionTemplate } from '../schema';
import type { VisualModel } from '../visual';
import { Y1_MAX, bandWithin, numberBuilt } from './builders';
import { MINUS, buildChoices, defineTemplate, tr } from './helpers';

const TOPIC = 'y1-operations';
const SK = ['2.1-2.5'];

function dots(a: number, b?: number): VisualModel {
  const groups = [{ count: a, shape: 'circle' as const, color: '#2e86de' }];
  if (b !== undefined) groups.push({ count: b, shape: 'circle' as const, color: '#f2a900' });
  return { kind: 'objects', groups };
}

type SymbolP = { a: number; b: number; op: '+' | '-' };
const opSymbol = defineTemplate<SymbolP>({
  id: 'y1-op-symbol',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Recognise +, - and = (choose the correct symbol)',
  levelNotes: ['results within 10', 'results within 20', 'results within 50', 'results within 100'],
  sample: (rng, level) => {
    const max = Y1_MAX[level];
    const op: '+' | '-' = rng.chance(0.5) ? '+' : '-';
    if (op === '+') {
      const a = rng.int(1, max - 1);
      const b = rng.int(1, max - a);
      return { a, b, op };
    }
    const a = rng.int(2, max);
    const b = rng.int(1, a - 1);
    return { a, b, op };
  },
  build: (p, ctx) => {
    const result = p.op === '+' ? p.a + p.b : p.a - p.b;
    const correct = p.op === '+' ? '+' : MINUS;
    const wrong = p.op === '+' ? [MINUS, '='] : ['+', '='];
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: correct },
      wrong.map((label) => ({ label })),
    );
    return {
      difficultyBand: bandWithin(Y1_MAX[ctx.level]),
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Pilih simbol yang betul.', 'Choose the correct symbol.'),
        expression: `${p.a} ? ${p.b} = ${result}`,
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Adakah jawapan lebih besar atau lebih kecil?',
        'Is the answer bigger or smaller?',
      ),
    };
  },
  fixtures: [
    { params: { a: 5, b: 3, op: '+' }, expected: { answerText: '+', expression: '5 ? 3 = 8' } },
  ],
});

type AddP = { a: number; b: number };
function sampleAdd(max: number, rng: { int(a: number, b: number): number }, carry: boolean): AddP {
  for (let i = 0; i < 300; i++) {
    const a = rng.int(1, max - 1);
    const b = rng.int(1, max - a);
    if (!carry || (a % 10) + (b % 10) >= 10) return { a, b };
  }
  return { a: Math.min(9, max - 1), b: 1 };
}
const opAdd = defineTemplate<AddP>({
  id: 'y1-op-add',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Addition within 100 (solve 36 + 14)',
  levelNotes: [
    'sums within 10',
    'sums within 20',
    'sums within 50',
    'sums within 100, regrouping included',
  ],
  arithmetic: true,
  sample: (rng, level) => sampleAdd(Y1_MAX[level], rng, level === 4 && rng.chance(0.6)),
  build: (p, ctx) =>
    numberBuilt({
      band: bandWithin(Y1_MAX[ctx.level]),
      text: tr(ctx, 'Berapakah jumlahnya?', 'What is the total?'),
      expression: `${p.a} + ${p.b} = ?`,
      answer: p.a + p.b,
      hint: tr(
        ctx,
        'Mulakan dengan nombor yang lebih besar, kemudian kira menambah.',
        'Start with the bigger number and count on.',
      ),
      ...(p.a + p.b <= 20 ? { supportVisual: dots(p.a, p.b) } : {}),
    }),
  recompute: (p) => String(Number(p.a) + Number(p.b)),
  fixtures: [
    { params: { a: 36, b: 14 }, expected: { answerText: '50', expression: '36 + 14 = ?' } },
  ],
});

type SubP = { a: number; b: number };
const opSub = defineTemplate<SubP>({
  id: 'y1-op-sub',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Subtraction within 100 (solve 46 - 25)',
  levelNotes: [
    'minuend within 10',
    'minuend within 20',
    'minuend within 50',
    'minuend within 100, regrouping included',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const max = Y1_MAX[level];
    for (let i = 0; i < 300; i++) {
      const a = rng.int(level === 1 ? 2 : 3, max);
      const b = rng.int(1, level === 1 ? a - 1 : a);
      if (level === 4 && rng.chance(0.6) && a % 10 >= b % 10) continue; // prefer regrouping at level 4
      return { a, b };
    }
    return { a: max, b: 1 };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: bandWithin(Y1_MAX[ctx.level]),
      text: tr(ctx, 'Berapakah bakinya?', 'What is left?'),
      expression: `${p.a} ${MINUS} ${p.b} = ?`,
      answer: p.a - p.b,
      hint: tr(ctx, 'Kira ke belakang dari nombor pertama.', 'Count back from the first number.'),
      ...(p.a <= 20 ? { supportVisual: dots(p.a) } : {}),
    }),
  recompute: (p) => String(Number(p.a) - Number(p.b)),
  fixtures: [
    { params: { a: 46, b: 25 }, expected: { answerText: '21', expression: `46 ${MINUS} 25 = ?` } },
  ],
});

type MissingP = { form: 'a+?=c' | '?+b=c' | 'a-?=c' | '?-b=c'; x: number; y: number };
const MISSING_FORMS: Record<Level, MissingP['form'][]> = {
  1: ['a+?=c', '?+b=c'],
  2: ['a+?=c', '?+b=c', 'a-?=c'],
  3: ['a+?=c', '?+b=c', 'a-?=c', '?-b=c'],
  4: ['a+?=c', '?+b=c', 'a-?=c', '?-b=c'],
};
const opMissing = defineTemplate<MissingP>({
  id: 'y1-op-missing',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Missing values in addition and subtraction',
  levelNotes: [
    'addition within 10',
    'addition and a - ? within 20',
    'all four forms within 50',
    'all four forms within 100',
  ],
  prerequisites: ['y1-op-add', 'y1-op-sub'],
  arithmetic: true,
  sample: (rng, level) => {
    const max = Y1_MAX[level];
    const form = rng.pick(MISSING_FORMS[level]);
    if (form === 'a+?=c' || form === '?+b=c') {
      // x + y = total, the missing part is y (form 1) or x (form 2)
      const total = rng.int(3, max);
      const known = rng.int(1, total - 2);
      return { form, x: known, y: total - known };
    }
    // subtraction: total - part = rest
    const total = rng.int(3, max);
    const part = rng.int(1, total - 1);
    return { form, x: total, y: part };
  },
  build: (p, ctx) => {
    let expression: string;
    let answer: number;
    switch (p.form) {
      case 'a+?=c':
        expression = `${p.x} + ? = ${p.x + p.y}`;
        answer = p.y;
        break;
      case '?+b=c':
        expression = `? + ${p.x} = ${p.x + p.y}`;
        answer = p.y;
        break;
      case 'a-?=c':
        expression = `${p.x} ${MINUS} ? = ${p.x - p.y}`;
        answer = p.y;
        break;
      case '?-b=c':
        expression = `? ${MINUS} ${p.y} = ${p.x - p.y}`;
        answer = p.x;
        break;
    }
    return numberBuilt({
      band: bandWithin(Y1_MAX[ctx.level]),
      text: tr(ctx, 'Cari nombor yang hilang.', 'Find the missing number.'),
      expression,
      answer,
      hint: tr(
        ctx,
        'Guna operasi songsang untuk menyemak.',
        'Use the opposite operation to check.',
      ),
    });
  },
  recompute: (p) => {
    const x = Number(p.x);
    const y = Number(p.y);
    return String(p.form === '?-b=c' ? x : y);
  },
  fixtures: [
    {
      params: { form: 'a+?=c', x: 5, y: 7 },
      expected: { answerText: '7', expression: '5 + ? = 12' },
    },
  ],
});

type RepAddP = { step: number; times: number };
const REP_ADD: Record<Level, { steps: number[]; times: [number, number] }> = {
  1: { steps: [2], times: [2, 4] },
  2: { steps: [2, 5], times: [2, 4] },
  3: { steps: [2, 5, 10], times: [3, 5] },
  4: { steps: [2, 5, 10], times: [5, 6] },
};
const repeatedAdd = defineTemplate<RepAddP>({
  id: 'y1-op-repeated-add',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Repeated addition in 2s, 5s and 10s',
  levelNotes: [
    '2s, 2-4 terms (max 8)',
    '2s and 5s, 2-4 terms (max 20)',
    '2s, 5s, 10s, 3-5 terms (max 50)',
    '2s, 5s, 10s, 5-6 terms (max 60)',
  ],
  prerequisites: ['y1-op-add'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = REP_ADD[level];
    return { step: rng.pick(cfg.steps), times: rng.int(cfg.times[0], cfg.times[1]) };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: bandWithin(Y1_MAX[ctx.level]),
      text: tr(ctx, 'Tambah berulang.', 'Repeated addition.'),
      expression: `${Array.from({ length: p.times }, () => String(p.step)).join(' + ')} = ?`,
      answer: p.step * p.times,
      hint: tr(ctx, `Kira melangkau dalam ${p.step}.`, `Skip count in ${p.step}s.`),
      supportVisual: {
        kind: 'objects',
        groups: Array.from({ length: Math.min(p.times, 6) }, (_, i) => ({
          count: p.step,
          shape: 'circle' as const,
          color: i % 2 === 0 ? '#2e86de' : '#f2a900',
        })),
      },
    }),
  recompute: (p) => String(Number(p.step) * Number(p.times)),
  fixtures: [
    { params: { step: 5, times: 3 }, expected: { answerText: '15', expression: '5 + 5 + 5 = ?' } },
  ],
});

type RepSubP = { step: number; groups: number; takes: number };
const REP_SUB: Record<Level, { steps: number[]; groups: [number, number]; max: number }> = {
  1: { steps: [2], groups: [3, 5], max: 10 },
  2: { steps: [2, 5], groups: [3, 4], max: 20 },
  3: { steps: [2, 5, 10], groups: [3, 5], max: 50 },
  4: { steps: [5, 10], groups: [5, 10], max: 100 },
};
const repeatedSub = defineTemplate<RepSubP>({
  id: 'y1-op-repeated-sub',
  topicId: TOPIC,
  widget: 'number-pad',
  sk: SK,
  scope: 'Repeated subtraction in 2s, 5s and 10s',
  levelNotes: [
    '2s, start within 10',
    '2s and 5s, start within 20',
    '2s, 5s, 10s, start within 50',
    '5s and 10s, start within 100',
  ],
  prerequisites: ['y1-op-sub'],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = REP_SUB[level];
    const step = rng.pick(cfg.steps);
    const maxGroups = Math.min(cfg.groups[1], Math.floor(cfg.max / step));
    const groups = rng.int(Math.min(cfg.groups[0], maxGroups), maxGroups);
    // at most 4 subtraction terms so the expression stays short
    const takes = rng.int(2, Math.min(4, groups));
    return { step, groups, takes };
  },
  build: (p, ctx) => {
    const start = p.step * p.groups;
    return numberBuilt({
      band: bandWithin(Y1_MAX[ctx.level]),
      text: tr(ctx, 'Tolak berulang.', 'Repeated subtraction.'),
      expression: `${start} ${MINUS} ${Array.from({ length: p.takes }, () => String(p.step)).join(` ${MINUS} `)} = ?`,
      answer: start - p.step * p.takes,
      hint: tr(ctx, `Kira ke belakang dalam ${p.step}.`, `Count back in ${p.step}s.`),
    });
  },
  recompute: (p) => String(Number(p.step) * (Number(p.groups) - Number(p.takes))),
  fixtures: [
    {
      params: { step: 5, groups: 4, takes: 3 },
      expected: { answerText: '5', expression: `20 ${MINUS} 5 ${MINUS} 5 ${MINUS} 5 = ?` },
    },
  ],
});

export const Y1_OPERATION_TEMPLATES: QuestionTemplate[] = [
  opSymbol,
  opAdd,
  opSub,
  opMissing,
  repeatedAdd,
  repeatedSub,
];
