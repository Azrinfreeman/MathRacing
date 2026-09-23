import { beforeEach, describe, expect, it } from 'vitest';
import type { QuestionSource } from '../curriculum/blueprint';
import { createQuestionSource } from '../curriculum/blueprint';
import { getDefaultRegistry } from '../curriculum/registry';
import type { GeneratedQuestion, Level, SubmittedAnswer } from '../curriculum/schema';
import { RaceConfigError, RaceEngine } from '../game/core/RaceEngine';
import type { RaceConfig, RaceEvent } from '../game/core/RaceState';
import { DEFAULT_RACE_TIMING, SessionStateMachine } from '../game/core/RaceState';
import { correctSubmission } from './helpers';

/** Deterministic fake: every item's answer is "10"; items at index >= 1 have level 3 so a simpler variant exists. */
function fakeQuestion(
  id: string,
  level: Level,
  withVisual: boolean,
  hint: string | null = 'petunjuk',
): GeneratedQuestion {
  return {
    id,
    packId: 'test-pack',
    packVersion: '1.0.0',
    year: 1,
    topicId: 'test-topic',
    standardKandungan: ['2.1-2.5'],
    standardPembelajaran: [],
    templateId: 'test-template',
    difficultyBand: 'within-20',
    level,
    language: 'bm',
    prompt: { text: 'Jumlah?', expression: '4 + 6 = ?' },
    widget: 'number-pad',
    acceptedAnswer: { kind: 'number', value: '10' },
    ...(hint ? { hint } : {}),
    ...(withVisual
      ? {
          supportVisual: {
            kind: 'objects' as const,
            groups: [{ count: 4, shape: 'circle' as const, color: '#2e86de' }],
          },
        }
      : {}),
    metadata: { params: { a: 4, b: 6 } },
  };
}

function makeSource(opts: { level?: Level; visual?: boolean } = {}): QuestionSource {
  return {
    blueprint: ['test-template'],
    question: (playerId, index) =>
      fakeQuestion(`${playerId}#${index}`, opts.level ?? 3, opts.visual ?? false),
    simpler: (playerId, index, n) =>
      fakeQuestion(`${playerId}#${index}~s${n}`, ((opts.level ?? 3) - 1) as Level, false),
  };
}

const num = (raw: string): SubmittedAnswer => ({ kind: 'number', raw });
const RIGHT = num('10');
const WRONG = num('11');

function config(overrides: Partial<RaceConfig> = {}): RaceConfig {
  return {
    sessionId: 'S1',
    seed: 'SEED1',
    mode: 'quick',
    raceLength: 3,
    players: [
      { id: 'p1', name: 'Aina' },
      { id: 'p2', name: 'Budi' },
      { id: 'p3', name: 'Cika' },
    ],
    language: 'bm',
    hintsEnabled: true,
    supportEnabled: true,
    ...DEFAULT_RACE_TIMING,
    ...overrides,
  };
}

let machine: SessionStateMachine;
function ready(
  cfg = config(),
  source = makeSource(),
  epochOffsetMs = 1_700_000_000_000,
): RaceEngine {
  machine = new SessionStateMachine('READY');
  return new RaceEngine(cfg, source, machine, { epochOffsetMs });
}

/** Answer correctly and let the success animation finish so the next item is dealt. */
function solve(engine: RaceEngine, id: string, atMs: number): number {
  const r = engine.submit(id, RIGHT, atMs);
  expect(r.status).toBe('correct');
  engine.tick(atMs + DEFAULT_RACE_TIMING.successDelayMs);
  return atMs + DEFAULT_RACE_TIMING.successDelayMs;
}

