import { beforeEach, describe, expect, it } from 'vitest';
import { InputOwnership } from '../game/core/InputOwnership';
import type { PointerEventSource, PointerLike, RouterHandlers } from '../game/PointerRouter';
import { PointerRouter } from '../game/PointerRouter';
import type { Rect } from '../game/ui/geometry';
import { contains } from '../game/ui/geometry';
import { computeStageLayout } from '../game/ui/layout';

class FakeSource implements PointerEventSource {
  private readonly listeners = new Map<string, Set<(p: PointerLike) => void>>();
  on(event: string, listener: (p: PointerLike) => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(listener);
    return this;
  }
  off(event: string, listener: (p: PointerLike) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  emit(event: string, pointer: PointerLike): void {
    for (const l of [...(this.listeners.get(event) ?? [])]) l(pointer);
  }
  count(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

const layout = computeStageLayout(1920, 1080, 5);
const panelIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
const centre = (i: number): { x: number; y: number } => {
  const r = layout.panels[i] as Rect;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};
const inTrack = { x: 900, y: 100 };

let source: FakeSource;
let ownership: InputOwnership;
let router: PointerRouter;
let log: string[];

beforeEach(() => {
  source = new FakeSource();
  ownership = new InputOwnership();
  log = [];
  const handlers: RouterHandlers = {
    hitPanel: (x, y) => {
      const i = layout.panels.findIndex((p) => contains(p, x, y));
      return i >= 0 ? (panelIds[i] as string) : null;
    },
    press: (panel, pointer) => log.push(`press:${panel}:${pointer.id}`),
    release: (panel, pointer, inside) =>
      log.push(`release:${panel}:${pointer.id}:${inside ? 'in' : 'out'}`),
    cancel: (panel, pointerId) => log.push(`cancel:${panel}:${pointerId}`),
  };
  router = new PointerRouter(source, ownership, handlers);
  router.attach();
});

const ptr = (id: number, at: { x: number; y: number }): PointerLike => ({ id, x: at.x, y: at.y });

describe('PointerRouter', () => {
  it('routes five simultaneous touches, each to its own panel only', () => {
    for (let i = 0; i < 5; i++) source.emit('pointerdown', ptr(i + 1, centre(i)));
    expect(log).toEqual(['press:p1:1', 'press:p2:2', 'press:p3:3', 'press:p4:4', 'press:p5:5']);
    log.length = 0;
    // lift in a different order than they were pressed
    for (const i of [4, 0, 2, 1, 3]) source.emit('pointerup', ptr(i + 1, centre(i)));
    expect(log).toEqual([
      'release:p5:5:in',
      'release:p1:1:in',
      'release:p3:3:in',
      'release:p2:2:in',
      'release:p4:4:in',
    ]);
    expect(ownership.size).toBe(0);
  });

  it('a touch that begins outside every panel never acts on a panel, even if released inside one', () => {
    source.emit('pointerdown', ptr(1, inTrack));
    source.emit('pointerup', ptr(1, centre(1)));
    expect(log).toEqual([]);
  });

  it('a touch that begins in one panel and ends in another is reported as slid out of its owner', () => {
    source.emit('pointerdown', ptr(1, centre(0)));
    source.emit('pointerup', ptr(1, centre(1)));
    expect(log).toEqual(['press:p1:1', 'release:p1:1:out']);
    expect(log.some((l) => l.includes('p2'))).toBe(false); // p2 never hears about it
  });

  it('a release outside the canvas counts as released outside the owner panel', () => {
    source.emit('pointerdown', ptr(1, centre(2)));
    source.emit('pointerupoutside', ptr(1, { x: -50, y: 2000 }));
    expect(log).toEqual(['press:p3:1', 'release:p3:1:out']);
    expect(ownership.size).toBe(0);
  });

  it('cancelPointer releases one pointer and later events for it are ignored', () => {
    source.emit('pointerdown', ptr(1, centre(0)));
    source.emit('pointerdown', ptr(2, centre(1)));
    router.cancelPointer(1);
    source.emit('pointerup', ptr(1, centre(0)));
    source.emit('pointerup', ptr(2, centre(1)));
    expect(log).toEqual(['press:p1:1', 'press:p2:2', 'cancel:p1:1', 'release:p2:2:in']);
  });

  it('releaseAll (pause, visibility change, race finish) cancels every owned pointer', () => {
    for (let i = 0; i < 3; i++) source.emit('pointerdown', ptr(i + 1, centre(i)));
    log.length = 0;
    router.releaseAll();
    expect(log.sort()).toEqual(['cancel:p1:1', 'cancel:p2:2', 'cancel:p3:3']);
    expect(ownership.size).toBe(0);
    source.emit('pointerup', ptr(1, centre(0)));
    expect(log).toHaveLength(3); // nothing further
  });

  it('cancels a stale press when a pointer id is reused after a missed pointer-up', () => {
    source.emit('pointerdown', ptr(1, centre(0)));
    source.emit('pointerdown', ptr(1, centre(3))); // the up for the first touch was never delivered
    expect(log).toEqual(['press:p1:1', 'cancel:p1:1', 'press:p4:1']);
    expect(ownership.ownerOf(1)).toBe('p4');
  });

  it('reconcile releases pointers the platform reports as no longer down', () => {
    source.emit('pointerdown', ptr(1, centre(0)));
    source.emit('pointerdown', ptr(2, centre(1)));
    log.length = 0;
    router.reconcile((id) => id === 2);
    expect(log).toEqual(['cancel:p1:1']);
    expect(ownership.ownerOf(2)).toBe('p2');
  });

  it('detach stops listening and attach is idempotent', () => {
    router.attach();
    expect(source.count('pointerdown')).toBe(1);
    router.detach();
    expect(source.count('pointerdown')).toBe(0);
    source.emit('pointerdown', ptr(1, centre(0)));
    expect(log).toEqual([]);
  });

  it('a second pointer held in another panel does not disturb the first pointer’s ownership', () => {
    source.emit('pointerdown', ptr(1, centre(0)));
    source.emit('pointerdown', ptr(2, centre(1)));
    source.emit('pointerup', ptr(2, centre(1)));
    expect(ownership.ownerOf(1)).toBe('p1');
    source.emit('pointerup', ptr(1, centre(0)));
    expect(log.at(-1)).toBe('release:p1:1:in');
  });
});
