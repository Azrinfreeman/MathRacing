import { evaluateAnswer } from '../../curriculum/answers';
import type { QuestionSource } from '../../curriculum/blueprint';
import type { GeneratedQuestion, SubmittedAnswer } from '../../curriculum/schema';
import type { SpeedState } from './cruise';
import { advanceCruise, applyBoost, applySlow, noteAnswer, speedStateAt } from './cruise';
import type {
  AttemptOutcome,
  AttemptRecord,
  PlayerRaceState,
  RaceConfig,
  RaceEvent,
  RaceListener,
  RaceResult,
  SessionPhase,
  SessionStateMachine,
  SpeedEffect,
  Standing,
  SubmitResult,
} from './RaceState';
import { isPositiveInt } from './RaceState';

export type RaceEngineOptions = {
  /** Added to a monotonic `atMs` to produce the epoch timestamp stored in attempt records. */
  epochOffsetMs?: number;
};

/** Crossing times closer than this are a tie. */
const TIE_MS = 1e-3;

export class RaceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RaceConfigError';
  }
}

/**
 * The race rules, with no Phaser or DOM dependency. Scenes render this state and send intents; they
 * never hold the only copy of any rule.
 *
 * Time is always passed in (`atMs`, a monotonic millisecond clock), which keeps every rule deterministic
 * and testable, including the "two correct answers arrive close together" case.
 */
export class RaceEngine {
  private readonly config: RaceConfig;
  private readonly source: QuestionSource;
  private readonly machine: SessionStateMachine;
  private readonly epochOffsetMs: number;
  private readonly playerStates: PlayerRaceState[];
  private readonly listeners = new Set<RaceListener>();
  private readonly records: AttemptRecord[] = [];
  private winner: { playerId: string; atMs: number } | null = null;
  private endedEarly = false;
  private pausedAtMs: number | null = null;
  /** Cruise: every car's position is known up to this time. */
  private integratedToMs = 0;
  private recordCounter = 0;

  constructor(
    config: RaceConfig,
    source: QuestionSource,
    machine: SessionStateMachine,
    options: RaceEngineOptions = {},
  ) {
    if (!isPositiveInt(config.raceLength) || config.raceLength > 50) {
      throw new RaceConfigError(
        `raceLength must be a positive integer up to 50, got ${config.raceLength}`,
      );
    }
    if (config.players.length < 2 || config.players.length > 5) {
      throw new RaceConfigError(`MathRacing needs 2-5 players, got ${config.players.length}`);
    }
    if (new Set(config.players.map((p) => p.id)).size !== config.players.length) {
      throw new RaceConfigError('player ids must be unique');
    }
    this.config = config;
    this.source = source;
    this.machine = machine;
    this.epochOffsetMs = options.epochOffsetMs ?? 0;
    this.playerStates = config.players.map((p) => ({
      id: p.id,
      name: p.name,
      progress: 0,
      distance: 0,
      boostLeft: 0,
      slowUntilMs: 0,
      idleFromMs: Infinity,
      crawlNoticed: false,
      totalSlowdowns: 0,
      lastCorrectAtMs: null,
      phase: 'answering',
      itemIndex: 0,
      itemsDealt: 0,
      setbackApplied: false,
      totalSetbacks: 0,
      question: null,
      attemptsOnItem: 0,
      itemShownAtMs: 0,
      firstActionAtMs: null,
      hintShown: false,
      supportUsed: 'none',
      visualRevealed: false,
      simplerOffered: false,
      simplerRequests: 0,
      resolveAtMs: null,
      finishedAtMs: null,
      totalCorrect: 0,
      totalAttempts: 0,
      hintCount: 0,
      supportCount: 0,
    }));
  }

  // ------------------------------------------------------------------ read access

  get phase(): SessionPhase {
    return this.machine.phase;
  }

  get players(): readonly PlayerRaceState[] {
    return this.playerStates;
  }

  get target(): number {
    return this.config.raceLength;
  }

  get mode(): RaceConfig['mode'] {
    return this.config.mode;
  }