describe('RaceEngine setup and lifecycle', () => {
  it('rejects invalid configuration', () => {
    const m = new SessionStateMachine('READY');
    expect(
      () => new RaceEngine(config({ players: [{ id: 'a', name: 'A' }] }), makeSource(), m),
    ).toThrow(RaceConfigError);
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    expect(() => new RaceEngine(config({ players: six }), makeSource(), m)).toThrow(
      RaceConfigError,
    );
    expect(() => new RaceEngine(config({ raceLength: 0 }), makeSource(), m)).toThrow(
      RaceConfigError,
    );
    expect(
      () =>
        new RaceEngine(
          config({
            players: [
              { id: 'a', name: 'A' },
              { id: 'a', name: 'B' },
            ],
          }),
          makeSource(),
          m,
        ),
    ).toThrow(RaceConfigError);
  });

  it('does not accept answers before the race starts', () => {
    const engine = ready();
    expect(engine.submit('p1', RIGHT, 0)).toEqual({ status: 'rejected', reason: 'not-racing' });
  });

  it('deals every player their own first item on start', () => {
    const engine = ready();
    engine.start(0);
    expect(machine.phase).toBe('RACING');
    expect(engine.players.map((p) => p.question?.id)).toEqual(['p1#0', 'p2#0', 'p3#0']);
  });

  it('rejects unknown players', () => {
    const engine = ready();
    engine.start(0);
    expect(engine.submit('nobody', RIGHT, 1)).toEqual({
      status: 'rejected',
      reason: 'unknown-player',
    });
  });
});

describe('RaceEngine movement rules', () => {
  let engine: RaceEngine;
  beforeEach(() => {
    engine = ready();
    engine.start(0);
  });

  it('a correct answer advances that player exactly one step and nobody else', () => {
    const r = engine.submit('p1', RIGHT, 100);
    expect(r).toMatchObject({
      status: 'correct',
      progress: 1,
      finishedRace: false,
      isWinner: false,
    });
    expect(engine.players.map((p) => p.progress)).toEqual([1, 0, 0]);
  });

  it('an incorrect answer never moves a racer (and never backwards)', () => {
    engine.submit('p1', RIGHT, 100);
    engine.tick(1000);
    const before = engine.player('p1')?.progress;
    const r = engine.submit('p1', WRONG, 1100);
    expect(r).toMatchObject({ status: 'incorrect', attemptNumber: 1 });
    expect(engine.player('p1')?.progress).toBe(before);
    engine.submit('p1', num('0'), 1200);
    expect(engine.player('p1')?.progress).toBe(before);
  });

  it('a fast double tap on submit produces only one move (per-player debounce)', () => {
    expect(engine.submit('p1', RIGHT, 100).status).toBe('correct');
    expect(engine.submit('p1', RIGHT, 101)).toEqual({ status: 'rejected', reason: 'resolving' });
    expect(engine.submit('p1', RIGHT, 300)).toEqual({ status: 'rejected', reason: 'resolving' });
    expect(engine.player('p1')?.progress).toBe(1);
    expect(engine.attempts.filter((a) => a.playerId === 'p1')).toHaveLength(1);
  });

  it('debounce is per player, not global', () => {
    expect(engine.submit('p1', RIGHT, 100).status).toBe('correct');
    expect(engine.submit('p2', RIGHT, 101).status).toBe('correct'); // p2 is not blocked by p1's animation
    expect(engine.players.map((p) => p.progress)).toEqual([1, 1, 0]);
  });

  it('replaces the item only after the success animation resolves', () => {
    engine.submit('p1', RIGHT, 100);
    const first = engine.player('p1')?.question?.id;
    engine.tick(100 + DEFAULT_RACE_TIMING.successDelayMs - 1);
    expect(engine.player('p1')?.question?.id).toBe(first);
    engine.tick(100 + DEFAULT_RACE_TIMING.successDelayMs);
    expect(engine.player('p1')?.question?.id).toBe('p1#1');
    expect(engine.player('p1')?.phase).toBe('answering');
    expect(engine.submit('p1', RIGHT, 900).status).toBe('correct');
  });

  it('keeps every player’s question and attempt state independent', () => {
    engine.submit('p1', WRONG, 100);
    engine.submit('p1', WRONG, 200);
    expect(engine.player('p1')?.attemptsOnItem).toBe(2);
    expect(engine.player('p2')?.attemptsOnItem).toBe(0);
    expect(engine.player('p2')?.hintShown).toBe(false);
    expect(engine.player('p3')?.question?.id).toBe('p3#0');
  });

  it('treats an incomplete submission (empty keypad) as no attempt at all', () => {
    expect(engine.submit('p1', num(''), 100)).toEqual({ status: 'rejected', reason: 'incomplete' });
    expect(engine.player('p1')?.attemptsOnItem).toBe(0);
    expect(engine.attempts).toHaveLength(0);
  });
});

