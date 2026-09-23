import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import type { AttemptRecord, SessionMeta } from '../game/core/RaceState';
import { BOM, CSV_COLUMNS, attemptsToCsv, csvFileName, escapeCell } from '../reporting/exportCsv';

const BOM_RE = new RegExp(`^${BOM}`);
import {
  IndexedDbSessionRepository,
  createRepository,
} from '../storage/IndexedDbSessionRepository';
import { InMemorySessionRepository } from '../storage/SessionRepository';
import type { SessionRepository } from '../storage/SessionRepository';
import { DEFAULT_SETTINGS, SettingsStore, sanitizeSettings } from '../storage/settings';
import type { KeyValueStore } from '../storage/settings';

function meta(id: string, startedAtMs = 1_700_000_000_000): SessionMeta {
  return {
    sessionId: id,
    seed: 'SEED',
    startedAtMs,
    mode: 'quick',
    year: 1,
    packId: 'kpm-ms-y1',
    packVersion: '1.0.0',
    topicIds: ['y1-operations'],
    level: 1,
    raceLength: 8,
    language: 'bm',
    playerNames: ['Aina', 'Budi'],
    winnerName: null,
    finishedAtMs: null,
    setbackEnabled: true,
  };
}

function record(
  sessionId: string,
  n: number,
  overrides: Partial<AttemptRecord> = {},
): AttemptRecord {
  return {
    recordId: `${sessionId}-${n}`,
    sessionId,
    seed: 'SEED',
    playerId: 'p1',
    playerName: 'Aina',
    timestampMs: 1_700_000_000_000 + n * 1000,
    elapsedMs: 1500,
    firstActionMs: 300,
    packId: 'kpm-ms-y1',
    packVersion: '1.0.0',
    year: 1,
    topicId: 'y1-operations',
    standardKandungan: '2.1-2.5',
    standardPembelajaran: '',
    templateId: 'y1-op-add',
    difficultyBand: 'within-10',
    level: 1,
    questionId: `q${n}`,
    parameters: '{"params":{"a":3,"b":4}}',
    itemIndex: n,
    attemptNumber: 1,
    submittedAnswer: '7',
    normalizedAnswer: '7',
    correct: true,
    hintUsed: false,
    supportUsed: 'none',
    outcome: 'correct',
    stepDelta: 1,
    progressAfter: n,
    ...overrides,
  };
}

async function exerciseRepository(repo: SessionRepository): Promise<void> {
  await repo.saveSession(meta('A', 1000));
  await repo.saveSession(meta('B', 2000));
  await repo.appendAttempt(record('A', 2));
  await repo.appendAttempt(record('A', 1));
  await repo.appendAttempt(record('B', 1));

  const sessions = await repo.listSessions();
  expect(sessions.map((s) => s.sessionId)).toEqual(['B', 'A']); // newest first
  expect((await repo.getAttempts('A')).map((a) => a.recordId)).toEqual(['A-1', 'A-2']); // chronological
  expect(await repo.getAttempts('B')).toHaveLength(1);
  expect((await repo.getSession('A'))?.sessionId).toBe('A');
  expect(await repo.getSession('missing')).toBeUndefined();

  await repo.saveSession({ ...meta('A', 1000), winnerName: 'Aina', finishedAtMs: 5000 });
  expect((await repo.getSession('A'))?.winnerName).toBe('Aina');

  await repo.deleteSession('A');
  expect((await repo.listSessions()).map((s) => s.sessionId)).toEqual(['B']);
  expect(await repo.getAttempts('A')).toEqual([]);
  expect(await repo.getAttempts('B')).toHaveLength(1);

  await repo.deleteAll();
  expect(await repo.listSessions()).toEqual([]);
  expect(await repo.getAttempts('B')).toEqual([]);
}

