import { describe, expect, it } from 'vitest';
import type { SessionPhase } from '../game/core/RaceState';
import { IllegalTransitionError, SessionStateMachine } from '../game/core/RaceState';

describe('SessionStateMachine', () => {
  it('starts in SETUP and walks the happy path', () => {
    const m = new SessionStateMachine();
    expect(m.phase).toBe('SETUP');
    for (const next of [
      'READY',
      'RACING',
      'PAUSED',
      'RACING',
      'FINISHED',
      'RESULTS',
    ] as SessionPhase[]) {
      m.transition(next);
      expect(m.phase).toBe(next);
    }
  });

  it('supports Main Lagi (RESULTS -> READY) and New Setup (RESULTS -> SETUP)', () => {
    const again = new SessionStateMachine('RESULTS');
    again.transition('READY');
    expect(again.phase).toBe('READY');
    const setup = new SessionStateMachine('RESULTS');
    setup.transition('SETUP');
    expect(setup.phase).toBe('SETUP');
  });

  it('rejects every illegal transition', () => {
    const illegal: Array<[SessionPhase, SessionPhase]> = [
      ['SETUP', 'RACING'],
      ['SETUP', 'RESULTS'],
      ['READY', 'FINISHED'],
      ['RACING', 'RESULTS'],
      ['RACING', 'SETUP'],
      ['FINISHED', 'RACING'],
      ['FINISHED', 'SETUP'],
      ['RESULTS', 'RACING'],
      ['PAUSED', 'RESULTS'],
    ];
    for (const [from, to] of illegal) {
      const m = new SessionStateMachine(from);
      expect(m.can(to)).toBe(false);
      expect(() => m.transition(to)).toThrow(IllegalTransitionError);
      expect(m.phase).toBe(from);
    }
  });

  it('notifies listeners and lets them unsubscribe', () => {
    const m = new SessionStateMachine();
    const seen: string[] = [];
    const off = m.onChange((to, from) => seen.push(`${from}>${to}`));
    m.transition('READY');
    off();
    m.transition('RACING');
    expect(seen).toEqual(['SETUP>READY']);
  });
});
