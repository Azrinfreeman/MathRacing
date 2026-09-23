import type { Level, LocalText, QuestionTemplate } from '../schema';
import { DAYS, MONTHS, text } from '../text/vocab';
import { orderBuilt } from './builders';
import { buildChoices, defineTemplate, tr } from './helpers';

const TOPIC = 'y1-time';
const SK = ['4.1-4.2'];

const EVENT_SETS: Record<'morning' | 'evening', LocalText[]> = {
  morning: [
    { bm: 'Bangun tidur', en: 'Wake up' },
    { bm: 'Gosok gigi', en: 'Brush teeth' },
    { bm: 'Makan sarapan', en: 'Eat breakfast' },
    { bm: 'Pergi ke sekolah', en: 'Go to school' },
  ],
  evening: [
    { bm: 'Pulang dari sekolah', en: 'Come home from school' },
    { bm: 'Makan malam', en: 'Eat dinner' },
    { bm: 'Gosok gigi', en: 'Brush teeth' },
    { bm: 'Tidur', en: 'Go to sleep' },
  ],
};

type SequenceP = { set: 'morning' | 'evening' | 'days' | 'months'; start: number; count: number };
const sequence = defineTemplate<SequenceP>({
  id: 'y1-time-sequence',
  topicId: TOPIC,
  widget: 'order-strip',
  sk: SK,
  scope: 'Order daily events; days of the week; months of the year',
  levelNotes: [
    '3 daily events in order',
    'all 4 daily events in order',
    '3 consecutive days of the week (no wrap)',
    '4 consecutive months (no wrap)',
  ],
  sample: (rng, level) => {
    if (level === 3) return { set: 'days', start: rng.int(0, 4), count: 3 };
    if (level === 4) return { set: 'months', start: rng.int(0, 8), count: 4 };
    const set: 'morning' | 'evening' = rng.chance(0.5) ? 'morning' : 'evening';
    if (level === 1) return { set, start: rng.int(0, 1), count: 3 };
    return { set, start: 0, count: 4 };
  },
  build: (p, ctx) => {
    let labels: string[];
    let prompt: string;
    if (p.set === 'days' || p.set === 'months') {
      const source = p.set === 'days' ? DAYS : MONTHS;
      labels = source.slice(p.start, p.start + p.count).map((t) => text(ctx.language, t));
      prompt =
        p.set === 'days'
          ? tr(ctx, 'Susun hari mengikut turutan.', 'Put the days in order.')
          : tr(ctx, 'Susun bulan mengikut turutan.', 'Put the months in order.');
    } else {
      labels = EVENT_SETS[p.set]
        .slice(p.start, p.start + p.count)
        .map((t) => text(ctx.language, t));
      prompt = tr(ctx, 'Susun kejadian mengikut masa.', 'Put the events in time order.');
    }
    return orderBuilt(ctx, {
      band: p.set,
      text: prompt,
      cards: labels.map((label, i) => ({ id: `e${i}`, label })),
      hint: tr(ctx, 'Apa yang berlaku dahulu?', 'What happens first?'),
    });
  },
  fixtures: [
    {
      params: { set: 'days', start: 0, count: 3 },
      expected: { answerText: 'Isnin > Selasa > Rabu' },
    },
  ],
});

/** "Hari selepas Selasa?" / "2 hari sebelum Jumaat?" / "The day after Tuesday?" / "2 months before May?" */
function relativePrompt(
  language: 'bm' | 'en',
  unit: 'day' | 'month',
  dir: 'after' | 'before',
  gap: 1 | 2,
  anchor: string,
): string {
  if (language === 'en') {
    const what = gap === 1 ? `The ${unit}` : `${gap} ${unit}s`;
    return `${what} ${dir} ${anchor}?`;
  }
  const noun = unit === 'day' ? 'hari' : 'bulan';
  const rel = dir === 'after' ? 'selepas' : 'sebelum';
  return gap === 1
    ? `${noun[0]?.toUpperCase()}${noun.slice(1)} ${rel} ${anchor}?`
    : `${gap} ${noun} ${rel} ${anchor}?`;
}

