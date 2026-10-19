import type { Level, QuestionTemplate } from '../schema';
import type { MeasuringUnit, ObjectShape } from '../visual';
import { MEASURING_UNIT_NAMES, OBJECT_COLORS, OBJECT_SHAPE_NAMES, text } from '../text/vocab';
import { numberBuilt } from './builders';
import {
  COUNT_SHAPES,
  color,
  countAllHint,
  countPicture,
  equationShown,
  fivesHint,
  framesHint,
  moneyItems,
  shapeCountTemplate,
} from './easyShared';
import { MINUS, defineTemplate, tr } from './helpers';

/**
 * Year 1 "Kira & taip" questions (DECISIONS #42): look at a picture, count, type one whole number. Each keeps its
 * topic's SK range exactly as printed in the KPM plan and an empty SP list (packs are drafts; no codes invented).
 */

const pickRange = (lo: number, hi: number): [number, number] => [lo, hi];

// ------------------------------------------------------------------------------ 1.0 Whole numbers

const N_TOPIC = 'y1-numbers';
const N_SK = ['1.1-1.5'];

const COUNT_RANGE: Record<Level, [number, number]> = {
  1: pickRange(1, 5),
  2: pickRange(3, 10),
  3: pickRange(8, 20),
  4: pickRange(20, 50),
};

type CountP = { count: number; shape: ObjectShape; colorIdx: number };
const count = defineTemplate<CountP>({
  id: 'y1-easy-count',
  topicId: N_TOPIC,
  widget: 'number-pad',
  sk: N_SK,
  scope: 'Name, count and write numbers (count objects)',
  levelNotes: ['1-5 objects', '3-10 objects', '8-20 in ten-frames', '20-50 in ten-frames'],
  arithmetic: true,
  sample: (rng, level) => ({
    count: rng.int(COUNT_RANGE[level][0], COUNT_RANGE[level][1]),
    shape: rng.pick(COUNT_SHAPES),
    colorIdx: rng.int(0, OBJECT_COLORS.length - 1),
  }),
  build: (p, ctx) => {
    const visual = countPicture(
      [{ count: p.count, shape: p.shape, color: color(p.colorIdx) }],
      ctx.level >= 3,
    );
    return numberBuilt({
      band: `count-${COUNT_RANGE[ctx.level][1]}`,
      cue: 'count',
      text: tr(ctx, 'Berapa?', 'How many?'),
      visual,
      answer: p.count,
      hint: fivesHint(ctx),
      hintVisual: framesHint(visual),
    });
  },
  recompute: (p) => String(p.count),
  fixtures: [{ params: { count: 7, shape: 'circle', colorIdx: 0 }, expected: { answerText: '7' } }],
});

