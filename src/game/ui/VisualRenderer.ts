import type {
  BlockSet,
  MoneyItem,
  ObjectGroup,
  ObjectShape,
  PatternItem,
  Shape3D,
  VisualModel,
} from '../../curriculum/visual';
import { blockLayout, equalGroupLayout, tenFrameCells } from './countLayout';
import type { DrawContext } from './DrawContext';
import type { Rect } from './geometry';
import { center, inset } from './geometry';
import { drawObject, drawPolygon, drawShape2D } from './shapes';
import { THEME, darken, hexToNumber, lighten } from './theme';

type Pt = { x: number; y: number };

/**
 * Draws a declarative visual with vector geometry inside `area`. Every visual scales from the area it is
 * given, so the same drawing works in a 384px panel at 1080p and a 3840x2160 panel.
 */
export function drawVisual(ctx: DrawContext, v: VisualModel, area: Rect, key: string): void {
  if (area.w < 4 || area.h < 4) return;
  switch (v.kind) {
    case 'objects':
      drawObjects(ctx, v.groups, area);
      break;
    case 'ten-frames':
      drawTenFrames(ctx, v.groups, area);
      break;
    case 'base-ten':
      drawBaseTen(ctx, v.sets, v.crossed, area);
      break;
    case 'equal-groups':
      drawEqualGroups(ctx, v.groups, v.perGroup, v.shape, v.color, area);
      break;
    case 'clock':
      drawClock(ctx, v.hour, v.minute, area, key, v.fives === true);
      break;
    case 'money':
      drawMoney(ctx, v.items, area, key);
      break;
    case 'shape2d':
      drawShape2D(ctx.g, v.shape, area, v.color ?? '#2e86de');
      break;
    case 'shape3d':
      drawShape3D(ctx, v.shape, area, v.color ?? '#3b82f6');
      break;
    case 'net':
      drawNet(ctx, v.shape, area);
      break;
    case 'fraction':
      drawFraction(ctx, v.numerator, v.denominator, v.style, v.shaded, area);
      break;
    case 'unit-bar':
      drawUnitBar(ctx, v.units, v.color ?? '#f59e0b', area);
      break;
    case 'length-bar':
      drawLengthBar(ctx, v.length, v.max, v.color ?? '#2563eb', area);
      break;
    case 'ruler':
      drawRuler(ctx, v.lengthCm, v.maxCm, area, key);
      break;
    case 'cup':
      drawCup(ctx, v.ml, v.maxMl, area, key);
      break;
    case 'pictograph':
      drawPictograph(ctx, v.rows, area, key);
      break;
    case 'bar-chart':
      drawBarChart(ctx, v, area, key);
      break;
    case 'pattern':
      drawPattern(ctx, v.items, area, key);
      break;
    case 'text':
      ctx.text(`${key}:t`, v.text, area.x + area.w / 2, area.y + area.h / 2, {
        size: Math.min(area.h * 0.55, area.w * 0.4),
        color: THEME.ink,
        bold: true,
        maxWidth: area.w * 0.95,
        minSize: 10,
      });
      break;
  }
}

// ------------------------------------------------------------------------------------------ objects

function bestGrid(
  count: number,
  w: number,
  h: number,
): { cols: number; rows: number; size: number } {
  let best = { cols: count, rows: 1, size: Math.min(w / Math.max(1, count), h) };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const size = Math.min(w / cols, h / rows);
    if (size > best.size) best = { cols, rows, size };
  }
  return best;
}

function drawObjects(ctx: DrawContext, groups: readonly ObjectGroup[], area: Rect): void {
  const n = groups.length;
  const gap = n > 1 ? area.w * 0.03 : 0;
  const cellW = (area.w - gap * (n - 1)) / n;
  groups.forEach((group, gi) => {
    const cell: Rect = { x: area.x + gi * (cellW + gap), y: area.y, w: cellW, h: area.h };
    if (n > 1) {
      ctx.g.lineStyle(Math.max(1, area.h * 0.012), 0x94a3b8, 0.8);
      ctx.g.strokeRoundedRect(cell.x, cell.y, cell.w, cell.h, Math.min(cell.w, cell.h) * 0.12);
    }
    const inner = inset(cell, Math.min(cell.w, cell.h) * 0.07);
    if (group.count === 0) return;
    const { cols, rows, size } = bestGrid(group.count, inner.w, inner.h);
    const gridW = cols * size;
    const gridH = rows * size;
    const x0 = inner.x + (inner.w - gridW) / 2;
    const y0 = inner.y + (inner.h - gridH) / 2;
    const firstCrossed = group.count - (group.crossed ?? 0);
    for (let i = 0; i < group.count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      // centre an incomplete last row
      const inRow = r === rows - 1 ? group.count - r * cols : cols;
      const rowOffset = ((cols - inRow) * size) / 2;
      const x = x0 + rowOffset + c * size + size / 2;
      const y = y0 + r * size + size / 2;
      drawObject(
        ctx.g,
        group.shape,
        x,
        y,
        size * 0.38,
        i >= firstCrossed ? '#cbd5e1' : group.color,
      );
      if (i >= firstCrossed) drawCross(ctx, x, y, size * 0.4);
    }
  });
}

