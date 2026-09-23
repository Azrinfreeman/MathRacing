/** Colours and type used by the canvas. Tuned for high contrast on a classroom projector or touch panel. */
export const FONT_FAMILY = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const THEME = {
  night: 0x0b1d3a,
  sky: 0x38bdf8,
  skyDeep: 0x0ea5e9,
  grass: 0x22c55e,
  track: 0x334155,
  trackLine: 0xffffff,
  panel: 0xffffff,
  ink: '#0f172a',
  inkNum: 0x0f172a,
  muted: '#475569',
  key: 0xf1f5f9,
  keyBorder: 0x94a3b8,
  keyPressed: 0xcbd5e1,
  action: 0x1d4ed8,
  actionText: '#ffffff',
  clear: 0x475569,
  good: 0x15803d,
  goodTint: 0xdcfce7,
  soft: 0xfff7e0,
  softBorder: 0xf59e0b,
  disabledAlpha: 0.55,
  white: '#ffffff',
} as const;

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Mix a #rrggbb colour towards white (t in 0..1) and return a number colour. */
export function lighten(hex: string, t: number): number {
  const n = hexToNumber(hex);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number): number => Math.round(c + (255 - c) * t);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

export function darken(hex: string, t: number): number {
  const n = hexToNumber(hex);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number): number => Math.round(c * (1 - t));
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}