const ONE_MORE_MAX: Record<Level, number> = { 1: 5, 2: 10, 3: 20, 4: 20 };
type OneMoreP = {
  count: number;
  more: boolean;
  shape: ObjectShape;
  colorIdx: number;
  eq: boolean;
};
const oneMore = defineTemplate<OneMoreP>({
  id: 'y1-easy-one-more',
  topicId: N_TOPIC,
  widget: 'number-pad',
  sk: N_SK,
  scope: 'Name, count and write numbers (one more, one fewer)',
  levelNotes: [
    '1-5 objects (the result is drawn, to count)',
    '1-10 objects (the equation is drawn on about half)',
    '1-20 objects',
    '1-20 objects',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const more = rng.chance(0.5);
    return {
      // level 1 draws the result, so a "one more" start leaves room for it within 5
      count: rng.int(more ? 1 : 2, more && level === 1 ? 4 : ONE_MORE_MAX[level]),
      more,
      shape: rng.pick(COUNT_SHAPES),
      colorIdx: rng.int(0, OBJECT_COLORS.length - 1),
      eq: equationShown(rng, level),
    };
  },
  build: (p, ctx) => {
    const answer = p.more ? p.count + 1 : p.count - 1;
    if (ctx.level === 1) {
      // Tahap 1 (DECISIONS #47): just the group that results, to count; no +1 / -1 badge
      const result = countPicture(
        [{ count: answer, shape: p.shape, color: color(p.colorIdx) }],
        false,
      );
      return numberBuilt({
        band: 'count-after',
        cue: 'count',
        text: tr(ctx, 'Berapa?', 'How many?'),
        visual: result,
        answer,
        hint: countAllHint(ctx),
        hintVisual: framesHint(result),
      });
    }
    const visual = countPicture(
      [{ count: p.count, shape: p.shape, color: color(p.colorIdx) }],
      p.count > 10,
    );
    return numberBuilt({
      band: p.more ? 'one-more' : 'one-fewer',
      cue: p.more ? 'plus-one' : 'minus-one',
      // Tahap 2 (DECISIONS #48): "4 + 1 = ?" is drawn on some of these questions
      expression: `${p.count} ${p.more ? '+' : MINUS} 1 = ?`,
      showExpression: p.eq,
      text: p.more
        ? tr(ctx, 'Tambah satu lagi. Berapa?', 'One more. How many?')
        : tr(ctx, 'Kurang satu. Berapa?', 'One fewer. How many?'),
      visual,
      answer,
      hint: p.more
        ? tr(
            ctx,
            'Kira semua, kemudian sebut nombor seterusnya.',
            'Count them, then say the next number.',
          )
        : tr(
            ctx,
            'Kira semua, kemudian sebut nombor sebelumnya.',
            'Count them, then say the number before.',
          ),
      hintVisual: framesHint(visual),
    });
  },
  recompute: (p) => String(p.more ? p.count + 1 : p.count - 1),
  fixtures: [
    {
      params: { count: 6, more: true, shape: 'star', colorIdx: 1, eq: false },
      expected: { answerText: '7' },
    },
  ],
});

// ------------------------------------------------------------------------------ 2.0 Operations

const O_TOPIC = 'y1-operations';
const O_SK = ['2.1-2.5'];
const SUM_MAX: Record<Level, number> = { 1: 5, 2: 10, 3: 20, 4: 30 };

type AddP = {
  a: number;
  b: number;
  shape: ObjectShape;
  colorA: number;
  colorB: number;
  eq: boolean;
};
const add = defineTemplate<AddP>({
  id: 'y1-easy-add',
  topicId: O_TOPIC,
  widget: 'number-pad',
  sk: O_SK,
  scope: 'Addition within 100 (two groups: count them all)',
  levelNotes: [
    'sum 2-5 (one row, two colours)',
    'sum up to 10 (the equation is drawn on about half)',
    'sum up to 20 in ten-frames',
    'sum up to 30 in ten-frames',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const total = rng.int(2, SUM_MAX[level]);
    const a = rng.int(1, total - 1);
    return {
      a,
      b: total - a,
      shape: rng.pick(COUNT_SHAPES),
      colorA: rng.int(0, 2),
      colorB: rng.int(3, 5),
      eq: equationShown(rng, level),
    };
  },
  build: (p, ctx) => {
    const visual = countPicture(
      [
        { count: p.a, shape: p.shape, color: color(p.colorA) },
        { count: p.b, shape: p.shape, color: color(p.colorB) },
      ],
      ctx.level >= 3,
      // Tahap 1 (DECISIONS #47): one row told apart by colour; the "+" sign starts at level 2
      ctx.level === 1 ? 'merge' : 'plus',
    );
    return numberBuilt({
      band: `sum-${SUM_MAX[ctx.level]}`,
      cue: 'count',
      text: tr(ctx, 'Berapa semua?', 'How many altogether?'),
      expression: `${p.a} + ${p.b} = ?`,
      showExpression: p.eq,
      visual,
      answer: p.a + p.b,
      hint: ctx.level === 1 ? countAllHint(ctx) : fivesHint(ctx),
      hintVisual: framesHint(visual),
    });
  },
  recompute: (p) => String(p.a + p.b),
  fixtures: [
    {
      params: { a: 3, b: 2, shape: 'circle', colorA: 0, colorB: 3, eq: false },
      level: 1,
      expected: { answerText: '5', expression: '3 + 2 = ?' },
    },
  ],
});