/** A grey X over a crossed-out thing ("Berapa tinggal?"): neutral, never red. */
function drawCross(ctx: DrawContext, x: number, y: number, r: number): void {
  ctx.g.lineStyle(Math.max(2, r * 0.28), 0x475569, 1);
  ctx.g.lineBetween(x - r, y - r, x + r, y + r);
  ctx.g.lineBetween(x - r, y + r, x + r, y - r);
}

// ---------------------------------------------------------------------------------- counting pictures

function drawTenFrames(ctx: DrawContext, groups: readonly ObjectGroup[], area: Rect): void {
  const n = groups.length;
  const gap = n > 1 ? area.w * 0.04 : 0;
  const cellW = (area.w - gap * (n - 1)) / n;
  groups.forEach((group, gi) => {
    const box: Rect = { x: area.x + gi * (cellW + gap), y: area.y, w: cellW, h: area.h };
    const { cells, cell, frames } = tenFrameCells(
      group.count,
      inset(box, Math.min(box.w, box.h) * 0.04),
    );
    for (const f of frames) {
      ctx.g.fillStyle(0xffffff, 1);
      ctx.g.fillRect(f.x, f.y, f.w, f.h);
      ctx.g.lineStyle(Math.max(1, cell * 0.06), 0x94a3b8, 1);
      for (let c = 0; c <= 5; c++)
        ctx.g.lineBetween(f.x + c * cell, f.y, f.x + c * cell, f.y + f.h);
      for (let r = 0; r <= 2; r++)
        ctx.g.lineBetween(f.x, f.y + r * cell, f.x + f.w, f.y + r * cell);
    }
    const firstCrossed = group.count - (group.crossed ?? 0);
    cells.forEach((p, i) => {
      const crossed = i >= firstCrossed;
      drawObject(ctx.g, group.shape, p.x, p.y, cell * 0.36, crossed ? '#cbd5e1' : group.color);
      if (crossed) drawCross(ctx, p.x, p.y, cell * 0.36);
    });
  });
}

const BLOCK_FILL = 0x60a5fa;
const BLOCK_EDGE = 0x1e3a8a;

function drawBaseTen(
  ctx: DrawContext,
  sets: readonly BlockSet[],
  crossed: BlockSet | undefined,
  area: Rect,
): void {
  const { g } = ctx;
  const n = sets.length;
  const gap = n > 1 ? area.w * 0.05 : 0;
  const setW = (area.w - gap * (n - 1)) / n;
  sets.forEach((set, si) => {
    const box: Rect = { x: area.x + si * (setW + gap), y: area.y, w: setW, h: area.h };
    if (n > 1) {
      g.lineStyle(Math.max(1, area.h * 0.012), 0x94a3b8, 0.8);
      g.strokeRoundedRect(box.x, box.y, box.w, box.h, Math.min(box.w, box.h) * 0.1);
    }
    const { blocks, unit } = blockLayout(set, inset(box, Math.min(box.w, box.h) * 0.08));
    // crossed blocks are the last ones of each kind in the first set
    const cross = si === 0 && crossed ? crossed : { hundreds: 0, tens: 0, ones: 0 };
    const kindCount = { hundred: set.hundreds, ten: set.tens, one: set.ones };
    const kindCross = { hundred: cross.hundreds, ten: cross.tens, one: cross.ones };
    const seen = { hundred: 0, ten: 0, one: 0 };
    const line = Math.max(1, unit * 0.08);
    for (const b of blocks) {
      const index = seen[b.kind]++;
      const isCrossed = index >= kindCount[b.kind] - kindCross[b.kind];
      const r = b.rect;
      g.fillStyle(isCrossed ? 0xe2e8f0 : BLOCK_FILL, 1);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.lineStyle(line, BLOCK_EDGE, isCrossed ? 0.35 : 1);
      g.strokeRect(r.x, r.y, r.w, r.h);
      if (b.kind !== 'one' && unit > 5) {
        // segment lines: a rod shows its 10 cubes, a flat its 10 x 10 grid
        g.lineStyle(Math.max(1, line * 0.5), BLOCK_EDGE, isCrossed ? 0.2 : 0.45);
        for (let k = 1; k < 10; k++)
          g.lineBetween(r.x, r.y + (r.h * k) / 10, r.x + r.w, r.y + (r.h * k) / 10);
        if (b.kind === 'hundred')
          for (let k = 1; k < 10; k++)
            g.lineBetween(r.x + (r.w * k) / 10, r.y, r.x + (r.w * k) / 10, r.y + r.h);
      }
      if (isCrossed) {
        g.lineStyle(Math.max(2, unit * 0.22), 0x475569, 1);
        g.lineBetween(r.x, r.y, r.x + r.w, r.y + r.h);
        g.lineBetween(r.x, r.y + r.h, r.x + r.w, r.y);
      }
    }
  });
}

