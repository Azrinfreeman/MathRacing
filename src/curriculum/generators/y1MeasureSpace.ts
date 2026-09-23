import type { Level, LocalText, QuestionTemplate } from '../schema';
import type { ObjectShape, Shape2D, Shape3D } from '../visual';
import { OBJECT_COLORS, SHAPE2D_NAMES, SHAPE3D_NAMES, text } from '../text/vocab';
import { numberBuilt, tapBuilt } from './builders';
import { buildChoices, defineTemplate, tr } from './helpers';

// ---------------------------------------------------------------------------------------------
// 5.0 Measurement
// ---------------------------------------------------------------------------------------------
const M_TOPIC = 'y1-measurement';
const M_SK = ['5.1'];

const UNIT_WORDS: LocalText[] = [
  { bm: 'klip kertas', en: 'paper clips' },
  { bm: 'blok', en: 'blocks' },
  { bm: 'kiub', en: 'cubes' },
];

type UnitCountP = { units: number; word: number };
const UNIT_RANGE: Record<Level, [number, number]> = {
  1: [2, 5],
  2: [4, 8],
  3: [6, 10],
  4: [8, 12],
};
const unitCount = defineTemplate<UnitCountP>({
  id: 'y1-meas-unit-count',
  topicId: M_TOPIC,
  widget: 'number-pad',
  sk: M_SK,
  scope: 'Measure length using non-standard units (how many paper clips long?)',
  levelNotes: ['2-5 units', '4-8 units', '6-10 units', '8-12 units'],
  arithmetic: true,
  sample: (rng, level) => ({
    units: rng.int(UNIT_RANGE[level][0], UNIT_RANGE[level][1]),
    word: rng.int(0, UNIT_WORDS.length - 1),
  }),
  build: (p, ctx) => {
    const word = text(ctx.language, UNIT_WORDS[p.word] as LocalText);
    return numberBuilt({
      band: `units-${UNIT_RANGE[ctx.level][1]}`,
      text: tr(ctx, `Panjang ini ialah berapa ${word}?`, `How many ${word} long is it?`),
      visual: { kind: 'unit-bar', units: p.units, unitLabel: word },
      answer: p.units,
      hint: tr(
        ctx,
        'Kira bilangan unit dari hujung ke hujung.',
        'Count the units from end to end.',
      ),
    });
  },
  recompute: (p) => String(p.units),
  fixtures: [{ params: { units: 6, word: 0 }, expected: { answerText: '6' } }],
});

type LengthCompareP = { a: number; b: number; ask: 'longer' | 'shorter' };
const LENGTH_RATIO: Record<Level, number> = { 1: 1.8, 2: 1.5, 3: 1.3, 4: 1.15 };
const compareLength = defineTemplate<LengthCompareP>({
  id: 'y1-meas-compare-length',
  topicId: M_TOPIC,
  widget: 'tap-picture',
  sk: M_SK,
  scope: 'Compare length using comparative language',
  levelNotes: [
    'ratio at least 1.8',
    'ratio at least 1.5',
    'ratio at least 1.3',
    'ratio at least 1.15 (difference at least 2)',
  ],
  sample: (rng, level) => {
    for (let i = 0; i < 300; i++) {
      const a = rng.int(3, 20);
      const b = rng.int(3, 20);
      const big = Math.max(a, b);
      const small = Math.min(a, b);
      if (big - small >= 2 && big / small >= LENGTH_RATIO[level]) {
        return { a, b, ask: rng.chance(0.5) ? 'longer' : 'shorter' };
      }
    }
    return { a: 4, b: 12, ask: 'longer' };
  },
  build: (p, ctx) => {
    const aWins = p.ask === 'longer' ? p.a > p.b : p.a < p.b;
    return tapBuilt({
      band: `ratio-${LENGTH_RATIO[ctx.level]}`,
      text:
        p.ask === 'longer'
          ? tr(ctx, 'Ketik yang lebih panjang.', 'Tap the longer one.')
          : tr(ctx, 'Ketik yang lebih pendek.', 'Tap the shorter one.'),
      options: [
        { id: 'a', visual: { kind: 'length-bar', length: p.a, max: 20, color: OBJECT_COLORS[1] } },
        { id: 'b', visual: { kind: 'length-bar', length: p.b, max: 20, color: OBJECT_COLORS[4] } },
      ],
      acceptedAnswer: { kind: 'choice', optionId: aWins ? 'a' : 'b' },
      multi: false,
      columns: 1,
      hint: tr(ctx, 'Bandingkan hujung kedua-dua bar.', 'Compare the ends of both bars.'),
    });
  },
  fixtures: [{ params: { a: 5, b: 15, ask: 'longer' }, expected: { answerText: 'length-bar 15' } }],
});

