// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from '../app/AppController';
import { BOM } from '../reporting/exportCsv';
import { normalizeNames } from '../app/setupState';
import type { GameHandle } from '../game/createGame';
import type { RaceSessionContext } from '../game/session';
import type { AttemptRecord } from '../game/core/RaceState';
import { InMemorySessionRepository } from '../storage/SessionRepository';
import type { SessionRepository } from '../storage/SessionRepository';
import type { KeyValueStore } from '../storage/settings';
import { DEFAULT_SETTINGS, SettingsStore } from '../storage/settings';
import { correctSubmission } from './helpers';

const q = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.querySelector<T>(`[data-testid="${id}"]`);
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const readBytes = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
const readBlob = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
const click = async (id: string): Promise<void> => {
  const el = q(id);
  if (!el) throw new Error(`no element ${id}`);
  el.click();
  await flush();
};

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

type Harness = {
  app: AppController;
  repo: SessionRepository;
  session: () => RaceSessionContext;
  games: number;
  destroyed: number;
  downloads: Blob[];
};

let harness: Harness;
let clock = 1000;

async function boot(
  repo: SessionRepository = new InMemorySessionRepository(),
  settings: SettingsStore = new SettingsStore(memoryStore()),
): Promise<Harness> {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app') as HTMLElement;
  let session: RaceSessionContext | null = null;
  const h: Harness = {
    app: undefined as never,
    repo,
    session: () => session as RaceSessionContext,
    games: 0,
    destroyed: 0,
    downloads: [],
  };
  const fakeGame = (_parent: HTMLElement, s: RaceSessionContext): GameHandle => {
    session = s;
    h.games += 1;
    return {
      game: {} as never,
      releaseAll: () => undefined,
      skipReady: () => {
        // what the Ready scene does when the countdown ends
        s.engine.start(s.now());
        s.callbacks.onRaceStarted();
      },
      setLanguage: () => undefined,
      destroy: () => {
        h.destroyed += 1;
      },
    };
  };
  h.app = new AppController(root, {
    repository: repo,
    settings,
    createGame: fakeGame,
    now: () => clock,
    devDiagnostics: false,
  });
  await h.app.start();
  return h;
}

/** Answer every item correctly for one player until they finish. */
function playerFinishes(h: Harness, playerId: string): void {
  const { engine } = h.session();
  for (let guard = 0; guard < 40; guard++) {
    const p = engine.player(playerId);
    if (!p || p.phase === 'done' || engine.phase !== 'RACING') return;
    if (p.phase === 'answering' && p.question) {
      clock += 5;
      engine.submit(playerId, correctSubmission(p.question), clock);
    } else {
      clock += 800;
      engine.tick(clock);
    }
  }
}

