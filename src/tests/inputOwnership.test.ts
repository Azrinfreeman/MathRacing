import { describe, expect, it } from 'vitest';
import { InputOwnership } from '../game/core/InputOwnership';

describe('InputOwnership', () => {
  it('binds a pointer to the panel under its initial contact', () => {
    const own = new InputOwnership();
    expect(own.down(1, 'p1')).toEqual({ bound: true });
    expect(own.ownerOf(1)).toBe('p1');
    expect(own.size).toBe(1);
  });

  it('isolates panels: two simultaneous pointers each belong only to their own panel', () => {
    const own = new InputOwnership();
    own.down(1, 'p1');
    own.down(2, 'p2');
    expect(own.route(1, 'p1')).toEqual({ owner: 'p1', inside: true });
    expect(own.route(2, 'p2')).toEqual({ owner: 'p2', inside: true });
    expect(own.pointersOf('p1')).toEqual([1]);
    expect(own.pointersOf('p2')).toEqual([2]);
  });

  it('supports five simultaneous touches with ten pointer slots reserved', () => {
    const own = new InputOwnership();
    const panels = ['p1', 'p2', 'p3', 'p4', 'p5'];
    panels.forEach((panel, i) => own.down(i + 1, panel));
    // extra accidental contacts (palms, sleeves) land outside all panels or on another pointer slot
    own.down(6, null);
    own.down(7, 'p3');
    expect(own.size).toBe(6);
    panels.forEach((panel, i) => expect(own.ownerOf(i + 1)).toBe(panel));
    expect(own.ownerOf(6)).toBeUndefined();
  });

  it('rejects slide-in: a pointer that starts outside every panel never gets an owner', () => {
    const own = new InputOwnership();
    expect(own.down(3, null)).toEqual({ bound: false });
    // it then moves into panel p2 and is released there
    expect(own.route(3, 'p2')).toBeNull();
    expect(own.up(3, 'p2')).toBeNull();
  });

  it('a pointer that starts in one panel and ends in another still belongs to the first (not inside)', () => {
    const own = new InputOwnership();
    own.down(1, 'p1');
    expect(own.route(1, 'p2')).toEqual({ owner: 'p1', inside: false });
    expect(own.up(1, 'p2')).toEqual({ owner: 'p1', inside: false });
  });

  it('a pointer released outside every panel is not inside', () => {
    const own = new InputOwnership();
    own.down(1, 'p1');
    expect(own.up(1, null)).toEqual({ owner: 'p1', inside: false });
  });

  it('releases ownership on up so the pointer id can be reused by another panel', () => {
    const own = new InputOwnership();
    own.down(1, 'p1');
    expect(own.up(1, 'p1')).toEqual({ owner: 'p1', inside: true });
    expect(own.ownerOf(1)).toBeUndefined();
    own.down(1, 'p4');
    expect(own.ownerOf(1)).toBe('p4');
  });

  it('cancel releases without a position and reports the previous owner', () => {
    const own = new InputOwnership();
    own.down(4, 'p5');
    expect(own.cancel(4)).toBe('p5');
    expect(own.cancel(4)).toBeUndefined();
    expect(own.up(4, 'p5')).toBeNull();
  });

  it('releaseAll clears every pointer (pause, visibility change, race finish)', () => {
    const own = new InputOwnership();
    own.down(1, 'p1');
    own.down(2, 'p2');
    own.down(3, 'p3');
    const released = own.releaseAll();
    expect(released).toHaveLength(3);
    expect(own.size).toBe(0);
    expect(own.up(1, 'p1')).toBeNull();
  });

  it('replaces a stale binding when a pointer-up was missed', () => {
    const own = new InputOwnership();
    own.down(2, 'p1');
    expect(own.down(2, 'p3')).toEqual({ bound: true, replacedOwner: 'p1' });
    expect(own.ownerOf(2)).toBe('p3');
    expect(own.down(2, null)).toEqual({ bound: false, replacedOwner: 'p3' });
    expect(own.ownerOf(2)).toBeUndefined();
  });

  it('snapshot lists current bindings for the developer diagnostic', () => {
    const own = new InputOwnership();
    own.down(1, 'p1');
    own.down(2, 'p2');
    expect(own.snapshot()).toEqual([
      { pointerId: 1, owner: 'p1' },
      { pointerId: 2, owner: 'p2' },
    ]);
  });
});
