import type { Level, LocalText, QuestionTemplate } from '../schema';
import { text } from '../text/vocab';
import { numberBuilt } from './builders';
import { buildChoices, defineTemplate, tr } from './helpers';
import { clockLabel, pickClockDistractors } from './y1Time';

// ---------------------------------------------------------------------------------------------
// 5.0 Time
// ---------------------------------------------------------------------------------------------
const T_TOPIC = 'y2-time';
const T_SK = ['5.1-5.2'];

const ALL_MINUTES = Array.from({ length: 60 }, (_, i) => i);
const FIVES = Array.from({ length: 12 }, (_, i) => i * 5);
const CLOCK_MINUTES: Record<Level, number[]> = {
  1: [0, 30],
  2: [0, 15, 30, 45],
  3: FIVES,
  4: ALL_MINUTES,
};
const CLOCK_BAND: Record<Level, string> = {
  1: 'half-hour',
  2: 'quarter-hour',
  3: 'five-minute',
  4: 'minute',
};

type ClockP = { hour: number; minute: number; wrong: number[][] };
const clockRead = defineTemplate<ClockP>({
  id: 'y2-time-clock-read',
  topicId: T_TOPIC,
  widget: 'choice-tiles',
  sk: T_SK,
  scope: 'Read 7:10 on an analogue clock (hours and minutes)',
  levelNotes: [
    'hour and half hour',
    'quarter hours',
    'five-minute intervals',
    'any minute (distractors at least 4 minutes apart)',
  ],
  sample: (rng, level) => {
    const minutes = CLOCK_MINUTES[level];
    const hour = rng.int(1, 12);
    const minute = rng.pick(minutes);
    return {
      hour,
      minute,
      wrong: pickClockDistractors(rng, hour, minute, minutes, level === 4 ? 4 : 0),
    };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: clockLabel(p.hour, p.minute) },
      p.wrong.map(([h, m]) => ({ label: clockLabel(h as number, m as number) })),
    );
    return {
      difficultyBand: CLOCK_BAND[ctx.level],
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Pukul berapa?', 'What time is it?'),
        visual: { kind: 'clock', hour: p.hour, minute: p.minute },
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Jarum pendek: jam. Jarum panjang: minit (kira lima-lima).',
        'Short hand: hour. Long hand: minutes (count in fives).',
      ),
    };
  },
  fixtures: [
    {
      params: {
        hour: 7,
        minute: 10,
        wrong: [
          [7, 20],
          [2, 35],
          [7, 50],
        ],
      },
      expected: { answerText: '7:10' },
    },
  ],
});

const clockMatch = defineTemplate<ClockP>({
  id: 'y2-time-clock-match',
  topicId: T_TOPIC,
  widget: 'choice-tiles',
  sk: T_SK,
  scope: 'Match a written time to an analogue clock',
  levelNotes: ['hour and half hour', 'quarter hours', 'five-minute intervals', 'any minute'],
  prerequisites: ['y2-time-clock-read'],
  sample: (rng, level) => {
    const minutes = CLOCK_MINUTES[level];
    const hour = rng.int(1, 12);
    const minute = rng.pick(minutes);
    return {
      hour,
      minute,
      wrong: pickClockDistractors(rng, hour, minute, minutes, level === 4 ? 25 : 15),
    };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { visual: { kind: 'clock', hour: p.hour, minute: p.minute } },
      p.wrong.map(([h, m]) => ({
        visual: { kind: 'clock' as const, hour: h as number, minute: m as number },
      })),
    );
    return {
      difficultyBand: CLOCK_BAND[ctx.level],
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Pilih jam yang betul.', 'Choose the matching clock.'),
        expression: clockLabel(p.hour, p.minute),
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Letakkan jarum pendek pada jam, kemudian jarum panjang pada minit.',
        'Find the hour first, then check the long hand for minutes.',
      ),
    };
  },
  fixtures: [
    {
      params: {
        hour: 7,
        minute: 10,
        wrong: [
          [7, 45],
          [1, 35],
          [10, 10],
        ],
      },
      expected: { answerText: 'clock 7:10', expression: '7:10' },
    },
  ],
});