type SubP = { a: number; b: number; shape: ObjectShape; colorIdx: number; eq: boolean };
const sub = defineTemplate<SubP>({
  id: 'y1-easy-sub',
  topicId: O_TOPIC,
  widget: 'number-pad',
  sk: O_SK,
  scope: 'Subtraction within 100 (some crossed out: how many are left?)',
  levelNotes: [
    'from 2-5 (only what is left is drawn)',
    'from up to 10 (the equation is drawn on about half)',
    'from up to 20 in ten-frames',
    'from up to 30 in ten-frames',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const a = rng.int(2, SUM_MAX[level]);
    return {
      a,
      b: rng.int(1, a - 1),
      shape: rng.pick(COUNT_SHAPES),
      colorIdx: rng.int(0, OBJECT_COLORS.length - 1),
      eq: equationShown(rng, level),
    };
  },
  build: (p, ctx) => {
    // Tahap 1 (DECISIONS #47): only the things that are left, nothing crossed out
    const left = ctx.level === 1;
    const visual = countPicture(
      [
        left
          ? { count: p.a - p.b, shape: p.shape, color: color(p.colorIdx) }
          : { count: p.a, crossed: p.b, shape: p.shape, color: color(p.colorIdx) },
      ],
      ctx.level >= 3,
    );
    return numberBuilt({
      band: `from-${SUM_MAX[ctx.level]}`,
      cue: 'count',
      text: tr(ctx, 'Berapa tinggal?', 'How many are left?'),
      expression: `${p.a} ${MINUS} ${p.b} = ?`,
      showExpression: p.eq,
      visual,
      answer: p.a - p.b,
      hint: left
        ? countAllHint(ctx)
        : tr(ctx, 'Kira yang tidak dipangkah sahaja.', 'Count only the ones not crossed out.'),
      hintVisual: framesHint(visual),
    });
  },
  recompute: (p) => String(p.a - p.b),
  fixtures: [
    {
      params: { a: 5, b: 2, shape: 'star', colorIdx: 0, eq: false },
      level: 1,
      expected: { answerText: '3', expression: `5 ${MINUS} 2 = ?` },
    },
  ],
});

const GROUP_SIZES: Record<Level, number[]> = { 1: [2], 2: [2, 5], 3: [2, 5, 10], 4: [2, 5, 10] };
const GROUP_TOTAL: Record<Level, number> = { 1: 10, 2: 20, 3: 50, 4: 50 };

type GroupsP = { size: number; groups: number; shape: ObjectShape; colorIdx: number };
const groups = defineTemplate<GroupsP>({
  id: 'y1-easy-groups',
  topicId: O_TOPIC,
  widget: 'number-pad',
  sk: O_SK,
  scope: 'Repeated addition in 2s, 5s and 10s (equal groups: count them all)',
  levelNotes: [
    'groups of 2, up to 10 (no rings)',
    'groups of 2 or 5, up to 20',
    'groups of 2, 5 or 10, up to 50',
    'groups of 2, 5 or 10, up to 50',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const size = rng.pick(GROUP_SIZES[level]);
    const maxGroups = Math.min(10, Math.floor(GROUP_TOTAL[level] / size));
    return {
      size,
      groups: rng.int(2, Math.max(2, maxGroups)),
      shape: rng.pick(COUNT_SHAPES),
      colorIdx: rng.int(0, OBJECT_COLORS.length - 1),
    };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `groups-of-${p.size}`,
      cue: 'count',
      text: tr(
        ctx,
        `Kumpulan ${p.size}. Berapa semua?`,
        `Groups of ${p.size}. How many altogether?`,
      ),
      visual: {
        kind: 'equal-groups',
        groups: p.groups,
        perGroup: p.size,
        shape: p.shape,
        color: color(p.colorIdx),
        // Tahap 1 (DECISIONS #47): pairs set apart, no rings
        ...(ctx.level === 1 ? { plain: true } : {}),
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
      params: { size: 2, groups: 4, shape: 'circle', colorIdx: 0 },
      level: 1,
      expected: { answerText: '8' },
    },
  ],
});

// ------------------------------------------------------------------------------ 3.0 Money