type Ordered = { name: LocalText }[];
const COMPARE_CATEGORIES: Record<
  'mass' | 'volume' | 'length',
  { items: Ordered; max: LocalText; min: LocalText }
> = {
  mass: {
    items: [
      { name: { bm: 'Bulu', en: 'Feather' } },
      { name: { bm: 'Kucing', en: 'Cat' } },
      { name: { bm: 'Kereta', en: 'Car' } },
      { name: { bm: 'Gajah', en: 'Elephant' } },
    ],
    max: { bm: 'Yang mana paling berat?', en: 'Which is the heaviest?' },
    min: { bm: 'Yang mana paling ringan?', en: 'Which is the lightest?' },
  },
  volume: {
    items: [
      { name: { bm: 'Sudu teh', en: 'Teaspoon' } },
      { name: { bm: 'Cawan', en: 'Cup' } },
      { name: { bm: 'Baldi', en: 'Bucket' } },
      { name: { bm: 'Kolam renang', en: 'Swimming pool' } },
    ],
    max: { bm: 'Yang mana boleh isi paling banyak air?', en: 'Which holds the most water?' },
    min: { bm: 'Yang mana boleh isi paling sedikit air?', en: 'Which holds the least water?' },
  },
  length: {
    items: [
      { name: { bm: 'Pemadam', en: 'Eraser' } },
      { name: { bm: 'Pensel', en: 'Pencil' } },
      { name: { bm: 'Pembaris', en: 'Ruler' } },
      { name: { bm: 'Bas', en: 'Bus' } },
    ],
    max: { bm: 'Yang mana paling panjang?', en: 'Which is the longest?' },
    min: { bm: 'Yang mana paling pendek?', en: 'Which is the shortest?' },
  },
};
type CompareWordsP = {
  category: 'mass' | 'volume' | 'length';
  picks: number[];
  ask: 'max' | 'min';
};
const COMPARE_WORDS_CFG: Record<
  Level,
  { cats: Array<'mass' | 'volume' | 'length'>; count: number }
> = {
  1: { cats: ['mass'], count: 2 },
  2: { cats: ['mass', 'volume'], count: 2 },
  3: { cats: ['mass', 'volume', 'length'], count: 3 },
  4: { cats: ['mass', 'volume', 'length'], count: 4 },
};
const compareWords = defineTemplate<CompareWordsP>({
  id: 'y1-meas-compare-words',
  topicId: M_TOPIC,
  widget: 'choice-tiles',
  sk: M_SK,
  scope: 'Compare mass, liquid volume and length using comparative language',
  levelNotes: [
    '2 objects, mass',
    '2 objects, mass and volume',
    '3 objects, mass, volume and length',
    '4 objects, mass, volume and length',
  ],
  sample: (rng, level) => {
    const cfg = COMPARE_WORDS_CFG[level];
    const category = rng.pick(cfg.cats);
    const picks = rng
      .shuffle([0, 1, 2, 3])
      .slice(0, cfg.count)
      .sort((x, y) => x - y);
    return { category, picks, ask: rng.chance(0.5) ? 'max' : 'min' };
  },
  build: (p, ctx) => {
    const cat = COMPARE_CATEGORIES[p.category];
    const name = (i: number): string =>
      text(ctx.language, (cat.items[i] as { name: LocalText }).name);
    const target = p.ask === 'max' ? Math.max(...p.picks) : Math.min(...p.picks);
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: name(target) },
      p.picks.filter((i) => i !== target).map((i) => ({ label: name(i) })),
    );
    return {
      difficultyBand: `objects-${p.picks.length}`,
      widget: 'choice-tiles',
      prompt: { text: text(ctx.language, p.ask === 'max' ? cat.max : cat.min) },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Fikirkan objek sebenar. Yang mana besar sekali?',
        'Think of the real objects. Which is biggest?',
      ),
    };
  },
  fixtures: [
    { params: { category: 'mass', picks: [1, 3], ask: 'max' }, expected: { answerText: 'Gajah' } },
  ],
});

// ---------------------------------------------------------------------------------------------
// 6.0 Space
// ---------------------------------------------------------------------------------------------
const S_TOPIC = 'y1-space';
const S_SK = ['6.1-6.2'];