type UnitsP = { kind: 'hour' | 'day'; n: number };
const UNITS_N: Record<Level, [number, number]> = { 1: [1, 1], 2: [1, 2], 3: [1, 3], 4: [2, 5] };
const timeUnits = defineTemplate<UnitsP>({
  id: 'y2-time-units',
  topicId: T_TOPIC,
  widget: 'number-pad',
  sk: T_SK,
  scope: 'Relate 1 hour to 60 minutes and 1 day to 24 hours',
  levelNotes: [
    '1 hour or 1 day',
    'up to 2 hours or 2 days',
    'up to 3 hours or 3 days',
    '2 to 5 hours or days',
  ],
  arithmetic: true,
  sample: (rng, level) => ({
    kind: rng.chance(0.5) ? 'hour' : 'day',
    n: rng.int(UNITS_N[level][0], UNITS_N[level][1]),
  }),
  build: (p, ctx) =>
    numberBuilt({
      band: p.kind === 'hour' ? 'hour-minute' : 'day-hour',
      text: tr(ctx, 'Lengkapkan.', 'Complete.'),
      expression:
        p.kind === 'hour'
          ? tr(ctx, `${p.n} jam = ? minit`, `${p.n} hour${p.n > 1 ? 's' : ''} = ? minutes`)
          : tr(ctx, `${p.n} hari = ? jam`, `${p.n} day${p.n > 1 ? 's' : ''} = ? hours`),
      answer: p.kind === 'hour' ? p.n * 60 : p.n * 24,
      hint:
        p.kind === 'hour'
          ? tr(ctx, '1 jam = 60 minit.', '1 hour = 60 minutes.')
          : tr(ctx, '1 hari = 24 jam.', '1 day = 24 hours.'),
    }),
  recompute: (p) => String(p.kind === 'hour' ? p.n * 60 : p.n * 24),
  fixtures: [
    {
      params: { kind: 'hour', n: 2 },
      expected: { answerText: '120', expression: '2 jam = ? minit' },
    },
  ],
});