type DayP = { idx: number; dir: 'after' | 'before'; gap: 1 | 2; wrong: number[] };
function neighbour(idx: number, dir: 'after' | 'before', gap: number, size: number): number {
  return (((dir === 'after' ? idx + gap : idx - gap) % size) + size) % size;
}
const DAY_CFG: Record<Level, { dirs: Array<'after' | 'before'>; gaps: Array<1 | 2> }> = {
  1: { dirs: ['after'], gaps: [1] },
  2: { dirs: ['after', 'before'], gaps: [1] },
  3: { dirs: ['after', 'before'], gaps: [1, 2] },
  4: { dirs: ['after', 'before'], gaps: [1, 2] },
};
const dayTemplate = defineTemplate<DayP>({
  id: 'y1-time-days',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Days of the week (what day comes after Tuesday?)',
  levelNotes: [
    'the day after',
    'the day after or before',
    'one or two days after or before',
    'one or two days after or before',
  ],
  sample: (rng, level) => {
    const cfg = DAY_CFG[level];
    const idx = rng.int(0, 6);
    const dir = rng.pick(cfg.dirs);
    const gap = rng.pick(cfg.gaps);
    const answer = neighbour(idx, dir, gap, 7);
    const wrong = rng
      .shuffle([0, 1, 2, 3, 4, 5, 6].filter((d) => d !== answer && d !== idx))
      .slice(0, 3);
    return { idx, dir, gap, wrong };
  },
  build: (p, ctx) => {
    const answer = neighbour(p.idx, p.dir, p.gap, 7);
    const name = (i: number): string => text(ctx.language, DAYS[i] as LocalText);
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: name(answer) },
      p.wrong.map((w) => ({ label: name(w) })),
    );
    const question = relativePrompt(ctx.language, 'day', p.dir, p.gap, name(p.idx));
    return {
      difficultyBand: `gap-${p.gap}`,
      widget: 'choice-tiles',
      prompt: { text: question },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Sebut hari dalam seminggu mengikut turutan.',
        'Say the days of the week in order.',
      ),
    };
  },
  fixtures: [
    {
      params: { idx: 1, dir: 'after', gap: 1, wrong: [0, 4, 6] },
      expected: { answerText: 'Rabu' },
    },
  ],
});

type MonthP = { idx: number; dir: 'after' | 'before'; gap: 1 | 2; wrong: number[] };
const MONTH_CFG: Record<Level, { dirs: Array<'after' | 'before'>; gaps: Array<1 | 2> }> = DAY_CFG;
const monthTemplate = defineTemplate<MonthP>({
  id: 'y1-time-months',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Months of the year',
  levelNotes: [
    'the month after',
    'the month after or before',
    'one or two months after or before',
    'one or two months after or before',
  ],
  sample: (rng, level) => {
    const cfg = MONTH_CFG[level];
    const idx = rng.int(0, 11);
    const dir = rng.pick(cfg.dirs);
    const gap = rng.pick(cfg.gaps);
    const answer = neighbour(idx, dir, gap, 12);
    const wrong = rng
      .shuffle(Array.from({ length: 12 }, (_, i) => i).filter((m) => m !== answer && m !== idx))
      .slice(0, 3);
    return { idx, dir, gap, wrong };
  },
  build: (p, ctx) => {
    const answer = neighbour(p.idx, p.dir, p.gap, 12);
    const name = (i: number): string => text(ctx.language, MONTHS[i] as LocalText);
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: name(answer) },
      p.wrong.map((w) => ({ label: name(w) })),
    );
    const question = relativePrompt(ctx.language, 'month', p.dir, p.gap, name(p.idx));
    return {
      difficultyBand: `gap-${p.gap}`,
      widget: 'choice-tiles',
      prompt: { text: question },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Sebut bulan dalam setahun mengikut turutan.',
        'Say the months of the year in order.',
      ),
    };
  },
  fixtures: [
    {
      params: { idx: 11, dir: 'after', gap: 1, wrong: [2, 5, 8] },
      expected: { answerText: 'Januari' },
    },
  ],
});

const CLOCK_MINUTES: Record<Level, number[]> = {
  1: [0],
  2: [0, 30],
  3: [0, 15, 30, 45],
  4: [0, 15, 30, 45],
};
export function clockLabel(hour: number, minute: number): string {
  return `${hour}:${minute.toString().padStart(2, '0')}`;
}

