import type { Rect } from './geometry';
import { inset } from './geometry';

/**
 * Responsive layout for the race screen, calculated from the actual viewport and the number of players.
 * Designed first for 1920x1080 landscape; everything scales from the viewport (never fixed pixels), so
 * 1280x720 and 3840x2160 use the same proportions.
 *
 * Pure functions with no Phaser dependency, so overlap and size guarantees are unit-tested.
 */
export type StageLayout = {
  viewport: { w: number; h: number };
  /** Multiplier relative to the 1920x1080 design (min of width and height ratios). */
  scale: number;
  /** Shared track occupying the top 42-48 percent of the viewport. */
  track: Rect;
  /** One equal, independent panel per player across the lower area. */
  panels: Rect[];
  gap: number;
};

/** Share of the viewport height used by the shared track, by player count (all within 42-48 percent). */
export function trackShare(playerCount: number): number {
  if (playerCount <= 3) return 0.46;
  if (playerCount === 4) return 0.44;
  return 0.42;
}

export function computeStageLayout(
  width: number,
  height: number,
  playerCount: number,
): StageLayout {
  if (playerCount < 1 || playerCount > 5)
    throw new RangeError(`Layout supports 1-5 players, got ${playerCount}`);
  const scale = Math.min(width / 1920, height / 1080);
  const margin = Math.round(12 * scale);
  const gap = Math.round(10 * scale);
  // Round up so the track share never falls below the 42 percent lower bound because of pixel rounding.
  const trackH = Math.ceil(height * trackShare(playerCount));
  const track: Rect = { x: 0, y: 0, w: width, h: trackH };
  const lower: Rect = {
    x: margin,
    y: trackH + margin,
    w: width - 2 * margin,
    h: height - trackH - 2 * margin,
  };
  const panelW = (lower.w - gap * (playerCount - 1)) / playerCount;
  const panels: Rect[] = Array.from({ length: playerCount }, (_, i) => ({
    x: lower.x + i * (panelW + gap),
    y: lower.y,
    w: panelW,
    h: lower.h,
  }));
  return { viewport: { w: width, h: height }, scale, track, panels, gap };
}

/** Sub-areas inside one player panel. */
export type PanelZones = {
  header: Rect;
  /** Question text, expression and picture. */
  prompt: Rect;
  /** Where the pupil's response is shown (typed number, running total, chosen tiles). */
  answer: Rect;
  /** Interactive controls of the widget. */
  widget: Rect;
  /** Private, gentle feedback and hints. */
  feedback: Rect;
  /** Progress pips. */
  progress: Rect;
};

/**
 * Split a panel into zones. A question with a picture gets a taller prompt zone; widgets that show their
 * own response inside their controls (choice tiles, tap pictures) do not need a separate answer field.
 */
export function computePanelZones(
  panel: Rect,
  opts: { hasVisual: boolean; showAnswerField: boolean },
): PanelZones {
  const pad = Math.max(6, panel.w * 0.03);
  const inner = inset(panel, pad, pad);
  const headerH = Math.min(inner.h * 0.1, 74);
  const progressH = Math.max(10, inner.h * 0.028);
  const feedbackH = Math.max(28, inner.h * 0.075);
  const answerH = opts.showAnswerField ? Math.max(38, inner.h * 0.095) : 0;
  // A picture needs room to be legible. Tile widgets have no separate answer field, so they can spare more.
  const promptShare = opts.hasVisual ? (opts.showAnswerField ? 0.32 : 0.42) : 0.2;
  const promptH = inner.h * promptShare;
  const gap = Math.max(4, inner.h * 0.012);

  let y = inner.y;
  const header: Rect = { x: inner.x, y, w: inner.w, h: headerH };
  y += headerH + gap;
  const prompt: Rect = { x: inner.x, y, w: inner.w, h: promptH };
  y += promptH + gap;
  const answer: Rect = { x: inner.x, y, w: inner.w, h: answerH };
  y += answerH + (answerH > 0 ? gap : 0);
  const bottomReserve = feedbackH + progressH + gap * 2;
  const widget: Rect = {
    x: inner.x,
    y,
    w: inner.w,
    h: Math.max(0, inner.y + inner.h - y - bottomReserve),
  };
  const feedback: Rect = { x: inner.x, y: widget.y + widget.h + gap, w: inner.w, h: feedbackH };
  const progress: Rect = { x: inner.x, y: feedback.y + feedbackH + gap, w: inner.w, h: progressH };
  return { header, prompt, answer, widget, feedback, progress };
}
