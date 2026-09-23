import { createQuestionSource } from '../curriculum/blueprint';
import type { CurriculumRegistry } from '../curriculum/registry';
import { getDefaultRegistry } from '../curriculum/registry';
import type { Language } from '../curriculum/schema';
import { pickText } from '../curriculum/schema';
import type { GameHandle } from '../game/createGame';
import { RaceEngine } from '../game/core/RaceEngine';
import type { AttemptRecord, RaceConfig, SessionMeta } from '../game/core/RaceState';
import { DEFAULT_RACE_TIMING, SessionStateMachine } from '../game/core/RaceState';
import { createSessionSeed } from '../game/core/SeededRng';
import { styleForSlot } from '../game/core/players';
import type { RaceSessionContext } from '../game/session';
import { SoundService } from '../game/SoundService';
import { createTranslator } from '../locales';
import type { Translator } from '../locales';
import { attemptsToCsv, csvFileName, downloadCsv } from '../reporting/exportCsv';
import type { SessionRepository } from '../storage/SessionRepository';
import { InMemorySessionRepository } from '../storage/SessionRepository';
import type { Settings } from '../storage/settings';
import { SettingsStore } from '../storage/settings';
import { confirmDialog, toast } from './dialogs';
import { clear, h } from './dom';
import { showHelp } from './help';
import { ResultsScreen } from './screens/ResultsScreen';
import type { SetupInput } from './screens/SetupScreen';
import { SetupScreen } from './screens/SetupScreen';
import { StageChrome } from './StageChrome';

export type AppDeps = {
  registry?: CurriculumRegistry;
  repository?: SessionRepository;
  settings?: SettingsStore;
  /** Set when persistent storage could not be opened (shown to the teacher, never hidden). */
  storageWarning?: string | null;
  /** Injected in tests; defaults to the real Phaser game. */
  createGame?: (parent: HTMLElement, session: RaceSessionContext) => GameHandle;
  now?: () => number;
  sound?: SoundService;
  devDiagnostics?: boolean;
};

function createSessionId(): string {
  const rand = Math.floor(Math.random() * 46656)
    .toString(36)
    .padStart(3, '0')
    .toUpperCase();
  return `S${Date.now().toString(36).toUpperCase()}${rand}`;
}

/**
 * Owns screen flow (Setup, Ready, Race, Pause, Results), the session state machine, persistence and the
 * lifecycle of the Phaser game. Domain rules stay in RaceEngine and the curriculum layer.
 */
export class AppController {
  private readonly registry: CurriculumRegistry;
  private readonly repo: SessionRepository;
  private readonly settingsStore: SettingsStore;
  private readonly now: () => number;
  private readonly sound: SoundService;
  private readonly makeGame:
    ((parent: HTMLElement, session: RaceSessionContext) => GameHandle) | undefined;
  private readonly devDiagnostics: boolean;
  private storageWarning: string | null;