/** Minutes between two clock times on a 12-hour face, measured the short way round (0..360). */
export function clockGapMinutes(h1: number, m1: number, h2: number, m2: number): number {
  const a = (h1 % 12) * 60 + m1;
  const b = (h2 % 12) * 60 + m2;
  const diff = Math.abs(a - b);
  return Math.min(diff, 720 - diff);
}

/**
 * Pick 3 distinct wrong times, preferring ones that share the hour or the minute (classic confusions).
 * `minGap` keeps every distractor at least that many minutes away from the answer, so clock faces that
 * are shown as pictures are never near-identical.
 */
export function pickClockDistractors(
  rng: { shuffle<T>(items: readonly T[]): T[] },
  hour: number,
  minute: number,
  minutes: number[],
  minGap = 0,
): number[][] {
  const all: number[][] = [];
  for (let h = 1; h <= 12; h++) {
    for (const m of minutes) {
      if ((h !== hour || m !== minute) && clockGapMinutes(h, m, hour, minute) >= minGap)
        all.push([h, m]);
    }
  }
  const near = all.filter(([h, m]) => h === hour || m === minute);
  const far = all.filter(([h, m]) => h !== hour && m !== minute);
  return [...rng.shuffle(near), ...rng.shuffle(far)].slice(0, 3);
}

type ClockP = { hour: number; minute: number; wrong: number[][] };
const clockRead = defineTemplate<ClockP>({
  id: 'y1-time-clock-read',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: 'Tell and write hour, half-hour and quarter-hour on an analogue clock',
  levelNotes: [
    'on the hour',
    'hour and half hour',
    'hour, half and quarter hours',
    'hour, half and quarter hours',
  ],
  sample: (rng, level) => {
    const minutes = CLOCK_MINUTES[level];
    const hour = rng.int(1, 12);
    const minute = rng.pick(minutes);
    return { hour, minute, wrong: pickClockDistractors(rng, hour, minute, minutes) };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: clockLabel(p.hour, p.minute) },
      p.wrong.map(([h, m]) => ({ label: clockLabel(h as number, m as number) })),
    );
    return {
      difficultyBand: p.minute === 0 ? 'hour' : p.minute === 30 ? 'half-hour' : 'quarter-hour',
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Pukul berapa?', 'What time is it?'),
        visual: { kind: 'clock', hour: p.hour, minute: p.minute },
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Jarum pendek menunjuk jam, jarum panjang menunjuk minit.',
        'The short hand shows the hour, the long hand shows the minutes.',
      ),
    };
  },
  fixtures: [
    {
      params: {
        hour: 2,
        minute: 30,
        wrong: [
          [2, 0],
          [6, 30],
          [3, 15],
        ],
      },
      expected: { answerText: '2:30' },
    },
  ],
});

const clockMatch = defineTemplate<ClockP>({
  id: 'y1-time-clock-match',
  topicId: TOPIC,
  widget: 'choice-tiles',
  sk: SK,
  scope: "Match '2:30' to a clock",
  levelNotes: [
    'on the hour',
    'hour and half hour',
    'hour, half and quarter hours',
    'hour, half and quarter hours',
  ],
  prerequisites: ['y1-time-clock-read'],
  sample: (rng, level) => {
    const minutes = CLOCK_MINUTES[level];
    const hour = rng.int(1, 12);
    const minute = rng.pick(minutes);
    // Faces are shown as pictures, so keep every distractor at least 15 minutes of hand travel away.
    return { hour, minute, wrong: pickClockDistractors(rng, hour, minute, minutes, 15) };
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
      difficultyBand: p.minute === 0 ? 'hour' : p.minute === 30 ? 'half-hour' : 'quarter-hour',
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Pilih jam yang betul.', 'Choose the matching clock.'),
        expression: clockLabel(p.hour, p.minute),
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Cari jarum pendek pada nombor jam dahulu.',
        'Find the short hand on the hour number first.',
      ),
    };
  },
  // Clock faces carry no label; the answer text is the description of the correct clock face.
  fixtures: [
    {
      params: {
        hour: 3,
        minute: 0,
        wrong: [
          [6, 0],
          [9, 0],
          [12, 0],
        ],
      },
      expected: { answerText: 'clock 3:00', expression: '3:00' },
    },
  ],
});

export const Y1_TIME_TEMPLATES: QuestionTemplate[] = [
  sequence,
  dayTemplate,
  monthTemplate,
  clockRead,
  clockMatch,
];