function drawEqualGroups(
  ctx: DrawContext,
  groups: number,
  perGroup: number,
  shape: ObjectShape,
  color: string,
  area: Rect,
): void {
  const layout = equalGroupLayout(groups, perGroup, area);
  for (const grp of layout.groups) {
    const r = grp.rect;
    ctx.g.fillStyle(0xf1f5f9, 1);
    ctx.g.fillRoundedRect(r.x, r.y, r.w, r.h, Math.min(r.w, r.h) * 0.3);
    ctx.g.lineStyle(Math.max(1.5, layout.cell * 0.1), 0x64748b, 1);
    ctx.g.strokeRoundedRect(r.x, r.y, r.w, r.h, Math.min(r.w, r.h) * 0.3);
    for (const p of grp.cells) drawObject(ctx.g, shape, p.x, p.y, layout.cell * 0.36, color);
  }
}

// --------------------------------------------------------------------------------------------- clock

function drawClock(
  ctx: DrawContext,
  hour: number,
  minute: number,
  area: Rect,
  key: string,
  fives = false,
): void {
  const { g } = ctx;
  const c = center(area);
  const r = (Math.min(area.w, area.h) / 2) * (fives ? 0.8 : 0.96);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(c.x, c.y, r);
  g.lineStyle(Math.max(2, r * 0.06), 0x0f172a, 1);
  g.strokeCircle(c.x, c.y, r);
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30;
    const major = i % 5 === 0;
    const len = major ? r * 0.13 : r * 0.05;
    g.lineStyle(Math.max(1, r * (major ? 0.035 : 0.015)), 0x334155, 1);
    g.lineBetween(
      c.x + Math.sin(a) * (r * 0.93),
      c.y - Math.cos(a) * (r * 0.93),
      c.x + Math.sin(a) * (r * 0.93 - len),
      c.y - Math.cos(a) * (r * 0.93 - len),
    );
  }
  if (r > 22) {
    for (let n = 1; n <= 12; n++) {
      const a = (n * Math.PI) / 6;
      ctx.text(
        `${key}:n${n}`,
        String(n),
        c.x + Math.sin(a) * r * 0.72,
        c.y - Math.cos(a) * r * 0.72,
        {
          size: r * 0.27,
          color: THEME.ink,
          bold: true,
        },
      );
    }
  }
  if (fives && r > 30) {
    // minute labels 5, 10, ... 55 just outside the face, so the minutes can be counted in fives
    for (let n = 1; n < 12; n++) {
      const a = (n * Math.PI) / 6;
      ctx.text(
        `${key}:m${n}`,
        String(n * 5),
        c.x + Math.sin(a) * r * 1.13,
        c.y - Math.cos(a) * r * 1.13,
        {
          size: r * 0.17,
          color: '#1d4ed8',
          bold: true,
        },
      );
    }
  }
  const hourAngle = (((hour % 12) + minute / 60) * Math.PI) / 6;
  const minuteAngle = (minute * Math.PI) / 30;
  g.lineStyle(Math.max(3, r * 0.1), 0x0f172a, 1);
  g.lineBetween(
    c.x,
    c.y,
    c.x + Math.sin(hourAngle) * r * 0.48,
    c.y - Math.cos(hourAngle) * r * 0.48,
  );
  g.lineStyle(Math.max(2, r * 0.06), 0x1d4ed8, 1);
  g.lineBetween(
    c.x,
    c.y,
    c.x + Math.sin(minuteAngle) * r * 0.78,
    c.y - Math.cos(minuteAngle) * r * 0.78,
  );
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(c.x, c.y, r * 0.06);
}

// -------------------------------------------------------------------------------------------- money

const NOTE_COLORS: Record<number, number> = {
  100: 0x93c5fd,
  500: 0x86efac,
  1000: 0xfca5a5,
  2000: 0xfdba74,
  5000: 0x5eead4,
  10000: 0xd8b4fe,
};
const COIN_SIZE: Record<number, number> = { 5: 0.7, 10: 0.78, 20: 0.86, 50: 0.96 };

function moneyLabel(sen: number): { big: string; small: string } {
  return sen < 100 ? { big: String(sen), small: 'sen' } : { big: `RM${sen / 100}`, small: '' };
}