describe('RaceEngine hints and support', () => {
  it('shows a conceptual hint once, after two wrong attempts, independently per player', () => {
    const engine = ready();
    engine.start(0);
    const events: RaceEvent[] = [];
    engine.on((e) => events.push(e));
    expect(engine.submit('p1', WRONG, 10)).toMatchObject({ status: 'incorrect', hint: null });
    expect(engine.submit('p1', WRONG, 20)).toMatchObject({ status: 'incorrect', hint: 'petunjuk' });
    expect(engine.submit('p1', WRONG, 30)).toMatchObject({ status: 'incorrect', hint: null }); // only once
    expect(events.filter((e) => e.type === 'hint')).toHaveLength(1);
    expect(engine.submit('p2', WRONG, 40)).toMatchObject({ status: 'incorrect', hint: null }); // p2 has 1 wrong only
  });

  it('does not show hints when the teacher turned them off', () => {
    const engine = ready(config({ hintsEnabled: false }));
    engine.start(0);
    engine.submit('p1', WRONG, 10);
    expect(engine.submit('p1', WRONG, 20)).toMatchObject({ hint: null });
    expect(engine.player('p1')?.hintShown).toBe(false);
  });

  it('offers a simpler item after three wrong attempts, never before, and never as a penalty', () => {
    const engine = ready();
    engine.start(0);
    expect(engine.submit('p1', WRONG, 10)).toMatchObject({ supportOffered: false });
    expect(engine.submit('p1', WRONG, 20)).toMatchObject({ supportOffered: false });
    expect(engine.requestSimpler('p1', 25)).toBe(false); // not offered yet
    expect(engine.submit('p1', WRONG, 30)).toMatchObject({ supportOffered: true });
    expect(engine.player('p1')?.simplerOffered).toBe(true);
    expect(engine.player('p1')?.progress).toBe(0); // no score change

    expect(engine.requestSimpler('p1', 40)).toBe(true);
    const p1 = engine.player('p1');
    expect(p1?.question?.id).toBe('p1#0~s1');
    expect(p1?.attemptsOnItem).toBe(0);
    expect(p1?.supportUsed).toBe('simpler');
    // the swapped-out item is logged as replaced, not as a wrong answer
    expect(engine.attempts.some((a) => a.playerId === 'p1' && a.outcome === 'replaced')).toBe(true);
    // solving the simpler item counts as an ordinary step
    expect(engine.submit('p1', RIGHT, 50)).toMatchObject({ status: 'correct', progress: 1 });
    const solved = engine.attempts.filter((a) => a.outcome === 'correct' && a.playerId === 'p1');
    expect(solved[0]?.supportUsed).toBe('simpler');
  });

  it('reveals visual support first when a question has one, then offers the simpler item', () => {
    const engine = ready(config(), makeSource({ visual: true }));
    engine.start(0);
    engine.submit('p1', WRONG, 10);
    engine.submit('p1', WRONG, 20);
    expect(engine.submit('p1', WRONG, 30)).toMatchObject({ supportOffered: true });
    expect(engine.player('p1')?.visualRevealed).toBe(true);
    expect(engine.player('p1')?.supportUsed).toBe('visual');
    expect(engine.player('p1')?.simplerOffered).toBe(false);
    engine.submit('p1', WRONG, 40);
    expect(engine.player('p1')?.simplerOffered).toBe(true);
  });

  it('does not offer a simpler item on the lowest level', () => {
    const engine = ready(config(), makeSource({ level: 1 }));
    engine.start(0);
    for (let i = 0; i < 4; i++) engine.submit('p1', WRONG, 10 + i);
    expect(engine.player('p1')?.simplerOffered).toBe(false);
  });

  it('does not offer support when the teacher disabled it', () => {
    const engine = ready(config({ supportEnabled: false }));
    engine.start(0);
    for (let i = 0; i < 5; i++) engine.submit('p1', WRONG, 10 + i);
    expect(engine.player('p1')?.simplerOffered).toBe(false);
    expect(engine.player('p1')?.supportUsed).toBe('none');
  });
});

