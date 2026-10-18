import type { Cue } from '../../curriculum/schema';
import type { DrawContext } from './DrawContext';
import type { Rect } from './geometry';
import { THEME, hexToNumber } from './theme';

const ORANGE = 0xf97316;
const BLUE = 0x2563eb;
const SLATE = 0x475569;
const INK = hexToNumber(THEME.ink);

/**
 * The word-free badge that stands in for an instruction (DECISIONS #45, #46): a drawn "?" for "how many", one
 * dot added or taken away, and a small drawing for "coloured parts", "all parts", sides, corners, the hour and
 * the minutes. Vector only: no glyph of any font is drawn, so nothing here has to be read.
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
  const cx = area.x + area.w / 2;
  const cy0 = area.y + area.h / 2;
  if (cue === 'count') return drawQuestionMark(g, cx, cy0, s * 0.7, INK);
  if (cue === 'plus-one' || cue === 'minus-one') {
    // one dot, and a plus or a minus: one more or one fewer
    g.fillStyle(ORANGE, 1);
    g.fillCircle(cx - s * 0.2, cy0, s * 0.14);
    drawSign(g, cx + s * 0.2, cy0, s * 0.3, cue === 'plus-one' ? 'plus' : 'minus', INK);
    return;
  }

  // a small drawing in the upper part and a "?" under it
  const art: Rect = {
    x: area.x + s * 0.14,
    y: area.y + s * 0.1,
    w: area.w - s * 0.28,
    h: s * 0.55,
  };
  const acx = art.x + art.w / 2;
  const acy = art.y + art.h / 2;
  const u = Math.min(art.w, art.h);
  const lw = Math.max(2, u * 0.09);
  switch (cue) {
    case 'shaded':
    case 'parts': {
      const cellW = art.w / 4;
      const cellH = u * 0.5;
      const y = acy - cellH / 2;
      for (let i = 0; i < 4; i++) {
        const colored = cue === 'parts' || i < 2;
        g.fillStyle(colored ? BLUE : 0xffffff, 1);
        g.fillRect(art.x + i * cellW, y, cellW, cellH);
        g.lineStyle(Math.max(1, lw * 0.5), SLATE, 1);
        g.strokeRect(art.x + i * cellW, y, cellW, cellH);
      }
      g.lineStyle(lw, ORANGE, 1);
      const ringW = cue === 'shaded' ? cellW * 2 : art.w;
      g.strokeRect(art.x - lw * 0.4, y - lw * 0.8, ringW + lw * 0.8, cellH + lw * 1.6);
      break;
    }
    case 'sides':
    case 'corners': {
      const half = u * 0.4;
      const x0 = acx - half;
      const y0 = acy - half;
      g.lineStyle(
        cue === 'sides' ? lw * 1.4 : Math.max(1, lw * 0.5),
        cue === 'sides' ? ORANGE : SLATE,
        1,
      );
      g.strokeRect(x0, y0, half * 2, half * 2);
      if (cue === 'corners') {
        g.fillStyle(ORANGE, 1);
        for (const [px, py] of [
          [x0, y0],
          [x0 + half * 2, y0],
          [x0, y0 + half * 2],
          [x0 + half * 2, y0 + half * 2],
        ] as const)
          g.fillCircle(px, py, lw * 1.1);
      }
      break;
    }
    case 'each': {
      // one ring holding a few things: the question is about one group
      g.lineStyle(lw, ORANGE, 1);
      g.strokeCircle(acx, acy, u * 0.46);
      g.fillStyle(BLUE, 1);
      for (const [dx, dy] of [
        [-0.2, 0.12],
        [0.2, 0.12],
        [0, -0.2],
      ] as const)
        g.fillCircle(acx + dx * u, acy + dy * u, u * 0.1);
      break;
    }
    case 'hour':
    case 'minute': {
      const rad = u * 0.46;
      g.lineStyle(Math.max(1.5, lw * 0.6), SLATE, 1);
      g.strokeCircle(acx, acy, rad);
      const short = cue === 'hour';
      // short hand to 4 o'clock, long hand to 12: the highlighted one is the one to read
      g.lineStyle(short ? lw * 1.5 : lw * 0.6, short ? ORANGE : 0x94a3b8, 1);
      g.lineBetween(acx, acy, acx + rad * 0.45, acy + rad * 0.26);
      g.lineStyle(short ? lw * 0.6 : lw * 1.5, short ? 0x94a3b8 : ORANGE, 1);
      g.lineBetween(acx, acy, acx, acy - rad * 0.8);
      break;
    }
  }
  drawQuestionMark(g, cx, area.y + area.h * 0.82, s * 0.3, INK);
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