const M_TOPIC = 'y1-money';
const M_SK = ['3.1-3.2'];

type MoneyP = { items: number[] };
const money = defineTemplate<MoneyP>({
  id: 'y1-easy-money',
  topicId: M_TOPIC,
  widget: 'number-pad',
  sk: M_SK,
  scope:
    'Recognise Malaysian coins and notes (count the coins, or the dots that show a note’s ringgit)',
  levelNotes: [
    'count 1-5 coins',
    'count 2-5 coins',
    'RM1 notes: one dot each, 1-10 notes',
    'one RM5 note (five dots) and 1-5 RM1 notes',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    if (level === 1) return { items: Array.from({ length: rng.int(1, 5) }, () => 10) };
    if (level === 2) {
      const v = rng.pick([10, 20]);
      return { items: Array.from({ length: rng.int(2, 5) }, () => v) };
    }
    if (level === 3) return { items: Array.from({ length: rng.int(1, 10) }, () => 100) };
    return { items: [500, ...Array.from({ length: rng.int(1, 5) }, () => 100)] };
  },
  build: (p, ctx) => {
    const total = p.items.reduce((n, v) => n + v, 0);
    const ringgit = (p.items[0] ?? 0) >= 100;
    return numberBuilt({
      band: ringgit ? 'ringgit' : 'sen',
      cue: 'count',
      text: ringgit
        ? tr(ctx, 'Berapa ringgit?', 'How many ringgit?')
        : tr(ctx, 'Berapa syiling?', 'How many coins?'),
      visual: moneyItems(p.items),
      answer: ringgit ? total / 100 : p.items.length,
      hint: ringgit
        ? p.items.includes(500)
          ? tr(
              ctx,
              'Mula pada RM5, kemudian kira RM1 satu-satu.',
              'Start at RM5, then count each RM1 note.',
            )
          : tr(ctx, 'Kira setiap wang kertas RM1.', 'Count each RM1 note.')
        : tr(ctx, 'Kira setiap syiling.', 'Count each coin.'),
    });
  },
  recompute: (p) => {
    const total = p.items.reduce((n, v) => n + v, 0);
    return String((p.items[0] ?? 0) >= 100 ? total / 100 : p.items.length);
  },
  fixtures: [{ params: { items: [10, 10, 10] }, level: 1, expected: { answerText: '3' } }],
});

// ------------------------------------------------------------------------------ 4.0 Time

type HourP = { hour: number };
const clockHour = defineTemplate<HourP>({
  id: 'y1-easy-clock-hour',
  topicId: 'y1-time',
  widget: 'number-pad',
  sk: ['4.1-4.2'],
  scope: 'Tell and write the hour on an analogue clock (o’clock)',
  levelNotes: ['1 to 6 o’clock', '1 to 12 o’clock', '1 to 12 o’clock', '1 to 12 o’clock'],
  arithmetic: true,
  sample: (rng, level) => ({ hour: rng.int(1, level === 1 ? 6 : 12) }),
  build: (p, ctx) =>
    numberBuilt({
      band: 'hour',
      cue: 'hour',
      text: tr(ctx, 'Pukul berapa?', 'What hour is it?'),
      visual: { kind: 'clock', hour: p.hour, minute: 0 },
      answer: p.hour,
      hint: tr(
        ctx,
        'Lihat nombor yang ditunjuk jarum pendek.',
        'Read the number the short hand points to.',
      ),
    }),
  recompute: (p) => String(p.hour),
  fixtures: [{ params: { hour: 3 }, expected: { answerText: '3' } }],
});

// ------------------------------------------------------------------------------ 5.0 Measurement