describe('RaceEngine winner rules', () => {
  it('declares exactly one winner, locks the race, and stores runner-up progress', () => {
    const engine = ready();
    engine.start(0);
    let t = 100;
    t = solve(engine, 'p2', t);
    t = solve(engine, 'p2', t);
    solve(engine, 'p1', 50);
    expect(engine.submit('p2', RIGHT, t + 10)).toMatchObject({
      status: 'correct',
      finishedRace: true,
      isWinner: true,
    });
    expect(machine.phase).toBe('FINISHED');
    expect(engine.winnerId).toBe('p2');

    // frozen: nobody can submit any more
    expect(engine.submit('p1', RIGHT, t + 20)).toEqual({
      status: 'rejected',
      reason: 'race-finished',
    });
    expect(engine.submit('p3', RIGHT, t + 21)).toEqual({
      status: 'rejected',
      reason: 'race-finished',
    });

    const result = engine.result();
    expect(result.winnerId).toBe('p2');
    expect(result.standings[0]).toMatchObject({ playerId: 'p2', progress: 3, place: 1 });
    expect(result.standings.find((s) => s.playerId === 'p1')?.progress).toBe(1); // runner-up progress kept
    expect(result.standings.filter((s) => s.finishedAtMs !== null)).toHaveLength(1);
  });

  it('lets a finishing answer with an EARLIER timestamp win over one that merely arrived first', () => {
    const engine = ready(config({ raceLength: 1 }));
    engine.start(0);
    const events: RaceEvent[] = [];
    engine.on((e) => events.push(e));
    // p1's event is processed first (timestamp 1000) ...
    expect(engine.submit('p1', RIGHT, 1000)).toMatchObject({ isWinner: true });
    expect(engine.winnerId).toBe('p1');
    // ... but p2's answer was actually given at 990 and was only delivered later
    expect(engine.submit('p2', RIGHT, 990)).toMatchObject({ status: 'correct', isWinner: true });
    expect(engine.winnerId).toBe('p2');
    expect(events.filter((e) => e.type === 'winner')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'winner' && e.revised)).toHaveLength(1);
    // still exactly one winner in the results, with p1 as runner-up
    const standings = engine.result().standings;
    expect(standings.map((s) => s.playerId).slice(0, 2)).toEqual(['p2', 'p1']);
    expect(engine.result().winnerId).toBe('p2');
    // a third finisher whose answer came AFTER the (revised) winner's 990 is rejected
    expect(engine.submit('p3', RIGHT, 995)).toEqual({
      status: 'rejected',
      reason: 'race-finished',
    });
    expect(engine.winnerId).toBe('p2');
  });

  it('rejects a finishing answer whose timestamp is later than the winner’s', () => {
    const engine = ready(config({ raceLength: 1 }));
    engine.start(0);
    expect(engine.submit('p1', RIGHT, 1000).status).toBe('correct');
    expect(engine.submit('p2', RIGHT, 1001)).toEqual({
      status: 'rejected',
      reason: 'race-finished',
    });
    expect(engine.submit('p2', RIGHT, 1000)).toEqual({
      status: 'rejected',
      reason: 'race-finished',
    }); // exact tie: first wins
    expect(engine.winnerId).toBe('p1');
    expect(engine.player('p2')?.progress).toBe(0);
  });

  it('a late non-finishing answer cannot change anything after the race ended', () => {
    const engine = ready(config({ raceLength: 2 }));
    engine.start(0);
    const t = solve(engine, 'p1', 100);
    expect(engine.submit('p1', RIGHT, t + 5).status).toBe('correct'); // p1 wins
    // p2's answer would only be their first step (not a finishing answer), so it cannot change anything
    expect(engine.submit('p2', RIGHT, t)).toEqual({ status: 'rejected', reason: 'race-finished' });
    expect(engine.player('p2')?.progress).toBe(0);
  });

  it('ends the race the moment the winner is declared (no second phase change)', () => {
    const engine = ready(config({ raceLength: 1 }));
    engine.start(0);
    const finished: RaceEvent[] = [];
    engine.on((e) => e.type === 'finished' && finished.push(e));
    engine.submit('p1', RIGHT, 10);
    engine.submit('p2', RIGHT, 11);
    expect(finished).toHaveLength(1);
  });
});

