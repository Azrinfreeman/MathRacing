import { describe, expect, it } from 'vitest';
import { SeededRng, createSessionSeed } from '../game/core/SeededRng';

describe('SeededRng', () => {
  it('reproduces the same sequence for the same seed', () => {
    const a = new SeededRng('classroom-1');
    const b = new SeededRng('classroom-1');
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRng('seed-a');
    const b = new SeededRng('seed-b');
    expect(Array.from({ length: 10 }, () => a.next())).not.toEqual(
      Array.from({ length: 10 }, () => b.next()),
    );
  });

  it('keeps next() strictly inside [0, 1)', () => {
    const rng = new SeededRng('range');
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() is inclusive at both boundaries and never leaves them', () => {
    const rng = new SeededRng('bounds');
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('int() handles a single-value range and rejects invalid ranges', () => {
    const rng = new SeededRng('edge');
    expect(rng.int(4, 4)).toBe(4);
    expect(rng.int(-2, -2)).toBe(-2);
    expect(() => rng.int(5, 4)).toThrow(RangeError);
    expect(() => rng.int(1.5, 3)).toThrow(RangeError);
  });

  it('pick() covers every element and rejects an empty list', () => {
    const rng = new SeededRng('pick');
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(rng.pick(['a', 'b', 'c']));
    expect(seen.size).toBe(3);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('shuffle() returns a permutation without mutating the input', () => {
    const rng = new SeededRng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it('shuffle() is reproducible and roughly uniform on the first position', () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 4_000; i++) {
      const out = new SeededRng(`u${i}`).shuffle([0, 1, 2, 3]);
      counts.set(out[0] as number, (counts.get(out[0] as number) ?? 0) + 1);
    }
    for (const c of counts.values()) expect(c).toBeGreaterThan(800); // expected 1000 each
  });

  it('fork() depends only on (seed, label), not on how much was already drawn', () => {
    const a = new SeededRng('parent');
    const b = new SeededRng('parent');
    for (let i = 0; i < 25; i++) a.next(); // consume a different amount
    expect(a.fork('player-1').next()).toBe(b.fork('player-1').next());
    expect(a.fork('player-1').next()).not.toBe(a.fork('player-2').next());
  });

  it('chance() respects its extremes', () => {
    const rng = new SeededRng('chance');
    for (let i = 0; i < 200; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('createSessionSeed() returns a short non-empty token', () => {
    const s = createSessionSeed();
    expect(s).toMatch(/^[0-9A-Z]{4,8}$/);
  });
});