type Solid = { flat: number; edges?: number; vertices?: number };
export const SOLIDS: Record<Shape3D, Solid> = {
  cube: { flat: 6, edges: 12, vertices: 8 },
  cuboid: { flat: 6, edges: 12, vertices: 8 },
  cylinder: { flat: 2 },
  cone: { flat: 1 },
  sphere: { flat: 0 },
  pyramid: { flat: 5, edges: 8, vertices: 5 }, // square-based pyramid
};

const NAME3D_POOL: Record<Level, Shape3D[]> = {
  1: ['sphere', 'cylinder', 'cone', 'cube'],
  2: ['sphere', 'cylinder', 'cone', 'cube', 'pyramid'],
  3: ['sphere', 'cylinder', 'cone', 'cube', 'pyramid', 'cuboid'],
  4: ['sphere', 'cylinder', 'cone', 'cube', 'pyramid', 'cuboid'],
};
type Name3dP = { shape: Shape3D; wrong: Shape3D[] };
const name3d = defineTemplate<Name3dP>({
  id: 'y1-space-name-3d',
  topicId: S_TOPIC,
  widget: 'choice-tiles',
  sk: S_SK,
  scope: 'Name and describe 3D shapes (name a cylinder)',
  levelNotes: ['sphere, cylinder, cone, cube', '+ pyramid', '+ cuboid', '+ cuboid'],
  sample: (rng, level) => {
    const pool = NAME3D_POOL[level];
    const shape = rng.pick(pool);
    return { shape, wrong: rng.shuffle(pool.filter((s) => s !== shape)).slice(0, 3) };
  },
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: text(ctx.language, SHAPE3D_NAMES[p.shape]) },
      p.wrong.map((w) => ({ label: text(ctx.language, SHAPE3D_NAMES[w]) })),
    );
    return {
      difficultyBand: `pool-${NAME3D_POOL[ctx.level].length}`,
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Apakah nama pepejal ini?', 'What is the name of this solid?'),
        visual: { kind: 'shape3d', shape: p.shape },
      },
      options,
      acceptedAnswer,
      hint: tr(
        ctx,
        'Fikirkan benda sebenar yang berbentuk sama.',
        'Think of a real object with the same shape.',
      ),
    };
  },
  fixtures: [
    {
      params: { shape: 'cylinder', wrong: ['sphere', 'cone', 'cube'] },
      expected: { answerText: 'Silinder' },
    },
  ],
});

const SHAPES_2D_Y1: Shape2D[] = ['triangle', 'square', 'rectangle', 'circle'];
type Name2dP = { shape: Shape2D; colorIdx: number };
const name2d = defineTemplate<Name2dP>({
  id: 'y1-space-name-2d',
  topicId: S_TOPIC,
  widget: 'choice-tiles',
  sk: S_SK,
  scope: 'Name common 2D shapes',
  levelNotes: ['triangle, square, rectangle, circle', 'same', 'same', 'same'],
  sample: (rng) => ({ shape: rng.pick(SHAPES_2D_Y1), colorIdx: rng.int(0, 5) }),
  build: (p, ctx) => {
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      { label: text(ctx.language, SHAPE2D_NAMES[p.shape]) },
      SHAPES_2D_Y1.filter((s) => s !== p.shape).map((s) => ({
        label: text(ctx.language, SHAPE2D_NAMES[s]),
      })),
    );
    return {
      difficultyBand: 'four-shapes',
      widget: 'choice-tiles',
      prompt: {
        text: tr(ctx, 'Apakah nama bentuk ini?', 'What is the name of this shape?'),
        visual: { kind: 'shape2d', shape: p.shape, color: OBJECT_COLORS[p.colorIdx] },
      },
      options,
      acceptedAnswer,
      hint: tr(ctx, 'Kira sisi dan bucu.', 'Count the sides and corners.'),
    };
  },
  fixtures: [{ params: { shape: 'circle', colorIdx: 1 }, expected: { answerText: 'Bulatan' } }],
});

