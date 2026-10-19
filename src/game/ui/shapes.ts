import type * as Phaser from 'phaser';
import type { ObjectShape, Shape2D } from '../../curriculum/visual';
import type { SymbolId } from '../core/players';
import { hexToNumber } from './theme';

type Graphics = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

function fillPolygon(g: Graphics, pts: readonly Pt[]): void {
  const first = pts[0];
  if (!first) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
  g.fillPath();
}

function strokePolygon(g: Graphics, pts: readonly Pt[]): void {
  const first = pts[0];
  if (!first) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
  g.strokePath();
}

export function drawPolygon(
  g: Graphics,
  pts: readonly Pt[],
  fill: number,
  stroke?: number,
  strokeWidth = 2,
): void {
  g.fillStyle(fill, 1);
  fillPolygon(g, pts);
  if (stroke !== undefined) {
    g.lineStyle(strokeWidth, stroke, 1);
    strokePolygon(g, pts);
  }
}

/** Regular n-gon centred at (cx, cy) with circumradius r, first vertex pointing up. */
export function regularPolygon(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation = -Math.PI / 2,
): Pt[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = rotation + (i * 2 * Math.PI) / sides;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

export function starPoints(cx: number, cy: number, outer: number, inner: number, points = 5): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** A player's identity symbol (star, circle, triangle, square, diamond) drawn with vector geometry. */
export function drawSymbol(
  g: Graphics,
  symbol: SymbolId,
  cx: number,
  cy: number,
  r: number,
  colorHex: string,
): void {
  const color = hexToNumber(colorHex);
  switch (symbol) {
    case 'star':
      drawPolygon(g, starPoints(cx, cy + r * 0.06, r * 1.05, r * 0.46), color);
      break;
    case 'circle':
      g.fillStyle(color, 1);
      g.fillCircle(cx, cy, r * 0.9);
      break;
    case 'triangle':
      drawPolygon(
        g,
        [
          { x: cx, y: cy - r },
          { x: cx + r, y: cy + r * 0.8 },
          { x: cx - r, y: cy + r * 0.8 },
        ],
        color,
      );
      break;
    case 'square':
      drawPolygon(
        g,
        [
          { x: cx - r * 0.85, y: cy - r * 0.85 },
          { x: cx + r * 0.85, y: cy - r * 0.85 },
          { x: cx + r * 0.85, y: cy + r * 0.85 },
          { x: cx - r * 0.85, y: cy + r * 0.85 },
        ],
        color,
      );
      break;
    case 'diamond':
      drawPolygon(
        g,
        [
          { x: cx, y: cy - r * 1.05 },
          { x: cx + r * 0.85, y: cy },
          { x: cx, y: cy + r * 1.05 },
          { x: cx - r * 0.85, y: cy },
        ],
        color,
      );
      break;
  }
}

/** Simple countable object (used for counting, patterns, pictographs). */
export function drawObject(
  g: Graphics,
  shape: ObjectShape,
  cx: number,
  cy: number,
  r: number,
  colorHex: string,
): void {
  const fill = hexToNumber(colorHex);
  const stroke = 0x0f172a;
  switch (shape) {
    case 'circle':
      g.fillStyle(fill, 1);
      g.fillCircle(cx, cy, r);
      g.lineStyle(Math.max(1, r * 0.12), stroke, 0.55);
      g.strokeCircle(cx, cy, r);
      break;
    case 'square':
      drawPolygon(
        g,
        [
          { x: cx - r * 0.9, y: cy - r * 0.9 },
          { x: cx + r * 0.9, y: cy - r * 0.9 },
          { x: cx + r * 0.9, y: cy + r * 0.9 },
          { x: cx - r * 0.9, y: cy + r * 0.9 },
        ],
        fill,
        stroke,
        Math.max(1, r * 0.12),
      );
      break;
    case 'triangle':
      drawPolygon(
        g,
        [
          { x: cx, y: cy - r },
          { x: cx + r * 1.05, y: cy + r * 0.85 },
          { x: cx - r * 1.05, y: cy + r * 0.85 },
        ],
        fill,
        stroke,
        Math.max(1, r * 0.12),
      );
      break;
    case 'diamond':
      drawPolygon(
        g,
        [
          { x: cx, y: cy - r * 1.05 },
          { x: cx + r * 0.85, y: cy },
          { x: cx, y: cy + r * 1.05 },
          { x: cx - r * 0.85, y: cy },
        ],
        fill,
        stroke,
        Math.max(1, r * 0.12),
      );
      break;
    case 'star':
      drawPolygon(
        g,
        starPoints(cx, cy + r * 0.05, r * 1.1, r * 0.48),
        fill,
        stroke,
        Math.max(1, r * 0.1),
      );
      break;
    case 'heart': {
      g.fillStyle(fill, 1);
      g.fillCircle(cx - r * 0.5, cy - r * 0.25, r * 0.55);
      g.fillCircle(cx + r * 0.5, cy - r * 0.25, r * 0.55);
      fillPolygon(g, [
        { x: cx - r * 1.03, y: cy - r * 0.05 },
        { x: cx + r * 1.03, y: cy - r * 0.05 },
        { x: cx, y: cy + r * 1.0 },
      ]);
      break;
    }
  }
}

/** Two-dimensional shape drawn inside a box (used for naming shapes and classification). */
export function drawShape2D(
  g: Graphics,
  shape: Shape2D,
  box: { x: number; y: number; w: number; h: number },
  colorHex: string,
  corners = false,
): void {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const s = Math.min(box.w, box.h) * 0.9;
  const fill = hexToNumber(colorHex);
  const stroke = 0x0f172a;
  const lw = Math.max(2, s * 0.03);
  /** The polygon, with a dot on every corner when the corners are to be counted. */
  const poly = (
    pts: readonly { x: number; y: number }[],
    f: number,
    st: number,
    w: number,
  ): void => {
    drawPolygon(g, pts, f, st, w);
    if (!corners) return;
    g.fillStyle(0xf97316, 1);
    for (const p of pts) g.fillCircle(p.x, p.y, s * 0.045);
  };
  switch (shape) {
    case 'circle':
      g.fillStyle(fill, 1);
      g.fillCircle(cx, cy, s / 2);
      g.lineStyle(lw, stroke, 1);
      g.strokeCircle(cx, cy, s / 2);
      break;
    case 'square': {
      const h = s * 0.86;
      poly(
        [
          { x: cx - h / 2, y: cy - h / 2 },
          { x: cx + h / 2, y: cy - h / 2 },
          { x: cx + h / 2, y: cy + h / 2 },
          { x: cx - h / 2, y: cy + h / 2 },
        ],
        fill,
        stroke,
        lw,
      );
      break;
    }
    case 'rectangle': {
      const w = Math.min(box.w * 0.94, s * 1.5);
      const h = w * 0.55;
      poly(
        [
          { x: cx - w / 2, y: cy - h / 2 },
          { x: cx + w / 2, y: cy - h / 2 },
          { x: cx + w / 2, y: cy + h / 2 },
          { x: cx - w / 2, y: cy + h / 2 },
        ],
        fill,
        stroke,
        lw,
      );
      break;
    }
    case 'triangle':
      poly(
        [
          { x: cx, y: cy - s * 0.47 },
          { x: cx + s * 0.55, y: cy + s * 0.4 },
          { x: cx - s * 0.55, y: cy + s * 0.4 },
        ],
        fill,
        stroke,
        lw,
      );
      break;
    case 'pentagon':
      poly(regularPolygon(cx, cy + s * 0.03, s * 0.5, 5), fill, stroke, lw);
      break;
    case 'hexagon':
      poly(regularPolygon(cx, cy, s * 0.5, 6, 0), fill, stroke, lw);
      break;
    case 'octagon':
      poly(regularPolygon(cx, cy, s * 0.5, 8, Math.PI / 8), fill, stroke, lw);
      break;
  }
}
