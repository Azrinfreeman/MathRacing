import type { PlayerStyle, SymbolId } from '../game/core/players';
import { starPoints } from '../game/ui/shapes';

/**
 * Original inline SVG for the DOM screens (menu, setup steps). Vehicles use the same vehicle-space coordinates
 * as `TrackView.drawRacer`, so a pupil sees the same car on the setup screen and on the track. All markup is
 * built from constants and player styles, never from user input.
 */

type Pt = [number, number];

const pts = (list: readonly Pt[]): string => list.map(([x, y]) => `${x},${y}`).join(' ');

function mix(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number): number => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (255 - c) * amount);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

function symbolShape(symbol: SymbolId, cx: number, cy: number, r: number, fill: string): string {
  switch (symbol) {
    case 'star':
      return `<polygon points="${starPoints(cx, cy + r * 0.06, r * 1.05, r * 0.46)
        .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
        .join(' ')}" fill="${fill}"/>`;
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="${fill}"/>`;
    case 'triangle':
      return `<polygon points="${pts([
        [cx, cy - r],
        [cx + r, cy + r * 0.8],
        [cx - r, cy + r * 0.8],
      ])}" fill="${fill}"/>`;
    case 'square':
      return `<rect x="${cx - r * 0.85}" y="${cy - r * 0.85}" width="${r * 1.7}" height="${r * 1.7}" fill="${fill}"/>`;
    case 'diamond':
      return `<polygon points="${pts([
        [cx, cy - r],
        [cx + r, cy],
        [cx, cy + r],
        [cx - r, cy],
      ])}" fill="${fill}"/>`;
  }
}

/** A player's identity symbol on its colour (the lane badge on the track). */
export function symbolBadgeSvg(style: PlayerStyle): string {
  return `<svg viewBox="-1 -1 2 2" xmlns="http://www.w3.org/2000/svg"><circle r="1" fill="${style.color}"/>${symbolShape(style.symbol, 0, 0, 0.55, '#ffffff')}</svg>`;
}