describe('RaceEngine practice mode', () => {
  it('has no winner and finishes when every player completes their items', () => {
    const engine = ready(config({ mode: 'practice', raceLength: 2 }));
    engine.start(0);
    let t = 100;
    for (const id of ['p1', 'p2', 'p3']) {
      t = solve(engine, id, t);
      const last = engine.submit(id, RIGHT, t + 1);
      expect(last).toMatchObject({ status: 'correct', isWinner: false });
      expect(engine.player(id)?.phase).toBe('done');
    }
    expect(machine.phase).toBe('FINISHED');
    const result = engine.result();
    expect(result.winnerId).toBeNull();
    expect(result.standings.every((s) => s.progress === 2)).toBe(true);
  });

  it('lets finished players stay done while the others continue', () => {
    const engine = ready(config({ mode: 'practice', raceLength: 1 }));
    engine.start(0);
    engine.submit('p1', RIGHT, 10);
    expect(machine.phase).toBe('RACING');
    expect(engine.submit('p1', RIGHT, 20)).toEqual({ status: 'rejected', reason: 'done' });
  });
});

describe('RaceEngine pause, resume and early end', () => {
  it('rejects answers while paused and does not count paused time as thinking time', () => {
    const engine = ready();
    engine.start(1000);
    engine.pause(2000);
    expect(machine.phase).toBe('PAUSED');
    expect(engine.submit('p1', RIGHT, 2500)).toEqual({ status: 'rejected', reason: 'not-racing' });
    engine.resume(12_000); // ten seconds of pause
    engine.submit('p1', WRONG, 13_000);
    const record = engine.attempts[0];
    expect(record?.elapsedMs).toBe(2000); // 1000 -> 13000 minus the 10 s pause
  });

  it('shifts a pending success animation by the paused time', () => {
    const engine = ready();
    engine.start(0);
    engine.submit('p1', RIGHT, 100); // resolves at 800
    engine.pause(300);
    engine.resume(5300); // +5000
    engine.tick(5500);
    expect(engine.player('p1')?.phase).toBe('resolving'); // would be 5800 now
    engine.tick(5800);
    expect(engine.player('p1')?.phase).toBe('answering');
  });

  it('ignores ticks while paused', () => {
    const engine = ready();
    engine.start(0);
    engine.submit('p1', RIGHT, 100);
    engine.pause(200);
    engine.tick(100_000);
    expect(engine.player('p1')?.phase).toBe('resolving');
  });

  it('ending early declares no winner and records open items as unsolved', () => {
    const engine = ready();
    engine.start(0);
    engine.submit('p1', WRONG, 100);
    engine.submit('p2', RIGHT, 100);
    engine.endRace(500);
    expect(machine.phase).toBe('FINISHED');
    const result = engine.result();
    expect(result.winnerId).toBeNull();
    expect(result.endedEarly).toBe(true);
    const unsolved = engine.attempts.filter((a) => a.outcome === 'unsolved');
    expect(unsolved.map((a) => a.playerId)).toEqual(['p1']);
  });

  it('can end from the paused state', () => {
    const engine = ready();
    engine.start(0);
    engine.pause(50);
    engine.endRace(60);
    expect(machine.phase).toBe('FINISHED');
  });
});

