/**
 * Declarative descriptions of the pictures a question can show. They are plain data: the Phaser layer
 * draws them with vector geometry, and the generators/validators reason about them without any renderer.
 * Every visual is original vector art (no bitmap or third-party assets).
 */

export type ObjectShape = 'circle' | 'star' | 'square' | 'triangle' | 'diamond' | 'heart';
export type Shape2D =
  'triangle' | 'square' | 'rectangle' | 'circle' | 'pentagon' | 'hexagon' | 'octagon';
export type Shape3D = 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'sphere' | 'pyramid';

export type ObjectGroup = { count: number; shape: ObjectShape; color: string };

export type MoneyItem = { type: 'coin' | 'note'; valueSen: number };

export type ChartCategory = { label: string; value: number; color?: string };

export type PatternItem = { shape: ObjectShape; color: string } | null; // null = the "?" slot

export type VisualModel =
  /** Countable objects. Several groups are drawn side by side. */
  | { kind: 'objects'; groups: ObjectGroup[] }
  | { kind: 'clock'; hour: number; minute: number }
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
  | { kind: 'unit-bar'; units: number; unitLabel: string; color?: string }
  /** A plain bar whose length is the thing being compared. */
  | { kind: 'length-bar'; length: number; max: number; color?: string }
  | { kind: 'ruler'; lengthCm: number; maxCm: number }
  | { kind: 'cup'; ml: number; maxMl: number }
  /** One symbol represents one item (Year 1 pictograph). */
  | {
      kind: 'pictograph';
      rows: { label: string; count: number; shape: ObjectShape; color: string }[];
    }
  /** Vertical bar chart. Every value is a multiple of `scale`, so bars align with grid lines. */
  | {
      kind: 'bar-chart';
      categories: ChartCategory[];
      scale: number;
      max: number;
      xTitle?: string;
      yTitle?: string;
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
      }
      break;
    }
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
      break;
    case 'length-bar':
      if (v.length <= 0 || v.length > v.max) problems.push('length-bar: length within max');
      break;
    case 'ruler':
      if (v.lengthCm < 1 || v.lengthCm > v.maxCm) problems.push('ruler: length within max');
      break;
    case 'cup':
      if (v.ml < 0 || v.ml > v.maxMl) problems.push('cup: level within max');
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

/** Short plain-text description of a visual (used for fixtures, previews and screen-reader labels). */
export function describeVisual(v: VisualModel): string {
  switch (v.kind) {
    case 'objects':
      return v.groups.map((g) => `${g.count} ${g.shape}`).join(', ');
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
      return `unit-bar ${v.units}`;
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
