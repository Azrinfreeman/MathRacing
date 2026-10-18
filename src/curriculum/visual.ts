/**
 * Declarative descriptions of the pictures a question can show. They are plain data: the Phaser layer
 * draws them with vector geometry, and the generators/validators reason about them without any renderer.
 * Every visual is original vector art (no bitmap or third-party assets).
 */

export type ObjectShape = 'circle' | 'star' | 'square' | 'triangle' | 'diamond' | 'heart';
export type MeasuringUnit = 'paperclip' | 'block' | 'cube';
export type Shape2D =
  'triangle' | 'square' | 'rectangle' | 'circle' | 'pentagon' | 'hexagon' | 'octagon';
export type Shape3D = 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'sphere' | 'pyramid';

export type ObjectGroup = {
  count: number;
  shape: ObjectShape;
  color: string;
  /** The last `crossed` objects are drawn crossed out ("Berapa tinggal?"). */
  crossed?: number;
};

/** Base-ten blocks: flats of 100, rods of 10 and single cubes. */
export type BlockSet = { hundreds: number; tens: number; ones: number };

export type MoneyItem = { type: 'coin' | 'note'; valueSen: number };

export type ChartCategory = { label: string; value: number; color?: string };

export type PatternItem = { shape: ObjectShape; color: string } | null; // null = the "?" slot

export type VisualModel =
  /** Countable objects. Several groups are drawn side by side. */
  | { kind: 'objects'; groups: ObjectGroup[]; join?: 'plus' }
  /** The same groups arranged in ten-frames (2 rows of 5), so larger counts are quick to count. */
  | { kind: 'ten-frames'; groups: ObjectGroup[]; join?: 'plus' }
  /** One or two sets of base-ten blocks; `crossed` blocks of the first set are drawn crossed out. */
  | { kind: 'base-ten'; sets: BlockSet[]; crossed?: BlockSet; join?: 'plus' }
  /** `groups` circled groups of `perGroup` objects (repeated addition, multiplication, sharing). */
  | { kind: 'equal-groups'; groups: number; perGroup: number; shape: ObjectShape; color: string }
  /** `fives` labels the minute marks 5, 10, ... 55 around the face. */
  | { kind: 'clock'; hour: number; minute: number; fives?: boolean }
  | { kind: 'money'; items: MoneyItem[] }
  | { kind: 'shape2d'; shape: Shape2D; color?: string }
  | { kind: 'shape3d'; shape: Shape3D; color?: string }
  | { kind: 'net'; shape: Exclude<Shape3D, 'sphere'> }
  /** Fraction of a bar or pie. `shaded` lists the shaded part indices (0-based). */
  | {
      kind: 'fraction';
      numerator: number;
      denominator: number;
      style: 'bar' | 'pie';
      shaded?: number[];
    }
  /** Object measured with non-standard units (e.g. paper clips). */
  | { kind: 'unit-bar'; units: number; unit: MeasuringUnit; color?: string }
  /** A plain bar whose length is the thing being compared. */
  | { kind: 'length-bar'; length: number; max: number; color?: string }
  | { kind: 'ruler'; lengthCm: number; maxCm: number }
  /** `step` ml between two marks (default 100): the cup is read by counting the marks up to the water. */
  | { kind: 'cup'; ml: number; maxMl: number; step?: number }
  /** One symbol represents one item (Year 1 pictograph). */
  | {
      kind: 'pictograph';
      rows: { label: string; count: number; shape: ObjectShape; color: string }[];
      /** Index of the one row the question asks about, drawn with a pointer so no sentence is needed. */
      highlight?: number;
    }
  /** Vertical bar chart. Every value is a multiple of `scale`, so bars align with grid lines. */
  | {
      kind: 'bar-chart';
      categories: ChartCategory[];
      scale: number;
      max: number;
      xTitle?: string;
      yTitle?: string;
      /** Index of the one bar the question asks about, drawn with a pointer so no sentence is needed. */
      highlight?: number;
      /** Draw an arrow on one axis, used by the "which axis" question. */
      highlightAxis?: 'x' | 'y';
    }
  | { kind: 'pattern'; items: PatternItem[] }
  /** Large plain text (used inside tiles, e.g. a fraction "3/4" or a symbol "+"). */
  | { kind: 'text'; text: string };