const MEASURING_UNITS: MeasuringUnit[] = ['paperclip', 'block', 'cube'];
const UNIT_RANGE: Record<Level, [number, number]> = {
  1: pickRange(2, 5),
  2: pickRange(3, 8),
  3: pickRange(5, 12),
  4: pickRange(5, 15),
};
type UnitP = { units: number; unit: MeasuringUnit };
const unitCount = defineTemplate<UnitP>({
  id: 'y1-easy-unit-count',
  topicId: 'y1-measurement',
  widget: 'number-pad',
  sk: ['5.1'],
  scope: 'Measure length using non-standard units (how many paper clips long?)',
  levelNotes: ['2-5 units', '3-8 units', '5-12 units', '5-15 units'],
  arithmetic: true,
  sample: (rng, level) => ({
    units: rng.int(UNIT_RANGE[level][0], UNIT_RANGE[level][1]),
    unit: rng.pick(MEASURING_UNITS),
  }),
  build: (p, ctx) => {
    const word = text(ctx.language, MEASURING_UNIT_NAMES[p.unit]);
    return numberBuilt({
      band: `units-${UNIT_RANGE[ctx.level][1]}`,
      cue: 'count',
      text: tr(ctx, `Berapa ${word} panjangnya?`, `How many ${word} long?`),
      visual: { kind: 'unit-bar', units: p.units, unit: p.unit },
      answer: p.units,
      hint: tr(ctx, 'Kira dari hujung ke hujung.', 'Count from end to end.'),
    });
  },
  recompute: (p) => String(p.units),
  fixtures: [{ params: { units: 6, unit: 'paperclip' }, expected: { answerText: '6' } }],
});

// ------------------------------------------------------------------------------ 6.0 Space

const shapeCount = shapeCountTemplate({
  id: 'y1-easy-shape-count',
  topicId: 'y1-space',
  sk: ['6.1-6.2'],
  pools: {
    1: ['triangle', 'square', 'rectangle'],
    2: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'],
    3: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'],
    4: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'],
  },
  cornersFrom: 2,
});

// ------------------------------------------------------------------------------ 7.0 Data

const ROW_SHAPES: ObjectShape[] = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart'];
const PICTO: Record<Level, { rows: number; max: number }> = {
  1: { rows: 3, max: 5 },
  2: { rows: 3, max: 7 },
  3: { rows: 4, max: 9 },
  4: { rows: 4, max: 10 },
};
type PictoP = { shapes: ObjectShape[]; counts: number[]; ask: number };
const pictograph = defineTemplate<PictoP>({
  id: 'y1-easy-pictograph',
  topicId: 'y1-data',
  widget: 'number-pad',
  sk: ['7.1-7.2'],
  scope: 'Read a pictograph where one picture represents one item (count one row)',
  levelNotes: [
    '3 rows, up to 5 (other rows faded)',
    '3 rows, up to 7',
    '4 rows, up to 9',
    '4 rows, up to 10',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = PICTO[level];
    const shapes = rng.shuffle(ROW_SHAPES).slice(0, cfg.rows);
    return {
      shapes,
      counts: shapes.map(() => rng.int(1, cfg.max)),
      ask: rng.int(0, cfg.rows - 1),
    };
  },
  build: (p, ctx) => {
    const rows = p.shapes.map((shape, i) => ({
      label: text(ctx.language, OBJECT_SHAPE_NAMES[shape]),
      count: p.counts[i] as number,
      shape,
      color: color(i),
    }));
    const row = rows[p.ask];
    if (!row) throw new Error('y1-easy-pictograph: ask index out of range');
    return numberBuilt({
      band: `rows-${rows.length}`,
      cue: 'count',
      text: tr(ctx, `Berapa ${row.label.toLowerCase()}?`, `How many ${row.label.toLowerCase()}s?`),
      visual: {
        kind: 'pictograph',
        rows,
        highlight: p.ask,
        ...(ctx.level === 1 ? { dimOthers: true } : {}),
      },
      answer: row.count,
      hint: tr(ctx, 'Kira gambar pada baris itu sahaja.', 'Count the pictures in that row only.'),
    });
  },
  recompute: (p) => String(p.counts[p.ask]),
  fixtures: [
    {
      params: { shapes: ['circle', 'square', 'triangle'], counts: [4, 2, 5], ask: 0 },
      level: 1,
      expected: { answerText: '4' },
    },
  ],
});

export const Y1_EASY_TEMPLATES: QuestionTemplate[] = [
  count,
  oneMore,
  add,
  sub,
  groups,
  money,
  clockHour,
  unitCount,
  shapeCount,
  pictograph,
];