type FindShapeP = { property: 'three-sides' | 'no-corners' | 'equal-sides'; colorIdx: number };
const FIND_PROPERTIES: Record<Level, FindShapeP['property'][]> = {
  1: ['three-sides', 'no-corners'],
  2: ['three-sides', 'no-corners', 'equal-sides'],
  3: ['three-sides', 'no-corners', 'equal-sides'],
  4: ['three-sides', 'no-corners', 'equal-sides'],
};
const findShape = defineTemplate<FindShapeP>({
  id: 'y1-space-find-shape',
  topicId: S_TOPIC,
  widget: 'choice-tiles',
  sk: S_SK,
  scope: 'Describe 2D shapes (which shape has three sides?)',
  levelNotes: [
    'three sides / no corners',
    '+ four equal sides',
    'same as level 2',
    'same as level 2',
  ],
  prerequisites: ['y1-space-name-2d'],
  sample: (rng, level) => ({ property: rng.pick(FIND_PROPERTIES[level]), colorIdx: rng.int(0, 5) }),
  build: (p, ctx) => {
    const target: Shape2D =
      p.property === 'three-sides' ? 'triangle' : p.property === 'no-corners' ? 'circle' : 'square';
    const color = OBJECT_COLORS[p.colorIdx];
    const vis = (shape: Shape2D) => ({ visual: { kind: 'shape2d' as const, shape, color } });
    const { options, acceptedAnswer } = buildChoices(
      ctx,
      vis(target),
      SHAPES_2D_Y1.filter((s) => s !== target).map(vis),
    );
    const textByProperty: Record<FindShapeP['property'], LocalText> = {
      'three-sides': { bm: 'Bentuk mana mempunyai 3 sisi?', en: 'Which shape has 3 sides?' },
      'no-corners': { bm: 'Bentuk mana tiada bucu?', en: 'Which shape has no corners?' },
      'equal-sides': {
        bm: 'Bentuk mana mempunyai 4 sisi sama panjang?',
        en: 'Which shape has 4 equal sides?',
      },
    };
    return {
      difficultyBand: p.property,
      widget: 'choice-tiles',
      prompt: { text: text(ctx.language, textByProperty[p.property]) },
      options,
      acceptedAnswer,
      hint: tr(ctx, 'Kira sisi setiap bentuk.', 'Count the sides of each shape.'),
    };
  },
  fixtures: [
    {
      params: { property: 'three-sides', colorIdx: 0 },
      expected: { answerText: 'shape2d triangle' },
    },
  ],
});

type SolidCountP = { shape: Shape3D; ask: 'flat' | 'vertices' | 'edges' };
const SOLID_ASKS: Record<Level, Array<[Shape3D, SolidCountP['ask']]>> = {
  1: [
    ['cylinder', 'flat'],
    ['cone', 'flat'],
    ['sphere', 'flat'],
    ['cube', 'flat'],
  ],
  2: [
    ['cube', 'flat'],
    ['cuboid', 'flat'],
    ['cylinder', 'flat'],
    ['cone', 'flat'],
    ['pyramid', 'flat'],
  ],
  3: [
    ['cube', 'vertices'],
    ['cuboid', 'vertices'],
    ['pyramid', 'vertices'],
  ],
  4: [
    ['cube', 'edges'],
    ['cuboid', 'edges'],
    ['pyramid', 'edges'],
    ['pyramid', 'vertices'],
  ],
};
const solidCount = defineTemplate<SolidCountP>({
  id: 'y1-space-3d-count',
  topicId: S_TOPIC,
  widget: 'number-pad',
  sk: S_SK,
  scope: 'Count faces, vertices and edges of 3D shapes (count cube vertices)',
  levelNotes: [
    'flat surfaces of 4 solids',
    'flat surfaces of 5 solids',
    'vertices (corners) of cube, cuboid, pyramid',
    'edges and vertices',
  ],
  arithmetic: true,
  sample: (rng, level) => {
    const [shape, ask] = rng.pick(SOLID_ASKS[level]);
    return { shape, ask };
  },
  build: (p, ctx) => {
    const solid = SOLIDS[p.shape];
    const value =
      p.ask === 'flat' ? solid.flat : p.ask === 'vertices' ? solid.vertices : solid.edges;
    if (value === undefined) throw new Error(`no ${p.ask} count for ${p.shape}`);
    const name = text(ctx.language, SHAPE3D_NAMES[p.shape]);
    const ask =
      p.ask === 'flat'
        ? tr(ctx, 'permukaan rata', 'flat surfaces')
        : p.ask === 'vertices'
          ? tr(ctx, 'bucu', 'corners (vertices)')
          : tr(ctx, 'tepi', 'edges');
    return numberBuilt({
      band: p.ask,
      text: tr(
        ctx,
        `Berapa ${ask} pada ${name.toLowerCase()}?`,
        `How many ${ask} does a ${name.toLowerCase()} have?`,
      ),
      visual: { kind: 'shape3d', shape: p.shape },
      answer: value,
      hint: tr(
        ctx,
        'Bayangkan memegang pepejal itu dan kira satu demi satu.',
        'Imagine holding the solid and count one by one.',
      ),
    });
  },
  recompute: (p) => {
    const table: Record<string, number> = {
      'cube:flat': 6,
      'cube:vertices': 8,
      'cube:edges': 12,
      'cuboid:flat': 6,
      'cuboid:vertices': 8,
      'cuboid:edges': 12,
      'cylinder:flat': 2,
      'cone:flat': 1,
      'sphere:flat': 0,
      'pyramid:flat': 5,
      'pyramid:vertices': 5,
      'pyramid:edges': 8,
    };
    return String(table[`${p.shape}:${p.ask}`]);
  },
  fixtures: [{ params: { shape: 'cube', ask: 'vertices' }, expected: { answerText: '8' } }],
});