/** Returns a list of problems with a visual (empty when valid). */
export function validateVisual(v: VisualModel): string[] {
  const problems: string[] = [];
  switch (v.kind) {
    case 'objects': {
      if (v.groups.length === 0) problems.push('objects: no groups');
      for (const g of v.groups) {
        if (!Number.isInteger(g.count) || g.count < 0 || g.count > 20) {
          problems.push(`objects: count ${g.count} outside 0..20 (must stay countable)`);
        }
        problems.push(...crossedProblems('objects', g));
      }
      break;
    }
    case 'ten-frames': {
      if (v.groups.length === 0 || v.groups.length > 2) problems.push('ten-frames: 1 or 2 groups');
      const total = v.groups.reduce((n, g) => n + g.count, 0);
      if (total > 50) problems.push(`ten-frames: ${total} objects, at most 50 (5 frames)`);
      for (const g of v.groups) {
        if (!Number.isInteger(g.count) || g.count < 0) problems.push('ten-frames: bad count');
        problems.push(...crossedProblems('ten-frames', g));
      }
      break;
    }
    case 'base-ten': {
      if (v.sets.length === 0 || v.sets.length > 2) problems.push('base-ten: 1 or 2 sets');
      for (const b of v.sets) problems.push(...blockProblems(b));
      const first = v.sets[0];
      if (v.crossed && first) {
        problems.push(...blockProblems(v.crossed));
        if (
          v.crossed.hundreds > first.hundreds ||
          v.crossed.tens > first.tens ||
          v.crossed.ones > first.ones
        )
          problems.push('base-ten: more crossed than drawn');
      }
      break;
    }
    case 'equal-groups':
      if (!Number.isInteger(v.groups) || v.groups < 1 || v.groups > 10)
        problems.push('equal-groups: groups 1..10');
      if (!Number.isInteger(v.perGroup) || v.perGroup < 1 || v.perGroup > 10)
        problems.push('equal-groups: perGroup 1..10');
      break;
    case 'clock':
      if (!Number.isInteger(v.hour) || v.hour < 1 || v.hour > 12)
        problems.push('clock: hour 1..12');
      if (!Number.isInteger(v.minute) || v.minute < 0 || v.minute > 59) {
        problems.push('clock: minute 0..59');
      }
      break;
    case 'money':
      if (v.items.length === 0) problems.push('money: empty');
      for (const m of v.items) {
        if (!Number.isInteger(m.valueSen) || m.valueSen <= 0) problems.push('money: bad valueSen');
      }
      break;
    case 'fraction':
      if (!Number.isInteger(v.denominator) || v.denominator < 1 || v.denominator > 10) {
        problems.push('fraction: denominator 1..10');
      }
      if (v.numerator < 0 || v.numerator > v.denominator)
        problems.push('fraction: numerator range');
      if (v.shaded) {
        const set = new Set(v.shaded);
        if (set.size !== v.shaded.length) problems.push('fraction: duplicate shaded parts');
        if (v.shaded.some((i) => i < 0 || i >= v.denominator))
          problems.push('fraction: shaded index');
      }
      break;
    case 'unit-bar':
      if (!Number.isInteger(v.units) || v.units < 1 || v.units > 15)
        problems.push('unit-bar: units');
      if (!['paperclip', 'block', 'cube'].includes(v.unit)) problems.push('unit-bar: unit');
      break;
    case 'length-bar':
      if (v.length <= 0 || v.length > v.max) problems.push('length-bar: length within max');
      break;
    case 'ruler':
      if (v.lengthCm < 1 || v.lengthCm > v.maxCm) problems.push('ruler: length within max');
      break;
    case 'cup':
      if (v.ml < 0 || v.ml > v.maxMl) problems.push('cup: level within max');
      if (v.ml % (v.step ?? 100) !== 0) problems.push('cup: level on a mark');
      break;
    case 'pictograph': {
      const labels = new Set(v.rows.map((r) => r.label));
      if (labels.size !== v.rows.length) problems.push('pictograph: duplicate row labels');
      for (const r of v.rows) {
        if (!Number.isInteger(r.count) || r.count < 0 || r.count > 10) {
          problems.push('pictograph: count 0..10');
        }
      }
      break;
    }
    case 'bar-chart': {
      const labels = new Set(v.categories.map((c) => c.label));
      if (labels.size !== v.categories.length) problems.push('bar-chart: duplicate labels');
      if (v.scale <= 0 || v.max % v.scale !== 0)
        problems.push('bar-chart: max must be a multiple of scale');
      for (const c of v.categories) {
        if (c.value % v.scale !== 0)
          problems.push(`bar-chart: ${c.label}=${c.value} not on a grid line`);
        if (c.value < 0 || c.value > v.max) problems.push(`bar-chart: ${c.label} outside axis`);
      }
      break;
    }
    case 'pattern':
      if (v.items.filter((i) => i === null).length !== 1) problems.push('pattern: exactly one "?"');
      break;
    default:
      break;
  }
  return problems;
}