describe('RaceEngine evidence log', () => {
  it('records the fields PBD evidence needs, per attempt and per player', () => {
    const engine = ready(config(), makeSource(), 1_700_000_000_000);
    engine.start(1000);
    engine.noteAction('p1', 1400);
    engine.submit('p1', WRONG, 2000);
    engine.submit('p1', WRONG, 3000);
    engine.submit('p1', RIGHT, 4000);
    engine.submit('p2', RIGHT, 2500);

    const p1 = engine.attempts.filter((a) => a.playerId === 'p1');
    expect(p1.map((a) => a.attemptNumber)).toEqual([1, 2, 3]);
    expect(p1.map((a) => a.outcome)).toEqual(['incorrect', 'incorrect', 'correct']);
    expect(p1.map((a) => a.hintUsed)).toEqual([false, false, true]); // hint appeared after attempt 2
    expect(p1[0]).toMatchObject({
      sessionId: 'S1',
      seed: 'SEED1',
      playerName: 'Aina',
      elapsedMs: 1000,
      firstActionMs: 400,
      packId: 'test-pack',
      packVersion: '1.0.0',
      year: 1,
      topicId: 'test-topic',
      standardKandungan: '2.1-2.5',
      templateId: 'test-template',
      difficultyBand: 'within-20',
      questionId: 'p1#0',
      submittedAnswer: '11',
      normalizedAnswer: '11',
      correct: false,
      timestampMs: 1_700_000_002_000,
    });
    expect(JSON.parse(p1[0]?.parameters ?? '{}')).toEqual({ params: { a: 4, b: 6 } });
    // p2's attempt numbering is independent
    expect(engine.attempts.filter((a) => a.playerId === 'p2')[0]?.attemptNumber).toBe(1);
    // record ids are unique
    expect(new Set(engine.attempts.map((a) => a.recordId)).size).toBe(engine.attempts.length);
  });

  it('does not record a name other than the one chosen for the session', () => {
    const engine = ready();
    engine.start(0);
    engine.submit('p3', WRONG, 5);
    expect(Object.keys(engine.attempts[0] ?? {})).not.toContain('surname');
    expect(engine.attempts[0]?.playerName).toBe('Cika');
  });
});

describe('RaceEngine with the real question blueprint', () => {
  it('runs a full deterministic race to a single winner', () => {
    const registry = getDefaultRegistry();
    const pack = registry.packForYear(1);
    const cfg = {
      seed: 'REAL',
      packId: pack.packId,
      topicIds: ['y1-operations'],
      level: 2 as Level,
      raceLength: 4,
      language: 'bm' as const,
    };

    const run = (): { winner: string | null; answers: string[] } => {
      const source = createQuestionSource(registry, cfg);
      const m = new SessionStateMachine('READY');
      const engine = new RaceEngine(
        config({
          raceLength: 4,
          players: [
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
          ],
        }),
        source,
        m,
      );
      engine.start(0);
      const answers: string[] = [];
      let t = 0;
      // player "a" always answers correctly and a little faster than "b"; bounded so a bug cannot hang the suite
      for (let round = 0; round < 50 && m.phase === 'RACING'; round++) {
        for (const id of ['a', 'b']) {
          if (m.phase !== 'RACING') break; // the winner ended the race; the loser's late answer is (correctly) frozen out
          const q = engine.player(id)?.question;
          if (q && engine.player(id)?.phase === 'answering') {
            t += id === 'a' ? 10 : 15;
            const result = engine.submit(id, correctSubmission(q), t);
            expect(result.status, `${id} round ${round}`).toBe('correct');
            answers.push(`${id}:${JSON.stringify(q.acceptedAnswer)}`);
          }
        }
        t += 800;
        engine.tick(t);
      }
      expect(m.phase).toBe('FINISHED');
      return { winner: engine.winnerId, answers };
    };

    const first = run();
    const second = run();
    expect(first.winner).toBe('a');
    expect(second).toEqual(first); // same seed -> same content and same result
  });
});
