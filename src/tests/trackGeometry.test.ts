import { describe, expect, it } from 'vitest';
import { computeStageLayout } from '../game/ui/layout';
import { CAR_NOSE, CAR_TAIL, computeTrackGeometry } from '../game/ui/trackGeometry';

// Android tablets, TV smartboards (CSS pixels) and desktop windows.
const SCREENS: Array<[number, number]> = [
  [1024, 600],
  [1280, 800],
  [1920, 1200],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
];
const PLAYERS = [2, 3, 4, 5];
const LENGTHS = [5, 8, 10, 12];

const cases = SCREENS.flatMap(([w, h]) =>
  PLAYERS.flatMap((players) => LENGTHS.map((length) => ({ w, h, players, length }))),
);

describe('track geometry', () => {
  it.each(cases)('$w x $h, $players players, $length steps', ({ w, h, players, length }) => {
    const track = computeStageLayout(w, h, players).track;
    const g = computeTrackGeometry(track, players, length);

    // the marks are exactly where the nose lands, evenly spaced
    expect(g.markXs).toHaveLength(length - 1);
    g.markXs.forEach((x, i) => expect(x).toBeCloseTo(g.noseAt(i + 1), 6));
    expect(g.noseAt(0)).toBeCloseTo(g.startLineX, 6);
    expect(g.noseAt(length)).toBeCloseTo(g.finishLineX, 6);
    const xs = [g.startLineX, ...g.markXs, g.finishLineX];
    for (let i = 1; i < xs.length; i++)
      expect((xs[i] as number) - (xs[i - 1] as number)).toBeCloseTo(g.stepPx, 6);

    // at the start the whole car sits between the badge and the start line
    const badgeRight = g.badge.cx + g.badge.r;
    expect(g.carXAt(0) - g.carSize * CAR_TAIL).toBeGreaterThan(badgeRight);
    expect(g.carXAt(0) + g.carSize * CAR_NOSE).toBeCloseTo(g.startLineX, 6);
    expect(g.startLineX).toBeGreaterThan(badgeRight);
    expect(g.badge.cx - g.badge.r).toBeGreaterThan(track.x);

    // the chequer and a finished car stay inside the track
    expect(g.finishLineX + g.checkerW).toBeLessThan(track.x + track.w);
    expect(g.carXAt(length) + g.carSize * CAR_NOSE).toBeLessThanOrEqual(g.finishLineX + 1e-6);

    // steps stay readable: at least half a car length apart
    expect(g.stepPx).toBeGreaterThanOrEqual(g.carSize * 0.5);
  });

  it('margins follow the lane height, not the width: doubling the width barely moves the lines', () => {
    const normal = computeTrackGeometry(computeStageLayout(1920, 1080, 2).track, 2, 8);
    const wide = computeTrackGeometry(computeStageLayout(3840, 1080, 2).track, 2, 8);
    expect(wide.startLineX).toBeLessThan(normal.startLineX * 1.2);
    expect(3840 - wide.finishLineX).toBeLessThan((1920 - normal.finishLineX) * 1.5);
  });
});
