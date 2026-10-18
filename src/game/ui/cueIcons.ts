import type { Cue } from '../../curriculum/schema';
import type { DrawContext } from './DrawContext';
import type { Rect } from './geometry';
import { THEME } from './theme';

const ORANGE = 0xf97316;
const BLUE = 0x2563eb;
const SLATE = 0x475569;

/**
 * The word-free badge that stands in for an instruction (DECISIONS #45): a "?" for "how many", +1 / -1, and a
 * small drawing for "coloured parts", "all parts", sides, corners, the hour and the minutes. Vector only.
 */
export function drawCue(ctx: DrawContext, cue: Cue, area: Rect, key: string): void {
  if (cue === 'none' || area.w < 6 || area.h < 6) return;
  const { g } = ctx;
  const s = Math.min(area.w, area.h);
  const r = s * 0.2;
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(area.x, area.y, area.w, area.h, r);
  g.lineStyle(Math.max(2, s * 0.04), 0x94a3b8, 1);
  g.strokeRoundedRect(area.x, area.y, area.w, area.h, r);
  const cx = area.x + area.w / 2;
  const big = (value: string): void =>
    ctx.text(`${key}:q`, value, cx, area.y + area.h / 2, {
      size: s * 0.52,
      color: THEME.ink,
      bold: true,
      maxWidth: area.w * 0.9,
      minSize: 10,
    });
  if (cue === 'count') return big('?');
  if (cue === 'plus-one') return big('+1');
  if (cue === 'minus-one') return big('−1');

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
  ctx.text(`${key}:q`, '?', cx, area.y + area.h * 0.82, {
    size: s * 0.3,
    color: THEME.ink,
    bold: true,
    maxWidth: area.w * 0.9,
    minSize: 8,
  });
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
