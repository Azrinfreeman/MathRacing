import type { Cue } from '../../curriculum/schema';
import type { DrawContext } from './DrawContext';
import type { Rect } from './geometry';
import { THEME, hexToNumber } from './theme';

const INK = hexToNumber(THEME.ink);

/**
 * The word-free badge that stands in for an instruction (DECISIONS #45, #46, #49): a drawn "?" for "how many".
 * Every other badge (a dot and a sign, coloured parts, sides, the hour, "each") was dropped because pupils could
 * not tell what it meant; the picture carries the question instead. Vector only: no glyph of any font is drawn.
 */
export function drawCue(ctx: DrawContext, cue: Cue, area: Rect): void {
  if (cue === 'none' || area.w < 6 || area.h < 6) return;
  const { g } = ctx;
  const s = Math.min(area.w, area.h);
  const r = s * 0.2;
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(area.x, area.y, area.w, area.h, r);
  g.lineStyle(Math.max(2, s * 0.04), 0x94a3b8, 1);
  g.strokeRoundedRect(area.x, area.y, area.w, area.h, r);
  drawQuestionMark(g, area.x + area.w / 2, area.y + area.h / 2, s * 0.7, INK);
}

type Gfx = DrawContext['g'];

/** A "?" drawn with an arc, a stem and a dot, `size` tall and centred on (cx, cy). */
export function drawQuestionMark(
  g: Gfx,
  cx: number,
  cy: number,
  size: number,
  color: number,
): void {
  const w = Math.max(2, size * 0.13);
  g.lineStyle(w, color, 1);
  g.beginPath();
  g.arc(cx, cy - size * 0.2, size * 0.22, Math.PI, Math.PI * 2.5, false);
  g.strokePath();
  g.lineBetween(cx, cy + size * 0.02, cx, cy + size * 0.14);
  g.fillStyle(color, 1);
  g.fillCircle(cx, cy + size * 0.4, w * 0.75);
}

/** A plus or a minus sign, `size` wide, centred on (cx, cy). */
export function drawSign(
  g: Gfx,
  cx: number,
  cy: number,
  size: number,
  sign: 'plus' | 'minus',
  color: number,
): void {
  g.lineStyle(Math.max(2, size * 0.2), color, 1);
  g.lineBetween(cx - size / 2, cy, cx + size / 2, cy);
  if (sign === 'plus') g.lineBetween(cx, cy - size / 2, cx, cy + size / 2);
}

/** A tick: "right". */
export function drawCheck(g: Gfx, cx: number, cy: number, r: number, color: number): void {
  g.lineStyle(Math.max(3, r * 0.3), color, 1);
  g.lineBetween(cx - r * 0.7, cy + r * 0.05, cx - r * 0.2, cy + r * 0.55);
  g.lineBetween(cx - r * 0.2, cy + r * 0.55, cx + r * 0.75, cy - r * 0.55);
}

/** A circular arrow: "try again". */
export function drawRetry(g: Gfx, cx: number, cy: number, r: number, color: number): void {
  g.lineStyle(Math.max(3, r * 0.26), color, 1);
  g.beginPath();
  g.arc(cx, cy, r * 0.7, -Math.PI * 0.35, Math.PI * 1.15, false);
  g.strokePath();
  const a = Math.PI * 1.15;
  const ex = cx + Math.cos(a) * r * 0.7;
  const ey = cy + Math.sin(a) * r * 0.7;
  g.fillStyle(color, 1);
  g.fillTriangle(ex - r * 0.35, ey - r * 0.2, ex + r * 0.35, ey - r * 0.2, ex, ey + r * 0.4);
}

/** A lightbulb: the hint marker. Drawn, so it needs no font and works in both languages. */
export function drawBulb(g: DrawContext['g'], at: { x: number; y: number }, r: number): void {
  g.fillStyle(0xfacc15, 1);
  g.fillCircle(at.x, at.y - r * 0.15, r * 0.7);
  g.lineStyle(Math.max(1.5, r * 0.12), 0xa16207, 1);
  g.strokeCircle(at.x, at.y - r * 0.15, r * 0.7);
  g.fillStyle(0x64748b, 1);
  g.fillRoundedRect(at.x - r * 0.3, at.y + r * 0.5, r * 0.6, r * 0.4, r * 0.1);
  g.lineStyle(Math.max(1.5, r * 0.12), 0xf59e0b, 1);
  for (const a of [-0.9, 0, 0.9]) {
    const sx = at.x + Math.sin(a) * r * 1.0;
    const sy = at.y - r * 0.15 - Math.cos(a) * r * 1.0;
    g.lineBetween(sx, sy, at.x + Math.sin(a) * r * 1.3, at.y - r * 0.15 - Math.cos(a) * r * 1.3);
  }
}