type PatternP = { code: 'AB' | 'AAB' | 'ABB' | 'ABC'; shapes: ObjectShape[]; colors: number[] };
const PATTERN_SHAPES: ObjectShape[] = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart'];
const PATTERN_CODES: Record<Level, PatternP['code'][]> = {
  1: ['AB'],
  2: ['AAB', 'ABB'],
  3: ['ABC'],
  4: ['AAB', 'ABC'],
};
const shapePattern = defineTemplate<PatternP>({
  id: 'y1-space-pattern',
  topicId: S_TOPIC,
  widget: 'choice-tiles',
  sk: S_SK,
  scope: 'Continue shape patterns',
  levelNotes: [
    'AB patterns, one colour',
    'AAB or ABB patterns',
    'ABC patterns',
    'AAB or ABC patterns with different colours',
  ],
  sample: (rng, level) => {
    const code = rng.pick(PATTERN_CODES[level]);
    const distinct = new Set(code.split('')).size;
    const shapes = rng.shuffle(PATTERN_SHAPES).slice(0, distinct);
    const baseColor = rng.int(0, 5);
    const colors =
      level === 4
        ? rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, distinct)
        : Array.from({ length: distinct }, () => baseColor);
    return { code, shapes, colors };
  },
  build: (p, ctx) => {
    const letters = p.code.split('');
    const symbol = (ch: string): { shape: ObjectShape; color: string } => {
      const i = ch.charCodeAt(0) - 65;
      return {
        shape: p.shapes[i] as ObjectShape,
        color: OBJECT_COLORS[p.colors[i] as number] ?? '#2e86de',
      };
    };
    const visibleLength = letters.length * 2 + 1;
    const full = Array.from(
      { length: visibleLength + 1 },
      (_, i) => letters[i % letters.length] as string,
    );
    const items = full.slice(0, visibleLength).map(symbol);
    const correctSym = symbol(full[visibleLength] as string);
    const icon = (s: { shape: ObjectShape; color: string }) => ({
      visual: { kind: 'objects' as const, groups: [{ count: 1, shape: s.shape, color: s.color }] },
    });
    const seen = new Set<string>([`${correctSym.shape}|${correctSym.color}`]);
    const wrong: Array<{ shape: ObjectShape; color: string }> = [];
    const candidates = [
      ...Array.from(new Set(letters)).map(symbol),
      ...PATTERN_SHAPES.map((shape) => ({ shape, color: correctSym.color })),
      ...PATTERN_SHAPES.map((shape) => ({
        shape,
        color: OBJECT_COLORS[
          (OBJECT_COLORS.indexOf(correctSym.color as (typeof OBJECT_COLORS)[number]) + 1) %
            OBJECT_COLORS.length
        ] as string,
      })),
    ];
    for (const c of candidates) {
      const key = `${c.shape}|${c.color}`;
      if (!seen.has(key) && wrong.length < 3) {
        seen.add(key);
        wrong.push(c);
      }
    }
    const { options, acceptedAnswer } = buildChoices(ctx, icon(correctSym), wrong.map(icon));
    return {
      difficultyBand: p.code,
      widget: 'choice-tiles',
      prompt: {
        text: tr(
          ctx,
          'Sambung corak. Apa yang seterusnya?',
          'Continue the pattern. What comes next?',
        ),
        visual: { kind: 'pattern', items: [...items, null] },
      },
      options,
      acceptedAnswer,
      hint: tr(ctx, 'Cari bahagian yang berulang.', 'Find the part that repeats.'),
    };
  },
  fixtures: [
    {
      params: { code: 'AB', shapes: ['circle', 'square'], colors: [0, 0] },
      expected: { answerText: '1 square' },
    },
  ],
});

export const Y1_MEASURE_TEMPLATES: QuestionTemplate[] = [unitCount, compareLength, compareWords];
export const Y1_SPACE_TEMPLATES: QuestionTemplate[] = [
  name3d,
  name2d,
  findShape,
  solidCount,
  shapePattern,
];