function crossedProblems(kind: string, g: ObjectGroup): string[] {
  if (g.crossed === undefined) return [];
  return Number.isInteger(g.crossed) && g.crossed >= 0 && g.crossed <= g.count
    ? []
    : [`${kind}: crossed ${g.crossed} outside 0..${g.count}`];
}

function blockProblems(b: BlockSet): string[] {
  const ok = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 9;
  return ok(b.hundreds) && ok(b.tens) && ok(b.ones) ? [] : ['base-ten: each place 0..9'];
}

export function blockValue(b: BlockSet): number {
  return b.hundreds * 100 + b.tens * 10 + b.ones;
}

/**
 * How many things a counting picture shows once crossed-out things are taken away: the answer of every "count
 * all" or "how many are left" question. Null for pictures that are not a count (a clock, a ruler, a shape).
 */
export function visualTotal(v: VisualModel): number | null {
  switch (v.kind) {
    case 'objects':
    case 'ten-frames':
      return v.groups.reduce((n, g) => n + g.count - (g.crossed ?? 0), 0);
    case 'base-ten':
      return (
        v.sets.reduce((n, b) => n + blockValue(b), 0) - (v.crossed ? blockValue(v.crossed) : 0)
      );
    case 'equal-groups':
      return v.groups * v.perGroup;
    case 'money':
      return moneyCount(v.items);
    default:
      return null;
  }
}

/** What a money picture asks to count: one per coin, and one dot per ringgit on a note (DECISIONS #46). */
export function moneyCount(items: readonly MoneyItem[]): number {
  return items.reduce((n, m) => n + (m.type === 'coin' ? 1 : m.valueSen / 100), 0);
}

/** Short plain-text description of a visual (used for fixtures, previews and screen-reader labels). */
export function describeVisual(v: VisualModel): string {
  switch (v.kind) {
    case 'objects':
    case 'ten-frames':
      return v.groups
        .map((g) => `${g.count} ${g.shape}${g.crossed ? ` (${g.crossed} crossed out)` : ''}`)
        .join(', ');
    case 'base-ten':
      return `blocks ${v.sets.map((b) => blockValue(b)).join(' + ')}${v.crossed ? ` - ${blockValue(v.crossed)}` : ''}`;
    case 'equal-groups':
      return `${v.groups} groups of ${v.perGroup} ${v.shape}`;
    case 'clock':
      return `clock ${v.hour}:${v.minute.toString().padStart(2, '0')}`;
    case 'money':
      return `money ${v.items.map((i) => i.valueSen).join('+')} sen`;
    case 'shape2d':
    case 'shape3d':
    case 'net':
      return `${v.kind} ${v.shape}`;
    case 'fraction':
      return `fraction ${v.numerator}/${v.denominator} ${v.style}`;
    case 'text':
      return v.text;
    case 'length-bar':
      return `length-bar ${v.length}`;
    case 'unit-bar':
      return `unit-bar ${v.units} ${v.unit}`;
    case 'ruler':
      return `ruler ${v.lengthCm} cm`;
    case 'cup':
      return `cup ${v.ml} ml`;
    default:
      return v.kind;
  }
}

/** Stable short signature so option visuals can be compared for uniqueness. */
export function visualSignature(v: VisualModel): string {
  return JSON.stringify(v);
}