describe('session repositories', () => {
  it('in-memory repository supports the full contract', async () => {
    const repo = new InMemorySessionRepository();
    expect(repo.persistent).toBe(false);
    await exerciseRepository(repo);
  });

  it('IndexedDB repository supports the full contract', async () => {
    const repo = await IndexedDbSessionRepository.open(new IDBFactory());
    expect(repo.persistent).toBe(true);
    await exerciseRepository(repo);
    repo.close();
  });

  it('IndexedDB data survives re-opening the database (autosave after every accepted answer)', async () => {
    const factory = new IDBFactory();
    const first = await IndexedDbSessionRepository.open(factory);
    await first.saveSession(meta('KEEP'));
    await first.appendAttempt(record('KEEP', 1));
    first.close();
    const second = await IndexedDbSessionRepository.open(factory);
    expect((await second.getAttempts('KEEP'))[0]?.submittedAnswer).toBe('7');
    second.close();
  });

  it('falls back to memory with a warning when IndexedDB is unavailable', async () => {
    const choice = await createRepository(undefined);
    expect(choice.repository.persistent).toBe(false);
    expect(choice.warning).toMatch(/not available/i);
  });

  it('falls back to memory with a warning when opening fails', async () => {
    const broken = {
      open() {
        const req: Partial<IDBOpenDBRequest> = {};
        setTimeout(
          () => (req.onerror as (() => void) | null | undefined)?.call(req as IDBOpenDBRequest),
          0,
        );
        return req as IDBOpenDBRequest;
      },
    } as unknown as IDBFactory;
    const choice = await createRepository(broken);
    expect(choice.repository.persistent).toBe(false);
    expect(choice.warning).toMatch(/could not be opened/i);
  });

  it('a fresh repository keeps sessions separate (no leakage between deleted sessions)', async () => {
    const repo = new InMemorySessionRepository();
    await repo.saveSession(meta('X'));
    await repo.appendAttempt(record('X', 1));
    await repo.deleteSession('X');
    await repo.saveSession(meta('X'));
    expect(await repo.getAttempts('X')).toEqual([]);
  });
});