function drawMoney(ctx: DrawContext, items: readonly MoneyItem[], area: Rect, key: string): void {
  const { g } = ctx;
  const base = Math.min(area.h * 0.9, area.w * 0.42);
  const widths = items.map((m) =>
    m.type === 'coin' ? base * (COIN_SIZE[m.valueSen] ?? 0.85) : base * 1.75,
  );
  const gapUnit = base * 0.14;
  let total = widths.reduce((s, w) => s + w, 0) + gapUnit * (items.length - 1);
  const shrink = total > area.w * 0.96 ? (area.w * 0.96) / total : 1;
  total *= shrink;
  let x = area.x + (area.w - total) / 2;
  const cy = area.y + area.h / 2;
  items.forEach((m, i) => {
    const w = (widths[i] as number) * shrink;
    const label = moneyLabel(m.valueSen);
    if (m.type === 'coin') {
      const r = w / 2;
      g.fillStyle(0xcbd5e1, 1);
      g.fillCircle(x + r, cy, r);
      g.lineStyle(Math.max(2, r * 0.1), 0x475569, 1);
      g.strokeCircle(x + r, cy, r);
      g.lineStyle(Math.max(1, r * 0.05), 0x94a3b8, 1);
      g.strokeCircle(x + r, cy, r * 0.78);
      ctx.text(`${key}:c${i}`, label.big, x + r, cy - r * 0.12, {
        size: r * 0.8,
        color: THEME.ink,
        bold: true,
        maxWidth: r * 1.5,
        minSize: 8,
      });
      ctx.text(`${key}:s${i}`, label.small, x + r, cy + r * 0.45, {
        size: r * 0.4,
        color: '#334155',
        bold: true,
      });
    } else {
      const h = w * 0.55;
      const fill = NOTE_COLORS[m.valueSen] ?? 0xe2e8f0;
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x, cy - h / 2, w, h, h * 0.1);
      g.lineStyle(Math.max(2, h * 0.05), darken(`#${fill.toString(16).padStart(6, '0')}`, 0.45), 1);
      g.strokeRoundedRect(x, cy - h / 2, w, h, h * 0.1);
      g.lineStyle(
        Math.max(1, h * 0.03),
        darken(`#${fill.toString(16).padStart(6, '0')}`, 0.3),
        0.8,
      );
      g.strokeRoundedRect(x + h * 0.1, cy - h / 2 + h * 0.1, w - h * 0.2, h - h * 0.2, h * 0.06);
      ctx.text(`${key}:n${i}`, label.big, x + w / 2, cy, {
        size: h * 0.46,
        color: THEME.ink,
        bold: true,
        maxWidth: w * 0.8,
        minSize: 8,
      });
    }
    x += w + gapUnit * shrink;
  });
}

// ----------------------------------------------------------------------------------------- 3D solids

function shade(hex: string, t: number): number {
  return t >= 0 ? lighten(hex, t) : darken(hex, -t);
}

type IsoBox = { sx: number; sy: number; sz: number };

function drawIsoBox(ctx: DrawContext, area: Rect, box: IsoBox, hex: string): void {
  const { g } = ctx;
  // unit axes: a goes up-right, b goes up-left, c goes up
  const a: Pt = { x: 0.866, y: -0.5 };
  const b: Pt = { x: -0.866, y: -0.5 };
  const wUnits = 0.866 * (box.sx + box.sy);
  const hUnits = box.sz + 0.5 * (box.sx + box.sy);
  const k = Math.min((area.w * 0.9) / wUnits, (area.h * 0.9) / hUnits);
  const p0: Pt = {
    x: area.x + area.w / 2 + (0.866 * (box.sy - box.sx) * k) / 2,
    y: area.y + area.h / 2 + (hUnits * k) / 2,
  };
  const A: Pt = { x: a.x * box.sx * k, y: a.y * box.sx * k };
  const B: Pt = { x: b.x * box.sy * k, y: b.y * box.sy * k };
  const C: Pt = { x: 0, y: -box.sz * k };
  const add = (p: Pt, ...v: Pt[]): Pt => v.reduce((s, q) => ({ x: s.x + q.x, y: s.y + q.y }), p);
  const outline = 0x0f172a;
  const lw = Math.max(1.5, k * 0.04);
  drawPolygon(g, [p0, add(p0, B), add(p0, B, C), add(p0, C)], shade(hex, -0.12), outline, lw); // left
  drawPolygon(g, [p0, add(p0, A), add(p0, A, C), add(p0, C)], shade(hex, -0.32), outline, lw); // right
  drawPolygon(
    g,
    [add(p0, C), add(p0, C, A), add(p0, C, A, B), add(p0, C, B)],
    shade(hex, 0.3),
    outline,
    lw,
  ); // top
}

