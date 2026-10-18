import type { BuildContext, Level, QuestionTemplate } from '../schema';
import type { ObjectGroup, ObjectShape, Shape2D, VisualModel } from '../visual';
import { OBJECT_COLORS, SHAPE2D_SIDES } from '../text/vocab';
import { numberBuilt } from './builders';
import { defineTemplate, tr } from './helpers';

/**
 * Shared pieces of the "Kira & taip" questions (DECISIONS #42): every question is a picture to count and one
 * whole number typed on the number pad. Nothing to order, build or select.
 */

export const COUNT_SHAPES: readonly ObjectShape[] = [
  'circle',
  'star',
  'square',
  'triangle',
  'diamond',
  'heart',
];

export function color(i: number): string {
  return OBJECT_COLORS[i % OBJECT_COLORS.length] ?? '#2e86de';
}

/** Loose objects for small counts, ten-frames once the picture holds more than 20 things or at `frames`. */
export function countPicture(groups: ObjectGroup[], frames: boolean, join?: 'plus'): VisualModel {
  const total = groups.reduce((n, g) => n + g.count, 0);
  const extra = join ? { join } : {};
  return frames || total > 20
    ? { kind: 'ten-frames', groups, ...extra }
    : { kind: 'objects', groups, ...extra };
}

/**
 * The help after two wrong answers: loose objects rearranged into ten-frames (rows of 5). A picture that is
 * already in frames has no rearranged version.
 */
export function framesHint(picture: VisualModel): VisualModel | undefined {
  if (picture.kind !== 'objects') return undefined;
  return picture.join
    ? { kind: 'ten-frames', groups: picture.groups, join: picture.join }
    : { kind: 'ten-frames', groups: picture.groups };
}

export function fivesHint(ctx: BuildContext): string {
  return tr(ctx, 'Kira lima-lima: 5, 10, ...', 'Count in fives: 5, 10, ...');
}

/** Numbers of sides/corners to count on a flat shape, per level. */
type ShapeCountP = { shape: Shape2D; ask: 'sides' | 'corners'; colorIdx: number };

/** "Berapa sisi? / Berapa bucu?" on a flat shape; a template per year, so each keeps its topic and SK. */
export function shapeCountTemplate(o: {
  id: string;
  topicId: string;
  sk: string[];
  pools: Record<Level, Shape2D[]>;
  cornersFrom: Level;
}): QuestionTemplate {
  return defineTemplate<ShapeCountP>({
    id: o.id,
    topicId: o.topicId,
    widget: 'number-pad',
    sk: o.sk,
    scope: 'Count the sides and corners (vertices) of 2D shapes',
    levelNotes: [1, 2, 3, 4].map((lv) => {
      const shapes = o.pools[lv as Level].join(', ');
      return lv >= o.cornersFrom ? `sides or corners: ${shapes}` : `sides: ${shapes}`;
    }) as [string, string, string, string],
    arithmetic: true,
    sample: (rng, level) => ({
      shape: rng.pick(o.pools[level]),
      ask: level >= o.cornersFrom && rng.chance(0.5) ? 'corners' : 'sides',
      colorIdx: rng.int(0, OBJECT_COLORS.length - 1),
    }),
    build: (p, ctx) =>
      numberBuilt({
        band: p.ask,
        cue: p.ask === 'sides' ? 'sides' : 'corners',
        text:
          p.ask === 'sides'
            ? tr(ctx, 'Berapa sisi?', 'How many sides?')
            : tr(ctx, 'Berapa bucu?', 'How many corners?'),
        visual: { kind: 'shape2d', shape: p.shape, color: color(p.colorIdx) },
        answer: SHAPE2D_SIDES[p.shape],
        hint:
          p.ask === 'sides'
            ? tr(ctx, 'Sentuh setiap garis lurus dan kira.', 'Trace each straight side and count.')
            : tr(ctx, 'Kira setiap sudut yang tajam.', 'Count each pointed corner.'),
      }),
    recompute: (p) => String(SHAPE2D_SIDES[p.shape]),
    fixtures: [
      {
        params: { shape: 'triangle', ask: 'sides', colorIdx: 0 },
        level: 1,
        expected: { answerText: '3' },
      },
    ],
  });
}

/** Coins or notes to count; `unit` is how the answer is typed. */
export function moneyItems(values: number[]): VisualModel {
  return {
    kind: 'money',
    items: values.map((v) => ({ type: v >= 100 ? 'note' : 'coin', valueSen: v })),
  };
}