describe('CSV export', () => {
  it('escapes spreadsheet formula prefixes in text cells', () => {
    expect(escapeCell('=1+1')).toBe("'=1+1");
    expect(escapeCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(escapeCell('-2+3')).toBe("'-2+3");
    expect(escapeCell('@cmd')).toBe("'@cmd");
    expect(escapeCell('\t=cmd')).toBe("'\t=cmd");
    expect(escapeCell('\r=cmd')).toBe(`"'\r=cmd"`);
    expect(escapeCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
  });

  it('leaves ordinary text and generated numbers untouched', () => {
    expect(escapeCell('Aina')).toBe('Aina');
    expect(escapeCell('50')).toBe('50'); // a submitted answer is text and needs no prefix
    expect(escapeCell(50)).toBe('50');
    expect(escapeCell(0)).toBe('0');
    expect(escapeCell(true)).toBe('true');
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
    expect(escapeCell(Number.NaN)).toBe('');
  });

  it('quotes commas, quotes and line breaks correctly', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises a malicious player name inside a full export', () => {
    const csv = attemptsToCsv([
      record('S', 1, { playerName: '=cmd|" /C calc"!A0' }),
      record('S', 2, { playerName: '@SUM(1+1)' }),
    ]);
    const rows = csv.replace(BOM_RE, '').split('\r\n');
    expect(rows[1]).toContain(`"'=cmd|"" /C calc""!A0"`);
    expect(rows[2]).toContain("'@SUM(1+1)");
    // no cell starts with a formula character
    for (const row of rows.slice(1, 3)) {
      for (const cell of row.split(',')) expect(cell.replace(/^"/, '')).not.toMatch(/^[=+\-@]/);
    }
  });

  it('writes a header plus one row per record with UTF-8 BOM and CRLF, one cell per column', () => {
    const csv = attemptsToCsv([record('S', 1), record('S', 2)], meta('S'));
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.replace(BOM_RE, '').split('\r\n');
    expect(lines.at(-1)).toBe('');
    expect(lines).toHaveLength(4);
    expect(lines[0]?.split(',')).toHaveLength(CSV_COLUMNS.length);
    expect(lines[0]).toContain('session_id');
    expect(lines[0]).toContain('sk');
    expect(lines[0]).toContain('hint_used');
    // parameters_json contains commas and quotes, so it must be quoted and the column count stays right
    expect(lines[1]).toContain('"{""params"":{""a"":3,""b"":4}}"');
    expect(lines[1]).toContain('2023-11-14T22:13:21.000Z');
  });

  it('never includes fields outside the minimum evidence set (no surnames, IDs, photos)', () => {
    const headers = CSV_COLUMNS.map((c) => c.header).join(',');
    for (const forbidden of ['surname', 'birth', 'student_id', 'photo', 'email', 'ic_number']) {
      expect(headers).not.toContain(forbidden);
    }
  });

  it('builds a safe file name', () => {
    const name = csvFileName({
      sessionId: 'AB/12 ..',
      startedAtMs: new Date(2026, 8, 24, 10, 5).getTime(),
    });
    expect(name).toBe('mathracing-20260924-1005-AB12.csv');
  });
});

describe('settings', () => {
  function fakeStore(
    initial: Record<string, string> = {},
  ): KeyValueStore & { data: Record<string, string> } {
    const data = { ...initial };
    return {
      data,
      getItem: (k) => data[k] ?? null,
      setItem: (k, v) => {
        data[k] = v;
      },
      removeItem: (k) => {
        delete data[k];
      },
    };
  }

  it('round-trips valid settings and never stores player names', () => {
    const store = fakeStore();
    const settings = new SettingsStore(store);
    settings.save({
      ...DEFAULT_SETTINGS,
      language: 'en',
      raceLength: 10,
      level: 3,
      year: 2,
      topicIds: ['y2-money'],
      playerCount: 4,
    });
    expect(Object.values(store.data).join('')).not.toMatch(/Aina|player.?names/i);
    expect(settings.load()).toMatchObject({
      language: 'en',
      raceLength: 10,
      level: 3,
      year: 2,
      topicIds: ['y2-money'],
      playerCount: 4,
    });
  });

  it('sanitises untrusted or corrupt values field by field', () => {
    expect(
      sanitizeSettings({
        year: 9,
        level: 99,
        raceLength: 7,
        playerCount: 12,
        language: 'zz',
        mode: 'x',
        topicIds: 'nope',
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      topicIds: ['y1-operations'],
    });
    expect(sanitizeSettings({ year: 2, topicIds: ['y1-money', 'y2-time'] }).topicIds).toEqual([
      'y2-time',
    ]); // wrong-year topics dropped
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('reports corrupt storage instead of crashing, and still returns defaults', () => {
    const onError = vi.fn();
    const settings = new SettingsStore(
      fakeStore({ 'mathracing.settings.v1': '{not json' }),
      onError,
    );
    expect(settings.load()).toEqual(DEFAULT_SETTINGS);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('reports a blocked store when saving and keeps working', () => {
    const onError = vi.fn();
    const blocked: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    const settings = new SettingsStore(blocked, onError);
    expect(() => settings.save(DEFAULT_SETTINGS)).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('keeps animation on by default even when the device asks for reduced motion; a saved choice wins', () => {
    const original = globalThis.matchMedia;
    globalThis.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
    })) as typeof matchMedia;
    try {
      expect(new SettingsStore(fakeStore()).load().reducedMotion).toBe(false);
      const store = fakeStore();
      new SettingsStore(store).save({ ...DEFAULT_SETTINGS, reducedMotion: true });
      expect(new SettingsStore(store).load().reducedMotion).toBe(true);
    } finally {
      globalThis.matchMedia = original;
    }
  });

  it('drops a reduced-motion flag saved by older builds (it was copied from the device), keeping the rest', () => {
    const old = JSON.stringify({ ...DEFAULT_SETTINGS, reducedMotion: true, language: 'en' });
    const store = fakeStore({ 'mathracing.settings.v1': old });
    const loaded = new SettingsStore(store).load();
    expect(loaded).toMatchObject({ reducedMotion: false, language: 'en' });
  });

  it('works with no storage at all', () => {
    const settings = new SettingsStore(null);
    expect(settings.load()).toEqual(DEFAULT_SETTINGS);
    expect(() => settings.save(DEFAULT_SETTINGS)).not.toThrow();
  });
});