function drawShape3D(ctx: DrawContext, shape: Shape3D, area: Rect, hex: string): void {
  const { g } = ctx;
  const c = center(area);
  const s = Math.min(area.w, area.h);
  const outline = 0x0f172a;
  const lw = Math.max(1.5, s * 0.02);
  switch (shape) {
    case 'cube':
      drawIsoBox(ctx, area, { sx: 1, sy: 1, sz: 1 }, hex);
      break;
    case 'cuboid':
      drawIsoBox(ctx, area, { sx: 1.9, sy: 1, sz: 0.8 }, hex);
      break;
    case 'cylinder': {
      const w = s * 0.62;
      const h = s * 0.62;
      const ry = w * 0.2;
      const x = c.x - w / 2;
      const top = c.y - h / 2;
      g.fillStyle(shade(hex, -0.12), 1);
      g.fillRect(x, top + ry, w, h - ry);
      g.fillEllipse(c.x, top + h, w, ry * 2);
      g.lineStyle(lw, outline, 1);
      g.lineBetween(x, top + ry, x, top + h);
      g.lineBetween(x + w, top + ry, x + w, top + h);
      g.strokeEllipse(c.x, top + h, w, ry * 2);
      g.fillStyle(shade(hex, -0.12), 1);
      g.fillRect(x + lw / 2, top + h - ry, w - lw, ry);
      g.fillStyle(shade(hex, 0.32), 1);
      g.fillEllipse(c.x, top + ry, w, ry * 2);
      g.lineStyle(lw, outline, 1);
      g.strokeEllipse(c.x, top + ry, w, ry * 2);
      break;
    }
    case 'cone': {
      const w = s * 0.62;
      const h = s * 0.66;
      const ry = w * 0.2;
      const base = c.y + h / 2 - ry;
      g.fillStyle(shade(hex, -0.12), 1);
      g.fillEllipse(c.x, base, w, ry * 2);
      drawPolygon(
        g,
        [
          { x: c.x, y: c.y - h / 2 },
          { x: c.x + w / 2, y: base },
          { x: c.x - w / 2, y: base },
        ],
        shade(hex, -0.05),
      );
      g.fillStyle(shade(hex, -0.05), 1);
      g.fillEllipse(c.x, base, w, ry * 2);
      g.lineStyle(lw, outline, 1);
      g.lineBetween(c.x, c.y - h / 2, c.x - w / 2, base);
      g.lineBetween(c.x, c.y - h / 2, c.x + w / 2, base);
      g.strokeEllipse(c.x, base, w, ry * 2);
      break;
    }
    case 'sphere': {
      const r = s * 0.34;
      g.fillStyle(shade(hex, -0.1), 1);
      g.fillCircle(c.x, c.y, r);
      g.fillStyle(shade(hex, 0.35), 0.9);
      g.fillCircle(c.x - r * 0.28, c.y - r * 0.3, r * 0.55);
      g.fillStyle(0xffffff, 0.65);
      g.fillCircle(c.x - r * 0.4, c.y - r * 0.42, r * 0.2);
      g.lineStyle(lw, outline, 1);
      g.strokeCircle(c.x, c.y, r);
      break;
    }
    case 'pyramid': {
      const k = s * 0.55;
      const a: Pt = { x: 0.866 * k, y: -0.5 * k };
      const b: Pt = { x: -0.866 * k, y: -0.5 * k };
      const f: Pt = { x: c.x, y: c.y + k * 0.62 };
      const apex: Pt = { x: f.x + (a.x + b.x) / 2, y: f.y + (a.y + b.y) / 2 - k * 1.0 };
      const r: Pt = { x: f.x + a.x, y: f.y + a.y };
      const l: Pt = { x: f.x + b.x, y: f.y + b.y };
      drawPolygon(g, [f, l, apex], shade(hex, -0.05), outline, lw);
      drawPolygon(g, [f, r, apex], shade(hex, -0.32), outline, lw);
      break;
    }
  }
}

// -------------------------------------------------------------------------------------------- nets

function drawNet(
  ctx: DrawContext,
  shape: 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'pyramid',
  area: Rect,
): void {
  const { g } = ctx;
  const fill = 0xbfdbfe;
  const line = 0x1e3a8a;
  const lw = Math.max(1.5, Math.min(area.w, area.h) * 0.015);
  const cellPoly = (x: number, y: number, w: number, h: number): void => {
    drawPolygon(
      g,
      [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      fill,
      line,
      lw,
    );
  };
  if (shape === 'cube' || shape === 'cuboid') {
    const wide = shape === 'cuboid';
    const u = Math.min(area.w / (wide ? 6.4 : 4), area.h / (wide ? 2.9 : 3)) * 0.95;
    const cw = wide ? u * 1.6 : u;
    const ch = wide ? u * 0.95 : u;
    const totalW = cw * 4;
    const totalH = ch * 3;
    const x0 = area.x + (area.w - totalW) / 2;
    const y0 = area.y + (area.h - totalH) / 2;
    for (const [col, row] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
    ] as const)
      cellPoly(x0 + col * cw, y0 + row * ch, cw, ch);
    return;
  }
  const c = center(area);
  if (shape === 'cylinder') {
    const d = Math.min(area.h * 0.3, (area.w * 0.95) / 3);
    const rectH = area.h * 0.34;
    const rectW = d * 3;
    const top = c.y - rectH / 2;
    cellPoly(c.x - rectW / 2, top, rectW, rectH);
    for (const cy of [top - d / 2, top + rectH + d / 2]) {
      g.fillStyle(fill, 1);
      g.fillCircle(c.x, cy, d / 2);
      g.lineStyle(lw, line, 1);
      g.strokeCircle(c.x, cy, d / 2);
    }
    return;
  }
  if (shape === 'cone') {
    const L = Math.min(area.h * 0.5, area.w * 0.48) * 0.98;
    const r = L / 2;
    const apexY = area.y + area.h - (area.h - (L + 2 * r)) / 2;
    g.fillStyle(fill, 1);
    g.slice(c.x, apexY, L, Math.PI, 2 * Math.PI, false);
    g.fillPath();
    g.lineStyle(lw, line, 1);
    g.slice(c.x, apexY, L, Math.PI, 2 * Math.PI, false);
    g.strokePath();
    g.fillStyle(fill, 1);
    g.fillCircle(c.x, apexY - L - r, r);
    g.lineStyle(lw, line, 1);
    g.strokeCircle(c.x, apexY - L - r, r);
    return;
  }
  // pyramid: square base with four triangles
  const sq = Math.min(area.w, area.h) / 2.8;
  const th = sq * 0.9;
  cellPoly(c.x - sq / 2, c.y - sq / 2, sq, sq);
  drawPolygon(
    g,
    [
      { x: c.x - sq / 2, y: c.y - sq / 2 },
      { x: c.x + sq / 2, y: c.y - sq / 2 },
      { x: c.x, y: c.y - sq / 2 - th },
    ],
    fill,
    line,
    lw,
  );
  drawPolygon(
    g,
    [
      { x: c.x - sq / 2, y: c.y + sq / 2 },
      { x: c.x + sq / 2, y: c.y + sq / 2 },
      { x: c.x, y: c.y + sq / 2 + th },
    ],
    fill,
    line,
    lw,
  );
  drawPolygon(
    g,
    [
      { x: c.x - sq / 2, y: c.y - sq / 2 },
      { x: c.x - sq / 2, y: c.y + sq / 2 },
      { x: c.x - sq / 2 - th, y: c.y },
    ],
    fill,
    line,
    lw,
  );
  drawPolygon(
    g,
    [
      { x: c.x + sq / 2, y: c.y - sq / 2 },
      { x: c.x + sq / 2, y: c.y + sq / 2 },
      { x: c.x + sq / 2 + th, y: c.y },
    ],
    fill,
    line,
    lw,
  );
}

