import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, PLAYER_STYLES } from '../game/core/players';
import {
  RACERS,
  defaultRacerForSlot,
  defaultRacers,
  isRacerId,
  resolveRacers,
  takenRacers,
} from '../game/core/racers';
import type { RacerId } from '../game/core/racers';
import {
  ANIMAL_COLORS,
  STILL_POSE,
  gaitPhase,
  partsBounds,
  racerParts,
} from '../game/ui/racerShapes';
import type { Pose, RacerPart } from '../game/ui/racerShapes';
import { CAR_NOSE, CAR_TAIL } from '../game/ui/trackGeometry';

const POSES: Pose[] = [
  STILL_POSE,
  ...(['stopped', 'cruise', 'boost', 'slow', 'crawl'] as const).flatMap((speedState) =>
    [0, 0.7, 1.9, 3.3, 5.1].map((gait) => ({
      direction: 'forward' as const,
      speedState,
      speed: speedState === 'boost' ? 3 : 0.2,
      lean: 0,
      wheelAngle: gait,
      gait,
      clock: gait * 400,
    })),
  ),
];

describe('racer catalogue', () => {
  it('has ten unique ids with names in both languages', () => {
    expect(new Set(RACERS.map((r) => r.id)).size).toBe(10);
    expect(RACERS.filter((r) => r.kind === 'animal').map((r) => r.id)).toEqual([
      'duck',
      'goose',
      'chicken',
      'turtle',
      'rabbit',
    ]);
    for (const r of RACERS) {
      expect(r.name.bm.length).toBeGreaterThan(0);
      expect(r.name.en.length).toBeGreaterThan(0);
    }
    expect(isRacerId('duck')).toBe(true);
    expect(isRacerId('dragon')).toBe(false);
    expect(isRacerId(3)).toBe(false);
  });

  it('defaults to the fixed vehicle of each slot, all different', () => {
    expect(defaultRacers()).toEqual(['rocket', 'kart', 'wedge', 'saucer', 'block']);
    expect(defaultRacerForSlot(2)).toBe('wedge');
  });

  it('lists the racers of the other active players as taken', () => {
    const racers: RacerId[] = ['duck', 'goose', 'rocket', 'turtle', 'rabbit'];
    expect([...takenRacers(racers, 3, 0)].sort()).toEqual(['goose', 'rocket']);
    expect(takenRacers(racers, 2, 1).has('turtle')).toBe(false);
  });

  it('resolves saved racers: unknown -> default, clashes among active slots -> default or first free', () => {
    expect(resolveRacers(null)).toEqual(defaultRacers());
    expect(resolveRacers(['duck', 'x', 7])).toEqual(['duck', 'kart', 'wedge', 'saucer', 'block']);
    // slot 1 clashes with slot 0 -> its default (kart)
    expect(resolveRacers(['duck', 'duck', 'wedge', 'saucer', 'block'])).toEqual([
      'duck',
      'kart',
      'wedge',
      'saucer',
      'block',
    ]);
    // slot 1 clashes and its default is taken too -> first free racer
    expect(resolveRacers(['kart', 'kart', 'rocket', 'saucer', 'block'])).toEqual([
      'kart',
      'wedge',
      'rocket',
      'saucer',
      'block',
    ]);
    // inactive slots may keep a clash; it is resolved when they become active
    expect(resolveRacers(['duck', 'goose', 'duck'], 2)[2]).toBe('duck');
    expect(new Set(resolveRacers(['duck', 'goose', 'duck'], 3).slice(0, 3)).size).toBe(3);
    expect(resolveRacers(['duck'], 2)).toHaveLength(MAX_PLAYERS);
  });
});

describe('racer shapes', () => {
  const style = PLAYER_STYLES[1] ?? PLAYER_STYLES[0];
  if (!style) throw new Error('no style');

  it('keeps every racer inside the track reach, with the nose in front', () => {
    for (const r of RACERS) {
      for (const pose of POSES) {
        const b = partsBounds(racerParts(r.id, style, pose));
        // racer units are half the size; the track reach is a share of the size
        expect(b.minX, `${r.id} tail`).toBeGreaterThanOrEqual(-CAR_TAIL * 2 - 1e-9);
        expect(b.maxX, `${r.id} nose`).toBeLessThanOrEqual(CAR_NOSE * 2 + 1e-9);
        expect(b.maxX, `${r.id} nose`).toBeGreaterThanOrEqual(0.9);
        expect(b.minY, `${r.id} top`).toBeGreaterThanOrEqual(-1.25);
        expect(b.maxY, `${r.id} bottom`).toBeLessThanOrEqual(0.95);
      }
    }
  });

  it('shows the player identity on every racer in every pose', () => {
    for (const r of RACERS) {
      for (const pose of POSES) {
        const parts = racerParts(r.id, style, pose);
        expect(parts.filter((p) => p.kind === 'badge')).toHaveLength(1);
        if (r.kind === 'animal') {
          const fills = parts.flatMap((p: RacerPart) => ('fill' in p ? [p.fill] : []));
          expect(fills, r.id).toContain(style.color);
        }
      }
    }
  });

  it('draws animals in natural colours that do not change with the player', () => {
    const other = PLAYER_STYLES[3] ?? style;
    const fills = (s: typeof style): string[] =>
      racerParts('duck', s, STILL_POSE).flatMap((p) =>
        'fill' in p && p.fill !== s.color ? [p.fill] : [],
      );
    expect(fills(style)).toEqual(fills(other));
    expect(fills(style)).toContain(ANIMAL_COLORS.duck.body);
  });

  it('flaps and steps only while moving, and the rocket flame only drives forward', () => {
    const still = racerParts('duck', style, STILL_POSE);
    const walking = racerParts('duck', style, POSES[12] as Pose);
    expect(walking).not.toEqual(still);
    const flame = (pose: Pose): boolean =>
      racerParts('rocket', style, pose).some((p) => p.kind === 'poly' && p.fx === true);
    expect(flame(STILL_POSE)).toBe(false);
    expect(flame(POSES[12] as Pose)).toBe(true);
  });

  it('gait phase follows the distance travelled, not the frame rate', () => {
    expect(gaitPhase(0, 80)).toBe(0);
    // one stride is a quarter of the racer size
    expect(gaitPhase(20, 80)).toBeCloseTo(Math.PI * 2);
    // linear in distance: many small frames add up to one big frame
    const frames = [5, 5, 10, 10].reduce((acc, px) => acc + gaitPhase(px, 80), 0);
    expect(frames).toBeCloseTo(gaitPhase(30, 80));
    expect(gaitPhase(10, 0)).toBe(0);
  });
});
