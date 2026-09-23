import type { Rect } from './geometry';

/** The vehicle drawings reach this far behind and in front of their centre, as a share of the car size. */
export const CAR_TAIL = 0.5;
export const CAR_NOSE = 0.55;

/**
 * Where everything on the race track sits, from one set of numbers (DECISIONS #34).
 *
 * The car's nose is the reference point: at step 0 it touches the start line, at each step it lands exactly on
 * that step's mark, and at the last step it touches the finish chequer. Margins are built from the lane height
 * (with pixel limits) rather than width percentages, so wide or large screens do not open gaps between the lane
 * badge, the start line and the cars.
 *
 * Pure, with no Phaser dependency, so the alignment guarantees are unit-tested.
 */
export type TrackGeometry = {
  /** Top of the first lane. */
  top: number;
  laneH: number;
  /** Lane badge (colour, symbol): centre x and drawn radius. */
  badge: { cx: number; r: number };
  carSize: number;
  /** The start line: where the nose is at step 0. */
  startLineX: number;
  /** Left edge of the finish chequer: where the nose is at the last step. */
  finishLineX: number;
  checkerW: number;
  /** Pixels per race step. */
  stepPx: number;
  /** Step marks for steps 1..raceLength-1 (the start line and chequer mark 0 and the last step). */
  markXs: number[];
  /** Nose x at `steps` (fractional while moving). */
  noseAt(steps: number): number;
  /** Car centre x at `steps`. */
  carXAt(steps: number): number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function computeTrackGeometry(
  rect: Rect,
  playerCount: number,
  raceLength: number,
): TrackGeometry {
  const lanes = Math.max(1, playerCount);
  const steps = Math.max(1, raceLength);
  // A top band holds the START/FINISH labels and the teacher's toolbar (centred, in the DOM layer).
  const topBand = Math.max(rect.h * 0.085, 34);
  const bottomPad = rect.h * 0.03;
  const top = rect.y + topBand;
  const laneH = (rect.h - topBand - bottomPad) / lanes;
  // Lanes are painted from 1.5 to 98.5 percent of the width.
  const laneLeft = rect.x + rect.w * 0.015;
  const laneRight = rect.x + rect.w * 0.985;

  const pad = clamp(rect.w * 0.01, 8, 24);
  const carSize = Math.min(laneH * 0.78, rect.w * 0.085);
  const badgeR = clamp(Math.min(laneH * 0.3, rect.w * 0.02), 10, 36) * 1.25;
  const badgeCx = laneLeft + pad + badgeR;
  const gap = Math.max(6, carSize * 0.12);
  // badge | gap | the whole car | start line
  const startLineX = badgeCx + badgeR + gap + carSize * (CAR_TAIL + CAR_NOSE);
  const checkerW = clamp(laneH * 0.2, 14, 44);
  const finishLineX = laneRight - pad - checkerW;

  const stepPx = (finishLineX - startLineX) / steps;
  const noseAt = (s: number): number => startLineX + stepPx * s;
  return {
    top,
    laneH,
    badge: { cx: badgeCx, r: badgeR },
    carSize,
    startLineX,
    finishLineX,
    checkerW,
    stepPx,
    markXs: Array.from({ length: steps - 1 }, (_, i) => noseAt(i + 1)),
    noseAt,
    carXAt: (s) => noseAt(s) - carSize * CAR_NOSE,
  };
}