// ----------------------------------------------------------------------------------------- fractions

function drawFraction(
  ctx: DrawContext,
  numerator: number,
  denominator: number,
  style: 'bar' | 'pie',
  shaded: readonly number[] | undefined,
  area: Rect,
): void {
  const { g } = ctx;
  const shadedSet = new Set(shaded ?? Array.from({ length: numerator }, (_, i) => i));
  const on = 0x2563eb;
  const off = 0xffffff;
  const line = 0x0f172a;
  if (style === 'bar') {
    const w = area.w * 0.92;
    const h = Math.min(area.h * 0.8, w * 0.4);
    const x0 = area.x + (area.w - w) / 2;
    const y0 = area.y + (area.h - h) / 2;
    const pw = w / denominator;
    for (let i = 0; i < denominator; i++) {
      g.fillStyle(shadedSet.has(i) ? on : off, 1);
      g.fillRect(x0 + i * pw, y0, pw, h);
    }
    g.lineStyle(Math.max(2, h * 0.04), line, 1);
    g.strokeRect(x0, y0, w, h);
    for (let i = 1; i < denominator; i++) g.lineBetween(x0 + i * pw, y0, x0 + i * pw, y0 + h);
    return;
  }
  const c = center(area);
  const r = Math.min(area.w, area.h) * 0.46;
  for (let i = 0; i < denominator; i++) {
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / denominator;
    const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / denominator;
    g.fillStyle(shadedSet.has(i) ? on : off, 1);
    g.slice(c.x, c.y, r, a0, a1, false);
    g.fillPath();
  }
  g.lineStyle(Math.max(2, r * 0.05), line, 1);
  g.strokeCircle(c.x, c.y, r);
  if (denominator > 1) {
    for (let i = 0; i < denominator; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / denominator;
      g.lineBetween(c.x, c.y, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    }
  }
}

// ---------------------------------------------------------------------------------------- measurement

function drawUnitBar(ctx: DrawContext, units: number, colorHex: string, area: Rect): void {
  const { g } = ctx;
  const unitW = Math.min((area.w * 0.94) / units, area.h * 0.5);
  const totalW = unitW * units;
  const x0 = area.x + (area.w - totalW) / 2;
  const barH = area.h * 0.34;
  const barY = area.y + area.h * 0.08;
  g.fillStyle(hexToNumber(colorHex), 1);
  g.fillRoundedRect(x0, barY, totalW, barH, barH * 0.3);
  g.lineStyle(Math.max(2, barH * 0.06), 0x0f172a, 1);
  g.strokeRoundedRect(x0, barY, totalW, barH, barH * 0.3);
  const tileY = barY + barH + area.h * 0.1;
  const tileH = Math.min(area.h * 0.36, unitW * 0.9);
  for (let i = 0; i < units; i++) {
    g.fillStyle(0xf8fafc, 1);
    g.fillRoundedRect(x0 + i * unitW + unitW * 0.06, tileY, unitW * 0.88, tileH, tileH * 0.25);
    g.lineStyle(Math.max(1.5, unitW * 0.04), 0x475569, 1);
    g.strokeRoundedRect(x0 + i * unitW + unitW * 0.06, tileY, unitW * 0.88, tileH, tileH * 0.25);
    g.fillStyle(0x94a3b8, 1);
    g.fillRect(
      x0 + i * unitW + unitW * 0.22,
      tileY + tileH * 0.42,
      unitW * 0.56,
      Math.max(2, tileH * 0.16),
    );
  }
}

function drawLengthBar(
  ctx: DrawContext,
  length: number,
  max: number,
  colorHex: string,
  area: Rect,
): void {
  const { g } = ctx;
  const w = area.w * 0.92 * (length / max);
  const h = Math.min(area.h * 0.55, 60);
  const x = area.x + area.w * 0.04;
  const y = area.y + (area.h - h) / 2;
  g.fillStyle(hexToNumber(colorHex), 1);
  g.fillRoundedRect(x, y, w, h, h * 0.3);
  g.lineStyle(Math.max(2, h * 0.07), 0x0f172a, 1);
  g.strokeRoundedRect(x, y, w, h, h * 0.3);
}

function drawRuler(
  ctx: DrawContext,
  lengthCm: number,
  maxCm: number,
  area: Rect,
  key: string,
): void {
  const { g } = ctx;
  const w = area.w * 0.94;
  const x0 = area.x + (area.w - w) / 2;
  const per = w / maxCm;
  const barH = area.h * 0.28;
  const barY = area.y + area.h * 0.06;
  g.fillStyle(0xf59e0b, 1);
  g.fillRoundedRect(x0, barY, per * lengthCm, barH, barH * 0.25);
  g.lineStyle(Math.max(2, barH * 0.06), 0x0f172a, 1);
  g.strokeRoundedRect(x0, barY, per * lengthCm, barH, barH * 0.25);
  const rulerY = barY + barH + area.h * 0.03;
  const rulerH = area.h - (rulerY - area.y) - area.h * 0.03;
  g.fillStyle(0xfef3c7, 1);
  g.fillRect(x0, rulerY, w, rulerH);
  g.lineStyle(Math.max(2, rulerH * 0.03), 0x0f172a, 1);
  g.strokeRect(x0, rulerY, w, rulerH);
  const labelEvery = maxCm <= 15 ? 1 : 5;
  for (let i = 0; i <= maxCm; i++) {
    const x = x0 + i * per;
    const long = i % labelEvery === 0;
    g.lineStyle(Math.max(1, rulerH * 0.02), 0x0f172a, 1);
    g.lineBetween(x, rulerY, x, rulerY + rulerH * (long ? 0.42 : 0.3));
    if (per > 12 && i < maxCm) {
      g.lineBetween(x + per / 2, rulerY, x + per / 2, rulerY + rulerH * 0.18);
    }
    if (long) {
      ctx.text(`${key}:r${i}`, String(i), x, rulerY + rulerH * 0.72, {
        size: Math.max(9, Math.min(rulerH * 0.34, per * 0.75)),
        color: THEME.ink,
        bold: true,
      });
    }
  }
}

function drawCup(ctx: DrawContext, ml: number, maxMl: number, area: Rect, key: string): void {
  const { g } = ctx;
  const cupH = area.h * 0.94;
  const cupW = Math.min(area.w * 0.42, cupH * 0.75);
  const x = area.x + area.w / 2 - cupW * 0.1;
  const y = area.y + (area.h - cupH) / 2;
  const level = (v: number): number => y + cupH - (cupH * v) / maxMl;
  g.fillStyle(0xe0f2fe, 0.7);
  g.fillRect(x, y, cupW, cupH);
  g.fillStyle(0x38bdf8, 1);
  g.fillRect(x, level(ml), cupW, y + cupH - level(ml));
  g.lineStyle(Math.max(2, cupW * 0.04), 0x0f172a, 1);
  g.strokeRect(x, y, cupW, cupH);
  const stepMajor = maxMl <= 500 ? 100 : 200;
  const perMl = cupH / maxMl;
  for (let v = 0; v <= maxMl; v += 50) {
    const yy = level(v);
    const major = v % stepMajor === 0;
    const mid = v % 100 === 0;
    if (!major && !mid && perMl * 50 < 6) continue;
    g.lineStyle(Math.max(1, cupW * 0.02), 0x0f172a, 1);
    g.lineBetween(x, yy, x - cupW * (major ? 0.28 : mid ? 0.2 : 0.12), yy);
    if (major) {
      ctx.text(`${key}:m${v}`, String(v), x - cupW * 0.32, yy, {
        size: Math.max(9, Math.min(cupH * 0.11, 20)),
        color: THEME.ink,
        bold: true,
        ax: 1,
      });
    }
  }
  ctx.text(`${key}:ml`, 'ml', x + cupW / 2, y - Math.max(2, cupH * 0.005), {
    size: Math.max(9, cupH * 0.1),
    color: THEME.muted,
    bold: true,
    ay: 1,
  });
}

// -------------------------------------------------------------------------------------------- data

function drawPictograph(
  ctx: DrawContext,
  rows: readonly { label: string; count: number; shape: ObjectShape; color: string }[],
  area: Rect,
  key: string,
): void {
  const { g } = ctx;
  const rowH = area.h / rows.length;
  const labelW = area.w * 0.32;
  const symW = (area.w - labelW - area.w * 0.03) / 10;
  const size = Math.min(rowH * 0.78, symW * 0.92);
  rows.forEach((row, ri) => {
    const cy = area.y + ri * rowH + rowH / 2;
    if (ri % 2 === 0) {
      g.fillStyle(0xf1f5f9, 1);
      g.fillRect(area.x, area.y + ri * rowH, area.w, rowH);
    }
    ctx.text(`${key}:l${ri}`, row.label, area.x + labelW - area.w * 0.02, cy, {
      size: Math.min(rowH * 0.5, 30),
      color: THEME.ink,
      bold: true,
      ax: 1,
      align: 'right',
      maxWidth: labelW * 0.95,
      minSize: 9,
    });
    for (let i = 0; i < row.count; i++) {
      drawObject(g, row.shape, area.x + labelW + symW * i + symW / 2, cy, size * 0.42, row.color);
    }
  });
  g.lineStyle(Math.max(1.5, area.h * 0.01), 0x94a3b8, 1);
  g.lineBetween(area.x + labelW, area.y, area.x + labelW, area.y + area.h);
}

function drawBarChart(
  ctx: DrawContext,
  v: Extract<VisualModel, { kind: 'bar-chart' }>,
  area: Rect,
  key: string,
): void {
  const { g } = ctx;
  const leftM = area.w * 0.13;
  const topM = area.h * 0.12;
  const bottomM = area.h * 0.34;
  const plot: Rect = {
    x: area.x + leftM,
    y: area.y + topM,
    w: area.w - leftM - area.w * 0.03,
    h: area.h - topM - bottomM,
  };
  const lines = v.max / v.scale;
  const per = plot.h / lines;
  const labelStep = v.scale * Math.max(1, Math.ceil(lines / 5));
  g.fillStyle(0xffffff, 1);
  g.fillRect(plot.x, plot.y, plot.w, plot.h);
  for (let i = 0; i <= lines; i++) {
    const y = plot.y + plot.h - i * per;
    g.lineStyle(Math.max(1, per * 0.05), i === 0 ? 0x0f172a : 0xcbd5e1, 1);
    g.lineBetween(plot.x, y, plot.x + plot.w, y);
    const val = i * v.scale;
    if (val % labelStep === 0) {
      ctx.text(`${key}:y${i}`, String(val), plot.x - area.w * 0.015, y, {
        size: Math.max(9, Math.min(per * 1.6, area.h * 0.1)),
        color: THEME.ink,
        bold: true,
        ax: 1,
      });
    }
  }
  const bandW = plot.w / v.categories.length;
  v.categories.forEach((cat, i) => {
    const bw = bandW * 0.56;
    const bx = plot.x + i * bandW + (bandW - bw) / 2;
    const bh = (plot.h * cat.value) / v.max;
    g.fillStyle(hexToNumber(cat.color ?? '#2563eb'), 1);
    g.fillRect(bx, plot.y + plot.h - bh, bw, bh);
    g.lineStyle(Math.max(1, bw * 0.05), 0x0f172a, 1);
    g.strokeRect(bx, plot.y + plot.h - bh, bw, bh);
    ctx.text(`${key}:c${i}`, cat.label, bx + bw / 2, plot.y + plot.h + area.h * 0.03, {
      size: Math.max(9, Math.min(area.h * 0.11, bandW * 0.24)),
      color: THEME.ink,
      bold: true,
      ay: 0,
      maxWidth: bandW * 0.98,
      minSize: 8,
    });
  });
  g.lineStyle(Math.max(2, plot.h * 0.02), 0x0f172a, 1);
  g.lineBetween(plot.x, plot.y, plot.x, plot.y + plot.h);
  if (v.yTitle) {
    ctx.text(`${key}:yt`, v.yTitle, area.x + area.w * 0.01, area.y + area.h * 0.05, {
      size: Math.max(9, area.h * 0.09),
      color: THEME.muted,
      bold: true,
      ax: 0,
      maxWidth: area.w * 0.7,
      minSize: 8,
    });
  }
  if (v.xTitle) {
    ctx.text(`${key}:xt`, v.xTitle, plot.x + plot.w / 2, area.y + area.h * 0.955, {
      size: Math.max(9, area.h * 0.1),
      color: THEME.muted,
      bold: true,
      ay: 1,
      maxWidth: plot.w,
      minSize: 8,
    });
  }
  if (v.highlightAxis) {
    const orange = 0xf97316;
    const lw = Math.max(3, area.h * 0.03);
    g.lineStyle(lw, orange, 1);
    g.fillStyle(orange, 1);
    if (v.highlightAxis === 'x') {
      const y = plot.y + plot.h + lw * 1.4;
      g.lineBetween(plot.x, y, plot.x + plot.w - lw * 2, y);
      g.fillTriangle(
        plot.x + plot.w,
        y,
        plot.x + plot.w - lw * 3,
        y - lw * 1.6,
        plot.x + plot.w - lw * 3,
        y + lw * 1.6,
      );
    } else {
      const x = plot.x - lw * 1.4;
      g.lineBetween(x, plot.y + plot.h, x, plot.y + lw * 2);
      g.fillTriangle(x, plot.y, x - lw * 1.6, plot.y + lw * 3, x + lw * 1.6, plot.y + lw * 3);
    }
  }
}

function drawPattern(
  ctx: DrawContext,
  items: readonly PatternItem[],
  area: Rect,
  key: string,
): void {
  const { g } = ctx;
  const n = items.length;
  const size = Math.min((area.w * 0.96) / n, area.h * 0.8);
  const x0 = area.x + (area.w - size * n) / 2;
  const cy = area.y + area.h / 2;
  items.forEach((item, i) => {
    const cx = x0 + i * size + size / 2;
    if (item) {
      drawObject(g, item.shape, cx, cy, size * 0.36, item.color);
    } else {
      g.lineStyle(Math.max(2, size * 0.05), 0x64748b, 1);
      g.strokeRoundedRect(cx - size * 0.4, cy - size * 0.4, size * 0.8, size * 0.8, size * 0.15);
      ctx.text(`${key}:q`, '?', cx, cy, { size: size * 0.55, color: THEME.muted, bold: true });
    }
  });
}
