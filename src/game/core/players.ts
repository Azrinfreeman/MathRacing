import type { RacerId } from './racers';

/**
 * Player identities. Colour is never the only cue: every player also has a symbol, a lane marker and a
 * racer (a default per slot, which the pupil may change), all derived from the player's slot.
 */
export type SymbolId = 'star' | 'circle' | 'triangle' | 'square' | 'diamond';

export type PlayerStyle = {
  /** Stable id used for colour tokens and CSS. */
  colorId: string;
  /** Panel header / racer body colour. White text on this colour meets WCAG AA (4.5:1). */
  color: string;
  /** Darker shade for outlines. */
  dark: string;
  /** Very light tint of the colour for panel backgrounds. */
  tint: string;
  symbol: SymbolId;
  /** The racer this slot uses until the pupil picks another one (see `racers.ts`). */
  defaultRacer: RacerId;
  symbolName: { bm: string; en: string };
  colorName: { bm: string; en: string };
};

export const MAX_PLAYERS = 5;
export const MIN_PLAYERS = 2;

export const PLAYER_STYLES: readonly PlayerStyle[] = [
  {
    colorId: 'orange',
    color: '#c2410c',
    dark: '#7c2d12',
    tint: '#fff1e8',
    symbol: 'star',
    defaultRacer: 'rocket',
    symbolName: { bm: 'Bintang', en: 'Star' },
    colorName: { bm: 'Jingga', en: 'Orange' },
  },
  {
    colorId: 'blue',
    color: '#1d4ed8',
    dark: '#1e3a8a',
    tint: '#e8effe',
    symbol: 'circle',
    defaultRacer: 'kart',
    symbolName: { bm: 'Bulatan', en: 'Circle' },
    colorName: { bm: 'Biru', en: 'Blue' },
  },
  {
    colorId: 'green',
    color: '#15803d',
    dark: '#14532d',
    tint: '#e7f7ec',
    symbol: 'triangle',
    defaultRacer: 'wedge',
    symbolName: { bm: 'Segi tiga', en: 'Triangle' },
    colorName: { bm: 'Hijau', en: 'Green' },
  },
  {
    colorId: 'purple',
    color: '#7e22ce',
    dark: '#581c87',
    tint: '#f4eafd',
    symbol: 'square',
    defaultRacer: 'saucer',
    symbolName: { bm: 'Petak', en: 'Square' },
    colorName: { bm: 'Ungu', en: 'Purple' },
  },
  {
    colorId: 'teal',
    color: '#0e7490',
    dark: '#134e4a',
    tint: '#e3f6f8',
    symbol: 'diamond',
    defaultRacer: 'block',
    symbolName: { bm: 'Berlian', en: 'Diamond' },
    colorName: { bm: 'Teal', en: 'Teal' },
  },
];

export function styleForSlot(slot: number): PlayerStyle {
  const style = PLAYER_STYLES[slot];
  if (!style) throw new RangeError(`No player style for slot ${slot}`);
  return style;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new RangeError(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => channel(parseInt(h as string, 16))) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function defaultPlayerName(slot: number, language: 'bm' | 'en'): string {
  return language === 'en' ? `Player ${slot + 1}` : `Pemain ${slot + 1}`;
}