beforeEach(() => {
  clock = 1000;
  // jsdom has no blob URLs; capture what would be downloaded
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b) => {
    harness.downloads.push(b);
    return 'blob:test';
  };
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  harness?.app.dispose();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('normalizeNames', () => {
  it('fills blanks with defaults, trims, limits length and de-duplicates', () => {
    expect(normalizeNames(['', '  Aina  ', 'Aina', 'x'.repeat(40)], 4, 'bm')).toEqual([
      'Pemain 1',
      'Aina',
      'Aina 2',
      'x'.repeat(20),
    ]);
    expect(normalizeNames([], 2, 'en')).toEqual(['Player 1', 'Player 2']);
  });
});

/** Type into an input the way a person does (value + input event). */
function type(id: string, value: string): void {
  const el = q<HTMLInputElement>(id);
  if (!el) throw new Error(`no input ${id}`);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** From the menu into the setup steps (Main = Quick Race, Latihan = Practice). */
const openSetup = (mode: 'race' | 'practice' = 'race'): Promise<void> => click(`menu-${mode}`);

describe('main menu', () => {
  it('opens on the main menu (not an unexplained game screen) in Bahasa Melayu', async () => {
    harness = await boot();
    expect(harness.app.phase).toBe('SETUP');
    expect(q('menu-race')?.textContent).toContain('Main');
    expect(q('menu-practice')?.textContent).toContain('Latihan');
    expect(q('menu-teacher')).not.toBeNull();
    expect(q('menu-again')).toBeNull(); // nothing to repeat on a first run
  });

  it('switches language to English immediately', async () => {
    harness = await boot();
    await click('lang-en');
    expect(q('menu-race')?.textContent).toContain('Play');
    await click('menu-teacher');
    expect(q('pbd-notice')?.textContent).toContain('does not assign a Tahap Penguasaan');
  });

  it('warns the teacher when data is not stored persistently', async () => {
    harness = await boot();
    expect(document.body.textContent).toContain('tidak disimpan secara kekal');
  });

  it('offers "Main semula" when a setup was saved before, and it opens the Ready? step', async () => {
    const settings = new SettingsStore(memoryStore());
    settings.save({ ...DEFAULT_SETTINGS, playerCount: 3 });
    harness = await boot(undefined, settings);
    expect(q('menu-again')?.textContent).toContain('3 pemain');
    await click('menu-again');
    expect(q('step-4')?.getAttribute('aria-current')).toBe('step');
    expect(q('start')).not.toBeNull();
  });
});

describe('setup steps', () => {
  it('shows four steps with the Year first; choosing a year moves on to its topics and pack', async () => {
    harness = await boot();
    await openSetup();
    expect(document.querySelector('h2')?.textContent).toBe('Sediakan perlumbaan');
    expect(q('step-1')?.getAttribute('aria-current')).toBe('step');
    await click('year-2');
    expect(q('step-2')?.getAttribute('aria-current')).toBe('step');
    expect(q('pack-info')?.textContent).toContain('Matematik Tahun 2');
    expect(q('pack-info')?.textContent).toContain('Draf v');
    // the chip opens the full draft notice
    await click('pack-info');
    expect(q('content-dialog')?.textContent).toContain('belum disahkan');
    await click('content-close');
    expect(q('topic-y2-fractions')).not.toBeNull();
    expect(q('topic-y1-money')).toBeNull();
  });

  it('will not go past Topics, or start, with no topic selected, and says why', async () => {
    harness = await boot();
    await openSetup();
    await click('step-2');
    await click('topics-none');
    await click('setup-next');
    expect(q('setup-error')?.textContent).toBe('Pilih sekurang-kurangnya satu topik.');
    expect(q('step-2')?.getAttribute('aria-current')).toBe('step');
    await click('step-4');
    await click('start');
    expect(q('setup-error')?.textContent).toBe('Pilih sekurang-kurangnya satu topik.');
    expect(harness.games).toBe(0);
  });

  it('shows a 5-question preview with answers for the teacher', async () => {
    harness = await boot();
    await openSetup();
    await click('step-2');
    await click('preview');
    const items = document.querySelectorAll('.preview-item');
    expect(items).toHaveLength(5);
    expect(items[0]?.textContent).toContain('Jawapan:');
  });

  it('players step: 2 to 5 players, one car card and optional name each', async () => {
    harness = await boot();
    await openSetup();
    await click('step-3');
    expect(document.querySelectorAll('input[name="count"]')).toHaveLength(4);
    expect(document.querySelectorAll('.player-card')).toHaveLength(2);
    await click('count-5');
    expect(document.querySelectorAll('.player-card')).toHaveLength(5);
    expect(q('name-4')).not.toBeNull();
  });

  it('racer sheet: a pupil picks a racer, taken racers are greyed out, the choice is saved per seat and raced with', async () => {
    const store = memoryStore();
    harness = await boot(undefined, new SettingsStore(store));
    await openSetup();
    await click('step-3');
    expect(q('racer-0')?.getAttribute('aria-label')).toContain('Roket');
    await click('racer-0');
    expect(q('content-dialog')?.textContent).toContain('Haiwan');
    expect(document.querySelectorAll('.racer-tile')).toHaveLength(10);
    expect(q<HTMLButtonElement>('racer-tile-rocket')?.getAttribute('aria-pressed')).toBe('true');
    // player 2 holds the kart: player 1 cannot take it
    expect(q<HTMLButtonElement>('racer-tile-kart')?.disabled).toBe(true);
    expect(q('racer-tile-kart')?.getAttribute('aria-label')).toContain('pemain 2');
    await click('racer-tile-duck');
    expect(q('content-dialog')).toBeNull();
    expect(q('racer-0')?.getAttribute('aria-label')).toContain('Itik');
    await click('racer-1');
    expect(q<HTMLButtonElement>('racer-tile-duck')?.disabled).toBe(true);
    await click('racer-tile-goose');
    const saved = JSON.parse(store.getItem('mathracing.settings.v1') ?? '{}') as {
      racers: string[];
    };
    expect(saved.racers.slice(0, 2)).toEqual(['duck', 'goose']);
    await click('step-4');
    expect(q('sum-players')?.querySelectorAll('.summary-racer')).toHaveLength(2);
    await click('start');
    expect(harness.session().players.map((p) => p.racer)).toEqual(['duck', 'goose']);
  });

  it('a new seat never gets a racer another seat already has', async () => {
    const store = memoryStore();
    store.setItem(
      'mathracing.settings.v1',
      JSON.stringify({ playerCount: 2, racers: ['duck', 'goose', 'duck', 'saucer', 'block'] }),
    );
    harness = await boot(undefined, new SettingsStore(store));
    await openSetup();
    await click('step-3');
    await click('count-3');
    expect(q('racer-2')?.getAttribute('aria-label')).toContain('Kereta laju');
  });

  it('Back and Next keep every choice; Back on the first step returns to the menu', async () => {
    harness = await boot();
    await openSetup();
    await click('setup-next');
    await click('level-3');
    await click('setup-next');
    type('name-0', 'Aina');
    await click('setup-back');
    expect(q<HTMLInputElement>('level-3')?.checked).toBe(true);
    await click('setup-next');
    expect(q<HTMLInputElement>('name-0')?.value).toBe('Aina');
    await click('step-1');
    await click('setup-back');
    expect(q('menu-race')).not.toBeNull();
  });

  it('Latihan on the menu presets Practice mode', async () => {
    harness = await boot();
    await openSetup('practice');
    await click('step-4');
    expect(q<HTMLInputElement>('mode-practice')?.checked).toBe(true);
  });
});

describe('teacher settings', () => {
  it('holds the options, seed, local data and the PBD boundary; saves options but never names', async () => {
    const store = memoryStore();
    harness = await boot(undefined, new SettingsStore(store));
    await openSetup();
    await click('step-3');
    type('name-0', 'Aina');
    await click('setup-home');
    await click('menu-teacher');
    expect(q('pbd-notice')?.textContent).toContain('tidak menetapkan Tahap Penguasaan');
    expect(q('session-count')?.textContent).toContain('0 sesi');
    await click('opt-hints');
    const saved = store.getItem('mathracing.settings.v1') ?? '';
    expect(JSON.parse(saved)).toMatchObject({ hintsEnabled: false });
    expect(saved).not.toContain('Aina');
    await click('teacher-back');
    expect(q('menu-race')).not.toBeNull();
  });

  it('cruise is on by default; the setback option appears only for the step race', async () => {
    const store = memoryStore();
    harness = await boot(undefined, new SettingsStore(store));
    await click('menu-teacher');
    expect(q('opt-cruise')).not.toBeNull();
    expect(q('opt-setback')).toBeNull();
    await click('opt-cruise');
    expect(JSON.parse(store.getItem('mathracing.settings.v1') ?? '')).toMatchObject({
      cruiseEnabled: false,
    });
    expect(q('opt-setback')).not.toBeNull();
    await click('teacher-back');
    await openSetup();
    await click('step-4');
    await click('start');
    expect(harness.session().config.movement).toBe('steps');
  });
});

describe('race flow', () => {
  async function startTwoPlayers(h: Harness): Promise<void> {
    await click('menu-teacher');
    type('seed', 'APP-SEED');
    await click('teacher-back');
    await openSetup();
    await click('step-3');
    type('name-0', 'Aina');
    await click('step-4');
    await click('length-5');
    await click('start');
    expect(h.games).toBe(1);
  }

  it('walks SETUP -> READY -> RACING -> FINISHED -> RESULTS with one winner', async () => {
    harness = await boot();
    await startTwoPlayers(harness);
    expect(harness.app.phase).toBe('READY');
    expect(q('stage')).not.toBeNull();
    await click('skip-ready');
    expect(harness.app.phase).toBe('RACING');

    const session = harness.session();
    expect(session.config.seed).toBe('APP-SEED');
    expect(session.players.map((p) => p.name)).toEqual(['Aina', 'Pemain 2']);
    playerFinishes(harness, 'p1');
    expect(harness.app.phase).toBe('FINISHED');
    expect(session.engine.winnerId).toBe('p1');

    session.callbacks.onCelebrationDone();
    await flush();
    expect(harness.app.phase).toBe('RESULTS');
    expect(harness.destroyed).toBe(1); // the Phaser game is destroyed when results appear
    expect(q('winner-banner')?.textContent).toContain('Aina menang!');
    expect(q('standings')?.textContent).toContain('Pemain 2');
    expect(q('evidence')).toBeNull(); // teacher evidence stays hidden until requested
    await click('toggle-evidence');
    expect(q('evidence')?.textContent).toContain('bukan markah');
  });

  it('persists every attempt and the finished session as the race goes', async () => {
    harness = await boot();
    await startTwoPlayers(harness);
    await click('skip-ready');
    playerFinishes(harness, 'p1');
    harness.session().callbacks.onCelebrationDone();
    await flush();
    const sessions = await harness.repo.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ seed: 'APP-SEED', winnerName: 'Aina', raceLength: 5 });
    const attempts = await harness.repo.getAttempts(sessions[0]?.sessionId as string);
    // Cruise: boosts land over time, so a pupil may answer a few more than raceLength before arriving.
    expect(attempts.length).toBeGreaterThanOrEqual(1);
    expect(attempts).toHaveLength(harness.session().engine.attempts.length);
    expect(attempts.every((a: AttemptRecord) => a.correct && a.playerName === 'Aina')).toBe(true);
  });

  it('Main Lagi starts a fresh race with the same setup and new questions; cancelling returns to the Ready? step', async () => {
    harness = await boot();
    await startTwoPlayers(harness);
    await click('skip-ready');
    playerFinishes(harness, 'p1');
    harness.session().callbacks.onCelebrationDone();
    await flush();
    const firstSeed = harness.session().config.seed;
    await click('again');
    expect(harness.games).toBe(2);
    expect(harness.app.phase).toBe('READY');
    expect(harness.session().config.players.map((p) => p.name)).toEqual(['Aina', 'Pemain 2']);
    expect(harness.session().config.seed).not.toBe(firstSeed); // a new seed, so new questions
    await click('cancel-ready');
    expect(harness.app.phase).toBe('SETUP');
    expect(q('start')).not.toBeNull();
    await click('step-3');
    expect(q<HTMLInputElement>('name-0')?.value).toBe('Aina'); // names carried over only in memory
  });

  it('Esc pauses and resumes; Exit returns to Setup without a winner', async () => {
    harness = await boot();
    await startTwoPlayers(harness);
    await click('skip-ready');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(harness.app.phase).toBe('PAUSED');
    expect(q('pause-overlay')?.hidden).toBe(false);
    // answers are refused while paused
    const p1 = harness.session().engine.player('p1');
    expect(
      harness.session().engine.submit('p1', correctSubmission(p1?.question as never), clock + 10),
    ).toEqual({ status: 'rejected', reason: 'not-racing' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(harness.app.phase).toBe('RACING');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await click('exit-setup');
    expect(harness.app.phase).toBe('SETUP');
    expect(q('start')).not.toBeNull();
    expect(harness.destroyed).toBe(1);
  });

  it('the teacher can end the race early: no winner is declared', async () => {
    harness = await boot();
    await startTwoPlayers(harness);
    await click('skip-ready');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await click('end-race');
    expect(harness.app.phase).toBe('FINISHED');
    harness.session().callbacks.onCelebrationDone();
    await flush();
    expect(q('winner-banner')?.textContent).toContain('Tiada pemenang');
  });

  it('pauses automatically when the browser tab is hidden', async () => {
    harness = await boot();
    await startTwoPlayers(harness);
    await click('skip-ready');
    harness.session().callbacks.onHidden();
    expect(harness.app.phase).toBe('PAUSED');
  });

  it('practice mode ends without a winner once everyone is done', async () => {
    harness = await boot();
    await openSetup('practice');
    await click('step-4');
    await click('length-5');
    await click('start');
    await click('skip-ready');
    playerFinishes(harness, 'p1');
    expect(harness.app.phase).toBe('RACING'); // others still going: no winner emphasis, race continues
    playerFinishes(harness, 'p2');
    expect(harness.app.phase).toBe('FINISHED');
    harness.session().callbacks.onCelebrationDone();
    await flush();
    expect(q('winner-banner')?.textContent).toContain('Tahniah');
  });
});

describe('export and deletion', () => {
  async function finishedRace(): Promise<Harness> {
    const h = await boot();
    await openSetup();
    await click('step-4');
    await click('length-5');
    await click('start');
    await click('skip-ready');
    playerFinishes(h, 'p1');
    h.session().callbacks.onCelebrationDone();
    await flush();
    return h;
  }

  it('Export CSV downloads a safe UTF-8 CSV of every attempt', async () => {
    harness = await finishedRace();
    await click('export-csv');
    expect(harness.downloads).toHaveLength(1);
    const blob = harness.downloads[0] as Blob;
    const bytes = new Uint8Array(await readBytes(blob));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 byte order mark for Excel
    expect(BOM.charCodeAt(0)).toBe(0xfeff);
    const text = await readBlob(blob); // decoding strips the BOM
    const lines = text.trim().split('\r\n');
    expect(lines).toHaveLength(1 + harness.session().engine.attempts.length); // header + attempts
    expect(lines[0]).toContain('session_id');
    expect(q('results-status')?.textContent).toMatch(/mathracing-.*\.csv/);
  });

  it('Delete Session Data asks first; cancelling keeps data, confirming clears it', async () => {
    harness = await finishedRace();
    expect(await harness.repo.listSessions()).toHaveLength(1);
    await click('delete-session');
    await click('confirm-cancel');
    expect(await harness.repo.listSessions()).toHaveLength(1);
    await click('delete-session');
    await click('confirm-ok');
    await flush();
    expect(await harness.repo.listSessions()).toHaveLength(0);
    expect(await harness.repo.getAttempts('anything')).toHaveLength(0);
    expect(q('results-status')?.textContent).toContain('dipadam');
    // after deletion nothing remains to export
    await click('export-csv');
    expect(harness.downloads).toHaveLength(0);
  });

  it('Teacher settings "delete all" clears every stored session after confirmation', async () => {
    harness = await finishedRace();
    await click('new-setup');
    await click('setup-home');
    expect(q('menu-sessions')?.textContent).toContain('1 sesi');
    await click('menu-teacher');
    expect(q('session-count')?.textContent).toContain('1 sesi');
    await click('delete-all');
    await click('confirm-ok');
    await flush();
    expect(await harness.repo.listSessions()).toHaveLength(0);
    expect(q('session-count')?.textContent).toContain('0 sesi');
  });
});

describe('failure handling', () => {
  it('tells the teacher when a record cannot be saved instead of failing silently', async () => {
    const failing: SessionRepository = Object.assign(new InMemorySessionRepository(), {
      appendAttempt: () => Promise.reject(new Error('disk full')),
    });
    harness = await boot(failing);
    await openSetup();
    await click('step-4');
    await click('start');
    await click('skip-ready');
    playerFinishes(harness, 'p1');
    await flush();
    expect(document.querySelector('.toast-warn')?.textContent).toContain('tidak dapat disimpan');
  });

  it('stops a race whose frames keep failing and returns to Setup with a message, never a frozen screen', async () => {
    harness = await boot();
    await openSetup();
    await click('step-4');
    await click('start');
    await click('skip-ready');
    expect(harness.app.phase).toBe('RACING');
    harness.session().callbacks.onFatal(new Error('boom'));
    await flush();
    await flush();
    expect(harness.app.phase).toBe('SETUP');
    expect(q('start')).not.toBeNull();
    expect(document.querySelector('.toast-warn')?.textContent).toContain('boom');
    expect(harness.destroyed).toBe(1);
  });

  it('an invalid race setup is reported and the app stays usable', async () => {
    harness = await boot();
    await openSetup();
    await click('step-2');
    await click('topics-none');
    await click('step-4');
    await click('start');
    expect(harness.app.phase).toBe('SETUP');
    expect(q('start')).not.toBeNull();
  });
});