type DurationP = { startMin: number; durationMin: number };
const DURATIONS: Record<Level, number[]> = {
  1: [15, 30, 45],
  2: [10, 20, 25, 35, 40, 50, 55],
  3: [10, 20, 25, 35, 40, 50, 55, 15, 30, 45],
  4: [65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115],
};
const fmtTime = (minOfDay: number): string => {
  const h24 = Math.floor(minOfDay / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${(minOfDay % 60).toString().padStart(2, '0')}`;
};
const duration = defineTemplate<DurationP>({
  id: 'y2-time-duration',
  topicId: T_TOPIC,
  widget: 'number-pad',
  sk: T_SK,
  scope: 'Record a school timetable event (how many minutes?)',
  levelNotes: [
    '15, 30 or 45 minutes from the hour',
    'multiples of 5 minutes within the hour',
    'multiples of 5 minutes, may cross the hour',
    'longer than 1 hour, in minutes',
  ],
  prerequisites: ['y2-time-units'],
  arithmetic: true,
  sample: (rng, level) => {
    const durationMin = rng.pick(DURATIONS[level]);
    // Start between 7:00 and 12:55 on the 5-minute grid; level 1 starts on the hour.
    const startMin = level === 1 ? rng.int(7, 12) * 60 : rng.int(7 * 12, 12 * 12 + 11) * 5;
    return { startMin, durationMin };
  },
  build: (p, ctx) => {
    const start = fmtTime(p.startMin);
    const end = fmtTime(p.startMin + p.durationMin);
    return numberBuilt({
      band: p.durationMin >= 60 ? 'over-an-hour' : 'within-an-hour',
      text: tr(
        ctx,
        'Berapa minit kelas ini berlangsung?',
        'How many minutes does the lesson last?',
      ),
      expression: tr(ctx, `Mula ${start}, tamat ${end}`, `Start ${start}, end ${end}`),
      unit: tr(ctx, 'minit', 'minutes'),
      answer: p.durationMin,
      hint: tr(
        ctx,
        'Kira dari masa mula ke masa tamat. 1 jam = 60 minit.',
        'Count from the start to the end. 1 hour = 60 minutes.',
      ),
    });
  },
  // Independent check: parse the two displayed clock times back and take the difference on a 12-hour face.
  recompute: (p) => {
    const parse = (t: string): number => {
      const [h = '0', m = '0'] = t.split(':');
      return (Number(h) % 12) * 60 + Number(m);
    };
    return String(
      (parse(fmtTime(p.startMin + p.durationMin)) - parse(fmtTime(p.startMin)) + 720) % 720,
    );
  },
  fixtures: [
    {
      params: { startMin: 480, durationMin: 30 },
      expected: { answerText: '30', expression: 'Mula 8:00, tamat 8:30' },
    },
  ],
});

// ---------------------------------------------------------------------------------------------
// 6.0 Measurement
// ---------------------------------------------------------------------------------------------
const M_TOPIC = 'y2-measurement';
const M_SK = ['6.1-6.3'];

type Dim = 'length' | 'mass' | 'volume';
const DIM_UNITS: Record<Dim, [string, string]> = {
  length: ['cm', 'm'],
  mass: ['g', 'kg'],
  volume: ['ml', 'L'],
};
type UnitItem = { dim: Dim; unit: string; name: LocalText };
const UNIT_ITEMS: UnitItem[] = [
  {
    dim: 'length',
    unit: 'cm',
    name: { bm: 'panjang sebatang pensel', en: 'the length of a pencil' },
  },
  { dim: 'length', unit: 'cm', name: { bm: 'lebar sebuah buku', en: 'the width of a book' } },
  { dim: 'length', unit: 'cm', name: { bm: 'tinggi sebiji cawan', en: 'the height of a cup' } },
  {
    dim: 'length',
    unit: 'm',
    name: { bm: 'panjang bilik darjah', en: 'the length of the classroom' },
  },
  { dim: 'length', unit: 'm', name: { bm: 'tinggi sebuah pintu', en: 'the height of a door' } },
  {
    dim: 'length',
    unit: 'm',
    name: { bm: 'panjang padang sekolah', en: 'the length of the school field' },
  },
  { dim: 'mass', unit: 'g', name: { bm: 'jisim sebiji epal', en: 'the mass of an apple' } },
  { dim: 'mass', unit: 'g', name: { bm: 'jisim sebiji telur', en: 'the mass of an egg' } },
  { dim: 'mass', unit: 'g', name: { bm: 'jisim sebatang pen', en: 'the mass of a pen' } },
  { dim: 'mass', unit: 'kg', name: { bm: 'jisim seorang murid', en: 'the mass of a pupil' } },
  { dim: 'mass', unit: 'kg', name: { bm: 'jisim seekor kambing', en: 'the mass of a goat' } },
  {
    dim: 'mass',
    unit: 'kg',
    name: { bm: 'jisim sekampit beras', en: 'the mass of a sack of rice' },
  },
  { dim: 'volume', unit: 'ml', name: { bm: 'air dalam sebiji cawan', en: 'the water in a cup' } },
  {
    dim: 'volume',
    unit: 'ml',
    name: { bm: 'ubat dalam satu sudu', en: 'the medicine in a spoon' },
  },
  {
    dim: 'volume',
    unit: 'ml',
    name: { bm: 'air dalam botol kecil', en: 'the water in a small bottle' },
  },
  { dim: 'volume', unit: 'L', name: { bm: 'air dalam sebuah baldi', en: 'the water in a bucket' } },
  {
    dim: 'volume',
    unit: 'L',
    name: { bm: 'air dalam tangki air', en: 'the water in a water tank' },
  },
  { dim: 'volume', unit: 'L', name: { bm: 'air dalam sebuah kolam', en: 'the water in a pond' } },
];
const ALL_UNITS = ['cm', 'm', 'g', 'kg', 'ml', 'L'];

type ChooseUnitP = { item: number; extras: string[] };
const chooseUnit = defineTemplate<ChooseUnitP>({
  id: 'y2-meas-choose-unit',
  topicId: M_TOPIC,
  widget: 'choice-tiles',
  sk: M_SK,
  scope: 'Choose cm or m; choose a sensible unit',
  levelNotes: [
    'two units of the same kind',
    'plus one unit of another kind',
    'plus one unit of another kind',
    'plus two units of other kinds',
  ],
  sample: (rng, level) => {
    const item = rng.int(0, UNIT_ITEMS.length - 1);
    const it = UNIT_ITEMS[item] as UnitItem;
    const sameKind = DIM_UNITS[it.dim].filter((u) => u !== it.unit);
    const otherKinds = rng.shuffle(ALL_UNITS.filter((u) => !DIM_UNITS[it.dim].includes(u)));
    const extraCount = level === 1 ? 0 : level === 4 ? 2 : 1;
    return { item, extras: [...sameKind, ...otherKinds.slice(0, extraCount)] };
  },
  build: (p, ctx) => {
    const it = UNIT_ITEMS[p.item] as UnitItem;
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: it.unit },
      p.extras.map((u) => ({ label: u })),
    );
    return {
      difficultyBand: `options-${options.length}`,
      widget: 'choice-tiles',
      prompt: {
        text: tr(
          ctx,
          `Unit yang sesuai untuk mengukur ${text('bm', it.name)}?`,
          `Which unit is best for measuring ${text('en', it.name)}?`,
        ),
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Bayangkan benda itu. Adakah ia kecil atau besar?',
        'Picture the object. Is it small or big?',
      ),
    };
  },
  fixtures: [{ params: { item: 0, extras: ['m'] }, expected: { answerText: 'cm' } }],
});

type RulerP = { lengthCm: number; maxCm: number };
const RULER_CFG: Record<Level, { max: number; min: number }> = {
  1: { max: 10, min: 2 },
  2: { max: 15, min: 3 },
  3: { max: 20, min: 4 },
  4: { max: 20, min: 6 },
};
const ruler = defineTemplate<RulerP>({
  id: 'y2-meas-ruler',
  topicId: M_TOPIC,
  widget: 'number-pad',
  sk: M_SK,
  scope: 'Read a ruler (measure length in centimetres)',
  levelNotes: ['2-10 cm', '3-15 cm', '4-20 cm', '6-20 cm'],
  arithmetic: true,
  sample: (rng, level) => ({
    lengthCm: rng.int(RULER_CFG[level].min, RULER_CFG[level].max),
    maxCm: RULER_CFG[level].max,
  }),
  build: (p, ctx) =>
    numberBuilt({
      band: `ruler-${p.maxCm}cm`,
      text: tr(ctx, 'Berapa panjang bar ini?', 'How long is this bar?'),
      visual: { kind: 'ruler', lengthCm: p.lengthCm, maxCm: p.maxCm },
      unit: 'cm',
      answer: p.lengthCm,
      hint: tr(ctx, 'Mulakan dari sifar pada pembaris.', 'Start at zero on the ruler.'),
    }),
  recompute: (p) => String(p.lengthCm),
  fixtures: [{ params: { lengthCm: 7, maxCm: 10 }, expected: { answerText: '7' } }],
});

type CupP = { ml: number; maxMl: number };
const CUP_CFG: Record<Level, { max: number; step: number }> = {
  1: { max: 500, step: 100 },
  2: { max: 1000, step: 100 },
  3: { max: 1000, step: 50 },
  4: { max: 1000, step: 50 },
};
const cup = defineTemplate<CupP>({
  id: 'y2-meas-cup',
  topicId: M_TOPIC,
  widget: 'number-pad',
  sk: M_SK,
  scope: 'Read a measuring cup (millilitres)',
  levelNotes: [
    'multiples of 100 ml, cup to 500 ml',
    'multiples of 100 ml, cup to 1000 ml',
    'multiples of 50 ml, cup to 1000 ml',
    'multiples of 50 ml, cup to 1000 ml',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const cfg = CUP_CFG[level];
    return {
      ml: cfg.step * rng.int(1, Math.floor(cfg.max / cfg.step) - (level >= 3 ? 1 : 0)),
      maxMl: cfg.max,
    };
  },
  build: (p, ctx) =>
    numberBuilt({
      band: `cup-${p.maxMl}ml`,
      text: tr(ctx, 'Berapa isi padu air?', 'How much water is in the cup?'),
      visual: { kind: 'cup', ml: p.ml, maxMl: p.maxMl },
      unit: 'ml',
      answer: p.ml,
      hint: tr(
        ctx,
        'Lihat garisan yang paling dekat dengan aras air.',
        'Look at the line nearest the water level.',
      ),
    }),
  recompute: (p) => String(p.ml),
  fixtures: [{ params: { ml: 350, maxMl: 1000 }, expected: { answerText: '350' } }],
});

type ComparePhrase = { max: LocalText; min: LocalText };
const COMPARE_PHRASES: Record<Dim, ComparePhrase> = {
  length: {
    max: { bm: 'Yang mana paling panjang?', en: 'Which is the longest?' },
    min: { bm: 'Yang mana paling pendek?', en: 'Which is the shortest?' },
  },
  mass: {
    max: { bm: 'Yang mana paling berat?', en: 'Which is the heaviest?' },
    min: { bm: 'Yang mana paling ringan?', en: 'Which is the lightest?' },
  },
  volume: {
    max: { bm: 'Yang mana paling banyak?', en: 'Which has the most?' },
    min: { bm: 'Yang mana paling sedikit?', en: 'Which has the least?' },
  },
};
type CompareP = { dim: Dim; unitIdx: 0 | 1; values: number[]; ask: 'max' | 'min' };
const COMPARE_CFG: Record<Level, { count: number; hi: number }> = {
  1: { count: 2, hi: 20 },
  2: { count: 3, hi: 100 },
  3: { count: 3, hi: 999 },
  4: { count: 4, hi: 999 },
};
const compareUnits = defineTemplate<CompareP>({
  id: 'y2-meas-compare',
  topicId: M_TOPIC,
  widget: 'choice-tiles',
  sk: M_SK,
  scope: 'Compare measurements in the same unit',
  levelNotes: [
    '2 values up to 20',
    '3 values up to 100',
    '3 values up to 999',
    '4 values up to 999',
  ],
  sample: (rng, level) => {
    const cfg = COMPARE_CFG[level];
    const set = new Set<number>();
    while (set.size < cfg.count) set.add(rng.int(1, cfg.hi));
    return {
      dim: rng.pick<Dim>(['length', 'mass', 'volume']),
      unitIdx: rng.chance(0.5) ? 0 : 1,
      values: [...set],
      ask: rng.chance(0.5) ? 'max' : 'min',
    };
  },
  build: (p, ctx) => {
    const unit = DIM_UNITS[p.dim][p.unitIdx];
    const target = p.ask === 'max' ? Math.max(...p.values) : Math.min(...p.values);
    const label = (v: number): string => `${v} ${unit}`;
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: label(target) },
      p.values.filter((v) => v !== target).map((v) => ({ label: label(v) })),
    );
    return {
      difficultyBand: `values-${p.values.length}`,
      widget: 'choice-tiles',
      prompt: { text: text(ctx.language, COMPARE_PHRASES[p.dim][p.ask]) },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Unitnya sama. Bandingkan nombor sahaja.',
        'The units are the same. Compare the numbers.',
      ),
    };
  },
  fixtures: [
    {
      params: { dim: 'mass', unitIdx: 0, values: [350, 530, 410], ask: 'max' },
      expected: { answerText: '530 g' },
    },
  ],
});

export const Y2_TIME_TEMPLATES: QuestionTemplate[] = [clockRead, clockMatch, timeUnits, duration];
export const Y2_MEASURE_TEMPLATES: QuestionTemplate[] = [chooseUnit, ruler, cup, compareUnits];