  private readonly machine = new SessionStateMachine('SETUP');
  private settings: Settings;
  private setup: SetupScreen | null = null;
  private results: ResultsScreen | null = null;
  private chrome: StageChrome | null = null;
  private game: GameHandle | null = null;
  private engine: RaceEngine | null = null;
  private meta: SessionMeta | null = null;
  private lastInput: SetupInput | null = null;
  private replayCount = 0;
  private sessionDeleted = false;
  private readonly toasts: HTMLElement;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    deps: AppDeps = {},
  ) {
    this.registry = deps.registry ?? getDefaultRegistry();
    this.repo = deps.repository ?? new InMemorySessionRepository();
    this.settingsStore =
      deps.settings ??
      new SettingsStore(undefined, (e) => console.warn('settings storage problem', e));
    this.settings = this.settingsStore.load();
    this.now = deps.now ?? (() => performance.now());
    this.sound =
      deps.sound ??
      new SoundService(this.settings.sound, 0.2, (e) => console.warn('audio problem', e));
    // The Phaser game is loaded on demand: Setup opens without waiting for the 1.5 MB engine bundle.
    this.makeGame = deps.createGame;
    this.devDiagnostics = deps.devDiagnostics ?? false;
    this.storageWarning = deps.storageWarning ?? null;
    this.toasts = h('div', { class: 'toasts', id: 'toasts', aria: { live: 'polite' } });
    document.body.appendChild(this.toasts);
  }

  private get t(): Translator {
    return createTranslator(this.settings.language);
  }

  /** Current state, for tests and diagnostics. */
  get phase(): string {
    return this.machine.phase;
  }

  async start(): Promise<void> {
    this.keyHandler = (e) => this.onKey(e);
    document.addEventListener('keydown', this.keyHandler);
    await this.showSetup();
  }

  dispose(): void {
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
    this.destroyStage();
    this.setup?.unmount();
    this.results?.unmount();
    this.toasts.remove();
  }

  // ------------------------------------------------------------------------------ setup

  private async sessionCount(): Promise<number> {
    try {
      return (await this.repo.listSessions()).length;
    } catch (error) {
      this.reportStorageError(error);
      return 0;
    }
  }

  private async showSetup(): Promise<void> {
    this.destroyStage();
    this.results?.unmount();
    this.results = null;
    this.setup?.unmount();
    const count = await this.sessionCount();
    const t = this.t;
    this.setup = new SetupScreen({
      registry: this.registry,
      settings: this.settings,
      sessionCount: count,
      storageNote: this.storageWarning ?? (this.repo.persistent ? null : t('app.storageWarning')),
      onStart: (input) => void this.beginRace(input, false),
      onChange: (s) => {
        this.settings = s;
        this.settingsStore.save(s);
      },
      onLanguage: (language) => this.setLanguage(language),
      onHelp: () => showHelp(this.t),
      onDeleteAll: async () => {
        await this.repo.deleteAll();
        toast(this.toasts, this.t('setup.data.deleted'));
      },
      confirm: (message) => confirmDialog(this.t, message),
    });
    if (this.lastInput) this.setup.setNames(this.lastInput.playerNames);
    this.setup.mount(this.root);
  }

  private setLanguage(language: Language): void {
    this.settings = { ...this.settings, language };
    this.settingsStore.save(this.settings);
  }

  // ------------------------------------------------------------------------------ race

  private pickSeed(input: SetupInput, replay: boolean): string {
    if (input.seed === null) return createSessionSeed();
    // A teacher-typed seed reproduces the first race exactly; "Main Lagi" derives a fresh but reproducible one.
    return replay ? `${input.seed}-${this.replayCount}` : input.seed;
  }

  private async beginRace(input: SetupInput, replay: boolean): Promise<void> {
    const t = createTranslator(input.language);
    this.settings = {
      ...this.settings,
      language: input.language,
      sound: input.sound,
      reducedMotion: input.reducedMotion,
    };
    this.replayCount = replay ? this.replayCount + 1 : 0;
    try {
      const pack = this.registry.packForYear(input.year);
      const seed = this.pickSeed(input, replay);
      const sessionId = createSessionId();
      const players = input.playerNames.map((name, i) => ({ id: `p${i + 1}`, name }));
      const config: RaceConfig = {
        sessionId,
        seed,
        mode: input.mode,
        raceLength: input.raceLength,
        players,
        language: input.language,
        hintsEnabled: input.hintsEnabled,
        supportEnabled: input.supportEnabled,
        ...DEFAULT_RACE_TIMING,
        successDelayMs: input.reducedMotion ? 450 : DEFAULT_RACE_TIMING.successDelayMs,
      };
      const source = createQuestionSource(this.registry, {
        seed,
        packId: pack.packId,
        topicIds: input.topicIds,
        level: input.level,
        raceLength: input.raceLength,
        language: input.language,
      });
      // Pre-validate every item every player can reach, so a defective template fails here, not mid-race.
      for (const p of players) for (let i = 0; i < input.raceLength; i++) source.question(p.id, i);
      const createGameFn = this.makeGame ?? (await import('../game/createGame')).createGame;

      if (this.machine.phase === 'SETUP' || this.machine.phase === 'RESULTS')
        this.machine.transition('READY');
      const engine = new RaceEngine(config, source, this.machine, {
        epochOffsetMs: Date.now() - this.now(),
      });
      this.engine = engine;
      this.lastInput = input;
      this.sessionDeleted = false;
      this.meta = {
        sessionId,
        seed,
        startedAtMs: Date.now(),
        mode: input.mode,
        year: input.year,
        packId: pack.packId,
        packVersion: pack.version,
        topicIds: input.topicIds,
        level: input.level,
        raceLength: input.raceLength,
        language: input.language,
        playerNames: players.map((p) => p.name),
        winnerName: null,
        finishedAtMs: null,
      };
      this.repo.saveSession(this.meta).catch((e: unknown) => this.reportStorageError(e));
      engine.on((e) => {
        // Autosave after every attempt so a crash or power loss never loses an accepted answer.
        if (e.type === 'attempt')
          this.repo.appendAttempt(e.record).catch((err: unknown) => this.reportStorageError(err));
      });

      this.sound.setEnabled(input.sound);
      this.sound.unlock(); // this click is the user gesture browsers require before audio may play

      const session: RaceSessionContext = {
        engine,
        config,
        players: players.map((p, i) => ({ id: p.id, name: p.name, style: styleForSlot(i) })),
        language: input.language,
        reducedMotion: input.reducedMotion,
        sound: this.sound,
        now: this.now,
        devDiagnostics: this.devDiagnostics,
        callbacks: {
          onRaceStarted: () => this.chrome?.setPhase('racing'),
          onCelebrationDone: () => void this.showResults(),
          onHidden: () => this.pauseRace(),
        },
      };

      this.setup?.unmount();
      this.setup = null;
      this.results?.unmount();
      this.results = null;
      this.chrome = new StageChrome(this.root, t, {
        onPause: () => this.pauseRace(),
        onResume: () => this.resumeRace(),
        onSkipReady: () => this.game?.skipReady(),
        onCancel: () => void this.cancelReady(),
        onEnd: () => this.endRace(),
        onExit: () => void this.exitToSetup(),
        onHelp: () => showHelp(this.t),
      });
      this.chrome.setPhase('ready');
      this.game = createGameFn(this.chrome.host, session);
    } catch (error) {
      console.error('Race could not start', error);
      const reason = error instanceof Error ? error.message : String(error);
      if (this.machine.phase === 'READY') this.machine.transition('SETUP');
      this.destroyStage();
      if (!this.setup) await this.showSetup();
      toast(this.toasts, t('app.raceError', { reason }), 'warn', 12000);
    }
  }

  private pauseRace(): void {
    const engine = this.engine;
    if (!engine || this.machine.phase !== 'RACING') return;
    engine.pause(this.now());
    this.game?.releaseAll();
    this.chrome?.setPhase('paused');
  }

  private resumeRace(): void {
    const engine = this.engine;
    if (!engine || this.machine.phase !== 'PAUSED') return;
    engine.resume(this.now());
    this.chrome?.setPhase('racing');
  }

  private endRace(): void {
    const engine = this.engine;
    if (!engine) return;
    engine.endRace(this.now());
    this.chrome?.setPhase('racing');
  }

  private async cancelReady(): Promise<void> {
    if (this.machine.phase === 'READY') this.machine.transition('SETUP');
    await this.showSetup();
  }

  private async exitToSetup(): Promise<void> {
    if (this.machine.phase === 'PAUSED') this.machine.transition('SETUP');
    else if (this.machine.phase === 'READY') this.machine.transition('SETUP');
    await this.showSetup();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (this.machine.phase === 'RACING') this.pauseRace();
    else if (this.machine.phase === 'PAUSED') this.resumeRace();
  }

  // ------------------------------------------------------------------------------ results

  private async showResults(): Promise<void> {
    const engine = this.engine;
    const meta = this.meta;
    if (!engine || !meta) return;
    if (this.machine.phase === 'FINISHED') this.machine.transition('RESULTS');
    else if (this.machine.phase !== 'RESULTS') return;
    const result = engine.result();
    const winner = engine.players.find((p) => p.id === result.winnerId);
    const finalMeta: SessionMeta = {
      ...meta,
      winnerName: winner?.name ?? null,
      finishedAtMs: Date.now(),
    };
    this.meta = finalMeta;
    this.repo.saveSession(finalMeta).catch((e: unknown) => this.reportStorageError(e));
    this.destroyStage();

    const lang = this.settings.language;
    const pack = this.registry.getPack(finalMeta.packId);
    const topicTitles: Record<string, string> = {};
    for (const topic of pack.topics)
      topicTitles[topic.id] = `${topic.code} ${pickText(lang, topic.title)}`;
    const players = engine.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      style: styleForSlot(i),
    }));
    const attempts: readonly AttemptRecord[] = engine.attempts;

    const screen = new ResultsScreen(
      {
        language: lang,
        result,
        meta: finalMeta,
        attempts,
        players,
        raceLength: finalMeta.raceLength,
        topicTitles,
      },
      {
        onAgain: () => {
          if (this.lastInput) void this.beginRace(this.lastInput, true);
        },
        onNewSetup: () => {
          if (this.machine.phase === 'RESULTS') this.machine.transition('SETUP');
          void this.showSetup();
        },
        onExport: () => this.exportCsv(screen),
        onDelete: async () => {
          const ok = await confirmDialog(this.t, this.t('results.confirmDelete'));
          if (!ok) return false;
          try {
            await this.repo.deleteSession(finalMeta.sessionId);
          } catch (error) {
            this.reportStorageError(error);
            return false;
          }
          this.sessionDeleted = true;
          return true;
        },
      },
    );
    this.results = screen;
    screen.mount(this.root);
  }

  private exportCsv(screen: ResultsScreen): void {
    const t = this.t;
    const meta = this.meta;
    const records = this.engine?.attempts ?? [];
    if (!meta || this.sessionDeleted || records.length === 0) {
      screen.showStatus(t('results.exportEmpty'));
      return;
    }
    downloadCsv(attemptsToCsv(records, meta), csvFileName(meta));
    screen.showStatus(`${t('results.export')}: ${csvFileName(meta)}`);
  }

  // ------------------------------------------------------------------------------ helpers

  private destroyStage(): void {
    this.game?.destroy();
    this.game = null;
    this.chrome?.destroy();
    this.chrome = null;
    if (this.root.querySelector('.stage')) clear(this.root);
  }

  private reportStorageError(error: unknown): void {
    console.error('storage error', error);
    toast(this.toasts, this.t('app.storageFailed'), 'warn', 10000);
  }
}