  get movement(): RaceConfig['movement'] {
    return this.config.movement;
  }

  private get cruising(): boolean {
    return this.config.movement === 'cruise';
  }

  /** How a car is moving now, for drawing: 'stopped' in step movement, before the start and after the finish. */
  speedState(playerId: string): SpeedState {
    const p = this.player(playerId);
    const phase = this.machine.phase;
    if (!p || !this.cruising || p.phase === 'done') return 'stopped';
    if (phase !== 'RACING' && phase !== 'PAUSED') return 'stopped';
    return speedStateAt(p, this.integratedToMs);
  }

  get winnerId(): string | null {
    return this.winner?.playerId ?? null;
  }

  get attempts(): readonly AttemptRecord[] {
    return this.records;
  }

  player(playerId: string): PlayerRaceState | undefined {
    return this.playerStates.find((p) => p.id === playerId);
  }

  on(listener: RaceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RaceEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  // ------------------------------------------------------------------ lifecycle

  /** READY -> RACING. Deals the first item to every player. */
  start(atMs: number): void {
    this.machine.transition('RACING');
    this.integratedToMs = atMs;
    for (const p of this.playerStates) {
      noteAnswer(p, atMs, this.config.cruise);
      this.dealNext(p, atMs);
    }
    this.emit({ type: 'started', atMs });
  }

  /** Pause instantly. Answers typed so far are kept (they live in the widgets, not here). */
  pause(atMs: number): void {
    this.machine.transition('PAUSED');
    this.pausedAtMs = atMs;
    this.emit({ type: 'paused', atMs });
  }

  /** Resume; timers are shifted so paused time never counts against a pupil. */
  resume(atMs: number): void {
    const pausedAt = this.pausedAtMs;
    this.machine.transition('RACING');
    if (pausedAt !== null) {
      const delta = Math.max(0, atMs - pausedAt);
      for (const p of this.playerStates) {
        p.itemShownAtMs += delta;
        if (p.firstActionAtMs !== null) p.firstActionAtMs += delta;
        if (p.resolveAtMs !== null) p.resolveAtMs += delta;
        if (p.slowUntilMs > pausedAt) p.slowUntilMs += delta;
        // A pause never counts as idling.
        if (p.idleFromMs > pausedAt) p.idleFromMs += delta;
      }
      // Cruise: the paused stretch is skipped; the stretch before the pause is still integrated next tick.
      if (this.integratedToMs <= pausedAt) this.integratedToMs += delta;
    }
    this.pausedAtMs = null;
    this.emit({ type: 'resumed', atMs });
  }

  /** Advance timers: finish success animations and deal the next item. Call every frame. */
  tick(atMs: number): void {
    if (this.machine.phase !== 'RACING') return;
    if (this.cruising) {
      this.advanceTo(atMs);
      if (this.machine.phase !== 'RACING') return;
    }
    for (const p of this.playerStates) {
      if (p.phase === 'resolving' && p.resolveAtMs !== null && atMs >= p.resolveAtMs) {
        this.dealNext(p, atMs);
      }
    }
  }

  /** Teacher ends the race early: no winner is declared, open items are recorded as unsolved. */
  endRace(atMs: number): void {
    if (this.cruising && this.machine.phase === 'RACING') this.advanceTo(atMs);
    if (this.machine.phase !== 'RACING' && this.machine.phase !== 'PAUSED') return;
    this.endedEarly = this.winner === null;
    for (const p of this.playerStates) this.closeOpenItem(p, atMs, 'unsolved');
    this.finish();
  }

  // ------------------------------------------------------------------ pupil intents

  /** Record a pupil's first touch on the current item (evidence of time to first action). */
  noteAction(playerId: string, atMs: number): void {
    const p = this.player(playerId);
    if (p && p.phase === 'answering' && p.question && p.firstActionAtMs === null) {
      p.firstActionAtMs = atMs;
    }
  }

  /**
   * Submit an answer. All validation goes through the shared answer service. Movement happens exactly once
   * per accepted correct answer, and the player is locked until their success animation resolves.
   */
  submit(playerId: string, answer: SubmittedAnswer, atMs: number): SubmitResult {
    const p = this.player(playerId);
    if (!p) return { status: 'rejected', reason: 'unknown-player' };

    const phase = this.machine.phase;
    if (phase === 'FINISHED' || phase === 'RESULTS') return this.lateSubmit(p, answer, atMs);
    if (phase !== 'RACING') return { status: 'rejected', reason: 'not-racing' };

    if (this.cruising) {
      // Bring every car up to this moment first: another car may already have finished.
      this.advanceTo(atMs);
      if (this.machine.phase !== 'RACING') return { status: 'rejected', reason: 'race-finished' };
    }
    if (p.phase === 'done') return { status: 'rejected', reason: 'done' };
    if (p.phase === 'resolving') return { status: 'rejected', reason: 'resolving' };
    const question = p.question;
    if (!question) return { status: 'rejected', reason: 'no-question' };

    const evaluation = evaluateAnswer(question, answer);
    if (!evaluation.valid) return { status: 'rejected', reason: 'incomplete' };

    p.attemptsOnItem += 1;
    p.totalAttempts += 1;
    const attemptNumber = p.attemptsOnItem;
    const outcome: AttemptOutcome = evaluation.correct ? 'correct' : 'incorrect';
    // The setback rule: the Nth wrong answer to the same question costs steps, once per question, in
    // Quick Race only, and never below the start line.
    const setback =
      !evaluation.correct &&
      this.config.movement === 'steps' &&
      this.config.setbackEnabled &&
      this.config.mode === 'quick' &&
      attemptNumber === this.config.setbackAfter &&
      !p.setbackApplied &&
      p.progress > 0;
    const setbackSteps = setback ? Math.min(this.config.setbackSteps, p.progress) : 0;
    let speedEffect: SpeedEffect = 'none';
    if (this.cruising) speedEffect = evaluation.correct ? 'boost' : 'slow';
    const correctDelta = this.cruising ? this.config.cruise.boostSteps : 1;
    this.log(
      p,
      question,
      atMs,
      attemptNumber,
      this.describeSubmitted(answer),
      evaluation.normalized,
      evaluation.correct,
      outcome,
      evaluation.correct ? correctDelta : 0 - setbackSteps, // `0 -` so "no setback" is 0, not -0
      speedEffect,
    );
    // Cruise effects start no earlier than the time every car is already integrated to (a pointer event
    // can be stamped slightly before the last frame), so distance already travelled is never rewritten.
    const effectAt = Math.max(atMs, this.integratedToMs);
    p.crawlNoticed = false;

    if (!evaluation.correct) {
      if (setback) {
        const from = p.progress;
        p.progress -= setbackSteps;
        p.distance = p.progress;
        p.setbackApplied = true;
        p.totalSetbacks += 1;
        this.emit({ type: 'setback', playerId: p.id, from, progress: p.progress });
      }
      const slowed = this.cruising;
      if (slowed) {
        applySlow(p, effectAt, this.config.cruise);
        p.totalSlowdowns += 1;
        this.emit({ type: 'slowed', playerId: p.id });
      }
      let hint: string | null = null;
      if (
        this.config.hintsEnabled &&
        attemptNumber >= this.config.hintAfter &&
        question.hint &&
        !p.hintShown
      ) {
        p.hintShown = true;
        p.hintCount += 1;
        hint = question.hint;
        this.emit({ type: 'hint', playerId: p.id, hint });
      }
      let supportOffered = false;
      if (this.config.supportEnabled && attemptNumber >= this.config.supportAfter) {
        if (question.supportVisual && !p.visualRevealed) {
          // First support step: a picture of the problem. It does not change the difficulty.
          p.visualRevealed = true;
          if (p.supportUsed === 'none') p.supportUsed = 'visual';
          p.supportCount += 1;
          supportOffered = true;
          this.emit({ type: 'support', playerId: p.id, kind: 'visual' });
        } else if (!p.simplerOffered && question.level > 1) {
          // Second support step: offer (never force) a simpler related item.
          p.simplerOffered = true;
          supportOffered = true;
          this.emit({ type: 'support', playerId: p.id, kind: 'simpler-offered' });
        }
      }
      return { status: 'incorrect', attemptNumber, hint, supportOffered, setback, slowed };
    }

    if (this.cruising) {
      // Correct in cruise: a boost, never an instant jump. The car reaches the finish in tick().
      applyBoost(p, effectAt, this.config.cruise);
      p.totalCorrect += 1;
      p.lastCorrectAtMs = atMs;
      this.emit({ type: 'boost', playerId: p.id });
      p.phase = 'resolving';
      p.resolveAtMs = atMs + this.config.successDelayMs;
      return { status: 'correct', progress: p.progress, finishedRace: false, isWinner: false };
    }

    // Correct: advance exactly one step, atomically with the log above.
    p.progress += 1;
    p.distance = p.progress;
    p.totalCorrect += 1;
    this.emit({
      type: 'progress',
      playerId: p.id,
      progress: p.progress,
      target: this.config.raceLength,
    });

    if (p.progress >= this.config.raceLength) {
      p.phase = 'done';
      p.finishedAtMs = atMs;
      p.question = null;
      this.emit({ type: 'player-done', playerId: p.id });
      let isWinner = false;
      if (this.config.mode === 'quick') {
        this.winner = { playerId: p.id, atMs };
        isWinner = true;
        this.emit({ type: 'winner', playerId: p.id, atMs, revised: false });
        this.finish();
      } else if (this.playerStates.every((s) => s.phase === 'done')) {
        this.finish();
      }
      return {
        status: 'correct',
        progress: p.progress,
        finishedRace: this.machine.phase === 'FINISHED',
        isWinner,
      };
    }

    p.phase = 'resolving';
    p.resolveAtMs = atMs + this.config.successDelayMs;
    return { status: 'correct', progress: p.progress, finishedRace: false, isWinner: false };
  }

  /**
   * After the race is finished, submissions are frozen. The only exception is a finishing answer whose
   * timestamp is EARLIER than the declared winner's (it merely arrived late in the event queue): that
   * answer wins instead, and the previous winner becomes the runner-up. Everything else is rejected.
   */
  private lateSubmit(p: PlayerRaceState, answer: SubmittedAnswer, atMs: number): SubmitResult {
    const winner = this.winner;
    const question = p.question;
    if (
      this.config.mode !== 'quick' ||
      this.config.movement !== 'steps' ||
      !winner ||
      winner.playerId === p.id ||
      atMs >= winner.atMs ||
      p.phase !== 'answering' ||
      !question ||
      p.progress + 1 < this.config.raceLength
    ) {
      return { status: 'rejected', reason: 'race-finished' };
    }
    const evaluation = evaluateAnswer(question, answer);
    if (!evaluation.valid || !evaluation.correct)
      return { status: 'rejected', reason: 'race-finished' };

    p.attemptsOnItem += 1;
    p.totalAttempts += 1;
    this.log(
      p,
      question,
      atMs,
      p.attemptsOnItem,
      this.describeSubmitted(answer),
      evaluation.normalized,
      true,
      'correct',
      1,
      'none',
    );
    p.progress += 1;
    p.distance = p.progress;
    p.totalCorrect += 1;
    p.phase = 'done';
    p.finishedAtMs = atMs;
    p.question = null;
    this.winner = { playerId: p.id, atMs };
    this.emit({
      type: 'progress',
      playerId: p.id,
      progress: p.progress,
      target: this.config.raceLength,
    });
    this.emit({ type: 'winner', playerId: p.id, atMs, revised: true });
    return { status: 'correct', progress: p.progress, finishedRace: true, isWinner: true };
  }

  /**
   * After three wrong attempts a pupil may swap to a simpler related item. Recorded as support, never as a
   * penalty, and it counts as an ordinary item for progress.
   */
  requestSimpler(playerId: string, atMs: number): boolean {
    const p = this.player(playerId);
    if (
      !p ||
      this.machine.phase !== 'RACING' ||
      p.phase !== 'answering' ||
      !p.simplerOffered ||
      !p.question
    ) {
      return false;
    }
    this.closeOpenItem(p, atMs, 'replaced');
    if (this.cruising) {
      // Asking for an easier item is engaging too: it ends any crawl.
      noteAnswer(p, Math.max(atMs, this.integratedToMs), this.config.cruise);
      p.crawlNoticed = false;
    }
    p.simplerRequests += 1;
    p.supportCount += 1;
    const next = this.source.simpler(p.id, p.itemIndex, p.simplerRequests);
    p.question = next;
    p.attemptsOnItem = 0;
    p.itemShownAtMs = atMs;
    p.firstActionAtMs = null;
    p.hintShown = false;
    p.visualRevealed = false;
    p.simplerOffered = false;
    p.supportUsed = 'simpler';
    this.emit({ type: 'question', playerId: p.id, question: next });
    return true;
  }

  // ------------------------------------------------------------------ results

  result(): RaceResult {
    const finished = this.playerStates
      .filter((p) => p.finishedAtMs !== null)
      .sort((a, b) => (a.finishedAtMs as number) - (b.finishedAtMs as number));
    const rest = this.playerStates
      .filter((p) => p.finishedAtMs === null)
      .sort((a, b) => b.distance - a.distance);
    const ordered = [...finished, ...rest];
    const standings: Standing[] = [];
    let place = 0;
    let previous: PlayerRaceState | null = null;
    ordered.forEach((p, i) => {
      const tied =
        previous !== null &&
        previous.finishedAtMs === null &&
        p.finishedAtMs === null &&
        previous.distance === p.distance;
      if (!tied) place = i + 1;
      standings.push({
        playerId: p.id,
        name: p.name,
        progress: p.progress,
        finishedAtMs: p.finishedAtMs,
        place,
      });
      previous = p;
    });
    return {
      mode: this.config.mode,
      winnerId: this.winnerId,
      endedEarly: this.endedEarly,
      standings,
    };
  }

  // ------------------------------------------------------------------ internals

  private finish(): void {
    if (this.machine.phase === 'FINISHED') return;
    this.machine.transition('FINISHED');
    this.emit({ type: 'finished', result: this.result() });
  }

  /**
   * Cruise: move every car to `atMs`. Cars that reach the finish arrive in the order of their exact
   * crossing times (not the order they are processed), so a frame boundary can never change the winner.
   */
  private advanceTo(atMs: number): void {
    if (atMs <= this.integratedToMs) return;
    const from = this.integratedToMs;
    this.integratedToMs = atMs;
    const last = this.config.raceLength;
    const arrivals: { p: PlayerRaceState; slot: number; at: number }[] = [];
    this.playerStates.forEach((p, slot) => {
      if (p.phase === 'done') return;
      const at = advanceCruise(p, from, atMs, last, this.config.cruise);
      const progress = at === null ? Math.min(last - 1, Math.floor(p.distance)) : last;
      if (progress !== p.progress) {
        p.progress = progress;
        this.emit({ type: 'progress', playerId: p.id, progress, target: last });
      }
      if (at !== null) arrivals.push({ p, slot, at });
      else if (!p.crawlNoticed && speedStateAt(p, atMs) === 'crawl') {
        p.crawlNoticed = true;
        this.emit({ type: 'crawling', playerId: p.id });
      }
    });
    // A tie (crossings within a microsecond, so float rounding never decides): more correct answers, then
    // the earlier last correct answer, then slot order.
    arrivals.sort(
      (a, b) =>
        (Math.abs(a.at - b.at) > TIE_MS ? a.at - b.at : 0) ||
        b.p.totalCorrect - a.p.totalCorrect ||
        (a.p.lastCorrectAtMs ?? Infinity) - (b.p.lastCorrectAtMs ?? Infinity) ||
        a.slot - b.slot,
    );
    for (const { p, at } of arrivals) {
      this.closeOpenItem(p, at, 'unsolved');
      p.phase = 'done';
      p.finishedAtMs = at;
      p.question = null;
      p.resolveAtMs = null;
      p.boostLeft = 0;
      p.slowUntilMs = 0;
      this.emit({ type: 'player-done', playerId: p.id });
      if (this.config.mode === 'quick' && !this.winner) {
        this.winner = { playerId: p.id, atMs: at };
        this.emit({ type: 'winner', playerId: p.id, atMs: at, revised: false });
      }
    }
    if (arrivals.length === 0) return;
    if (this.config.mode === 'quick' || this.playerStates.every((s) => s.phase === 'done')) {
      this.finish();
    }
  }

  private dealNext(p: PlayerRaceState, atMs: number): void {
    // Questions are numbered by how many were dealt, not by progress: after a setback the racer is behind
    // but must still get a NEW question, never one they already solved.
    p.itemIndex = p.itemsDealt;
    p.itemsDealt += 1;
    const question = this.source.question(p.id, p.itemIndex);
    p.question = question;
    p.phase = 'answering';
    p.setbackApplied = false;
    p.attemptsOnItem = 0;
    p.itemShownAtMs = atMs;
    p.firstActionAtMs = null;
    p.hintShown = false;
    p.visualRevealed = false;
    p.simplerOffered = false;
    p.supportUsed = 'none';
    p.simplerRequests = 0;
    p.resolveAtMs = null;
    this.emit({ type: 'question', playerId: p.id, question });
  }

  /** Log an 'unsolved'/'replaced' marker for an item that had attempts but never got a correct answer. */
  private closeOpenItem(p: PlayerRaceState, atMs: number, outcome: 'unsolved' | 'replaced'): void {
    if (p.phase !== 'answering' || !p.question || p.attemptsOnItem === 0) return;
    this.log(p, p.question, atMs, p.attemptsOnItem, '', '', false, outcome, 0, 'none');
  }

  private describeSubmitted(answer: SubmittedAnswer): string {
    return answer.raw;
  }

  private log(
    p: PlayerRaceState,
    q: GeneratedQuestion,
    atMs: number,
    attemptNumber: number,
    submitted: string,
    normalized: string,
    correct: boolean,
    outcome: AttemptOutcome,
    stepDelta: number,
    speedEffect: SpeedEffect,
  ): void {
    this.recordCounter += 1;
    const record: AttemptRecord = {
      recordId: `${this.config.sessionId}-${this.recordCounter}`,
      sessionId: this.config.sessionId,
      seed: this.config.seed,
      playerId: p.id,
      playerName: p.name,
      timestampMs: Math.round(this.epochOffsetMs + atMs),
      elapsedMs: Math.max(0, Math.round(atMs - p.itemShownAtMs)),
      firstActionMs:
        p.firstActionAtMs === null
          ? null
          : Math.max(0, Math.round(p.firstActionAtMs - p.itemShownAtMs)),
      packId: q.packId,
      packVersion: q.packVersion,
      year: q.year,
      topicId: q.topicId,
      standardKandungan: q.standardKandungan.join(';'),
      standardPembelajaran: q.standardPembelajaran.join(';'),
      templateId: q.templateId,
      difficultyBand: q.difficultyBand,
      level: q.level,
      questionId: q.id,
      parameters: JSON.stringify(q.metadata),
      itemIndex: p.itemIndex,
      attemptNumber,
      submittedAnswer: submitted,
      normalizedAnswer: normalized,
      correct,
      hintUsed: p.hintShown,
      supportUsed: p.supportUsed,
      outcome,
      stepDelta,
      // Steps: called before the position changes, so this is where the racer will be after this attempt.
      // Cruise: where the car is now (the boost is delivered over the next moments).
      progressAfter: this.cruising ? Math.round(p.distance * 100) / 100 : p.progress + stepDelta,
      speedEffect,
    };
    this.records.push(record);
    this.emit({ type: 'attempt', record });
  }
}