/** The player's vehicle, facing right. */
export function vehicleSvg(style: PlayerStyle): string {
  const body = style.color;
  const dark = style.dark;
  const light = mix(style.color, 0.55);
  const sw = 0.07;
  const poly = (list: readonly Pt[], fill: string): string =>
    `<polygon points="${pts(list)}" fill="${fill}" stroke="${dark}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const wheel = (x: number, y: number): string =>
    `<circle cx="${x}" cy="${y}" r="0.26" fill="#111827"/><circle cx="${x}" cy="${y}" r="0.11" fill="#e5e7eb"/>`;
  const badge = (x: number, y: number): string =>
    `<circle cx="${x}" cy="${y}" r="0.27" fill="#ffffff"/>${symbolShape(style.symbol, x, y, 0.19, body)}`;
  let parts = '';
  switch (style.vehicle) {
    case 'rocket':
      parts =
        poly(
          [
            [-0.55, -0.4],
            [-1.0, -0.9],
            [-0.85, -0.38],
          ],
          dark,
        ) +
        poly(
          [
            [-0.55, 0.4],
            [-1.0, 0.9],
            [-0.85, 0.38],
          ],
          dark,
        ) +
        poly(
          [
            [1.05, 0],
            [0.55, -0.44],
            [-0.7, -0.44],
            [-0.92, -0.2],
            [-0.92, 0.2],
            [-0.7, 0.44],
            [0.55, 0.44],
          ],
          body,
        ) +
        `<circle cx="0.5" cy="0" r="0.2" fill="#bae6fd"/>` +
        badge(-0.15, 0);
      break;
    case 'kart':
      parts =
        poly(
          [
            [-0.9, 0.05],
            [-0.75, -0.22],
            [0.75, -0.22],
            [0.95, 0.05],
            [0.95, 0.42],
            [-0.9, 0.42],
          ],
          body,
        ) +
        `<circle cx="0.05" cy="-0.32" r="0.24" fill="#fde68a"/>` +
        poly(
          [
            [0.55, -0.12],
            [0.85, 0.02],
            [0.55, 0.02],
          ],
          light,
        ) +
        wheel(-0.5, 0.42) +
        wheel(0.55, 0.42) +
        badge(-0.3, 0.14);
      break;
    case 'wedge':
      parts =
        poly(
          [
            [1.0, 0.42],
            [-0.95, 0.42],
            [-0.95, -0.28],
            [0.1, -0.28],
          ],
          body,
        ) +
        poly(
          [
            [0.15, -0.2],
            [0.75, 0.16],
            [0.15, 0.16],
          ],
          light,
        ) +
        wheel(-0.55, 0.44) +
        wheel(0.55, 0.44) +
        badge(-0.5, 0.08);
      break;
    case 'saucer':
      parts =
        `<circle cx="0.05" cy="-0.18" r="0.46" fill="#bae6fd" stroke="${dark}" stroke-width="${sw}"/>` +
        `<ellipse cx="0" cy="0.12" rx="1" ry="0.31" fill="${body}" stroke="${dark}" stroke-width="${sw}"/>` +
        [-0.65, 0, 0.65]
          .map((x) => `<circle cx="${x}" cy="0.16" r="0.09" fill="#fde68a"/>`)
          .join('') +
        badge(0.05, -0.18);
      break;
    case 'block':
      parts =
        poly(
          [
            [-0.95, -0.4],
            [0.25, -0.4],
            [0.25, 0.42],
            [-0.95, 0.42],
          ],
          body,
        ) +
        poly(
          [
            [0.25, -0.12],
            [0.75, -0.12],
            [1.0, 0.12],
            [1.0, 0.42],
            [0.25, 0.42],
          ],
          mix(style.color, 0.25),
        ) +
        poly(
          [
            [0.42, -0.02],
            [0.72, -0.02],
            [0.86, 0.14],
            [0.42, 0.14],
          ],
          '#bae6fd',
        ) +
        wheel(-0.55, 0.44) +
        wheel(0.62, 0.44) +
        badge(-0.35, 0);
      break;
  }
  return `<svg viewBox="-1.15 -1 2.3 2" xmlns="http://www.w3.org/2000/svg"><ellipse cx="0" cy="0.72" rx="0.95" ry="0.14" fill="rgba(0,0,0,0.22)"/>${parts}</svg>`;
}

/** 1 to 4 filled stars out of 4, for the difficulty levels. */
export function levelStarsSvg(level: number): string {
  const stars = [0, 1, 2, 3]
    .map((i) => {
      const cx = 1 + i * 2.2;
      const p = starPoints(cx, 1.05, 1, 0.45)
        .map((q) => `${q.x.toFixed(3)},${q.y.toFixed(3)}`)
        .join(' ');
      const on = i < level;
      return `<polygon points="${p}" fill="${on ? '#f59e0b' : 'none'}" stroke="${on ? '#b45309' : '#94a3b8'}" stroke-width="0.16" stroke-linejoin="round"/>`;
    })
    .join('');
  return `<svg viewBox="-0.1 -0.1 8.9 2.3" xmlns="http://www.w3.org/2000/svg">${stars}</svg>`;
}

const ICON_OPEN =
  '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">';

/** A simple pictogram for each topic group (numbers, operations, fractions, money, time, ...). */
export function topicIconSvg(topicId: string): string {
  const group = topicId.replace(/^y\d-/, '');
  let body: string;
  switch (group) {
    case 'numbers':
      body =
        '<text x="24" y="33" text-anchor="middle" font-size="22" font-weight="800" fill="currentColor" stroke="none" font-family="system-ui, sans-serif">123</text>';
      break;
    case 'operations':
      body =
        '<path d="M14 10v14M7 17h14"/><path d="M27 17h14"/><path d="M8 34l10 8M18 34L8 42"/><path d="M27 34h14M27 40h14"/>';
      break;
    case 'fractions':
      body =
        '<circle cx="24" cy="24" r="17"/><path d="M24 7v34"/><path d="M24 7a17 17 0 0 1 0 34z" fill="currentColor" fill-opacity="0.35"/>';
      break;
    case 'money':
      body =
        '<circle cx="19" cy="26" r="12"/><circle cx="31" cy="20" r="12" fill="currentColor" fill-opacity="0.2"/><text x="31" y="25" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor" stroke="none" font-family="system-ui, sans-serif">RM</text>';
      break;
    case 'time':
      body = '<circle cx="24" cy="24" r="18"/><path d="M24 13v11l8 5"/>';
      break;
    case 'measurement':
      body =
        '<rect x="5" y="17" width="38" height="14" rx="2"/><path d="M12 17v6M19 17v9M26 17v6M33 17v9M40 17v6"/>';
      break;
    case 'space':
      body =
        '<rect x="6" y="24" width="16" height="16"/><circle cx="34" cy="32" r="8"/><path d="M24 6l10 14H14z"/>';
      break;
    case 'data':
      body =
        '<path d="M6 42h36"/><rect x="10" y="26" width="7" height="16"/><rect x="21" y="14" width="7" height="28"/><rect x="32" y="20" width="7" height="22"/>';
      break;
    default:
      body = '<circle cx="24" cy="24" r="16"/>';
  }
  return `${ICON_OPEN}${body}</svg>`;
}

/** Menu pictograms. */
export const MENU_ICONS = {
  race: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M10 44V5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M10 6h30v20H10z" fill="#fff" stroke="currentColor" stroke-width="2.5"/><path d="M10 6h7.5v5H10zM25 6h7.5v5H25zM17.5 11H25v5h-7.5zM32.5 11H40v5h-7.5zM10 16h7.5v5H10zM25 16h7.5v5H25zM17.5 21H25v5h-7.5zM32.5 21H40v5h-7.5z" fill="currentColor"/></svg>`,
  practice: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="3" fill="currentColor"/></svg>`,
  again: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M39 24a15 15 0 1 1-4.4-10.6"/><path d="M36 5v9h-9"/></svg>`,
  teacher: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="6"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2"/></svg>`,
} as const;
