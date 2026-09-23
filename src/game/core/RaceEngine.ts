import { evaluateAnswer } from '../../curriculum/answers';
import type { QuestionSource } from '../../curriculum/blueprint';
import type { GeneratedQuestion, SubmittedAnswer } from '../../curriculum/schema';
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
  Standing,
  SubmitResult,
} from './RaceState';
import { isPositiveInt } from './RaceState';

export type RaceEngineOptions = {
  /** Added to a monotonic `atMs` to produce the epoch timestamp stored in attempt records. */
  epochOffsetMs?: number;
};

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
      phase: 'answering',
      itemIndex: 0,
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
    for (const p of this.playerStates) this.dealNext(p, atMs);
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
      }
    }
    this.pausedAtMs = null;
    this.emit({ type: 'resumed', atMs });
  }

  /** Advance timers: finish success animations and deal the next item. Call every frame. */
  tick(atMs: number): void {
    if (this.machine.phase !== 'RACING') return;
    for (const p of this.playerStates) {
      if (p.phase === 'resolving' && p.resolveAtMs !== null && atMs >= p.resolveAtMs) {
        this.dealNext(p, atMs);
      }
    }
  }

  /** Teacher ends the race early: no winner is declared, open items are recorded as unsolved. */
  endRace(atMs: number): void {
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
    this.log(
      p,
      question,
      atMs,
      attemptNumber,
      this.describeSubmitted(answer),
      evaluation.normalized,
      evaluation.correct,
      outcome,
    );

    if (!evaluation.correct) {
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
      return { status: 'incorrect', attemptNumber, hint, supportOffered };
    }

    // Correct: advance exactly one step, atomically with the log above.
    p.progress += 1;
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
    );
    p.progress += 1;
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
      .sort((a, b) => b.progress - a.progress);
    const ordered = [...finished, ...rest];
    const standings: Standing[] = [];
    let place = 0;
    let previous: PlayerRaceState | null = null;
    ordered.forEach((p, i) => {
      const tied =
        previous !== null &&
        previous.finishedAtMs === null &&
        p.finishedAtMs === null &&
        previous.progress === p.progress;
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

  private dealNext(p: PlayerRaceState, atMs: number): void {
    p.itemIndex = p.progress;
    const question = this.source.question(p.id, p.itemIndex);
    p.question = question;
    p.phase = 'answering';
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
    this.log(p, p.question, atMs, p.attemptsOnItem, '', '', false, outcome);
  }

  private describeSubmitted(answer: SubmittedAnswer): string {
    switch (answer.kind) {
      case 'number':
        return answer.raw;
      case 'choice':
        return answer.optionId;
      case 'sequence':
      case 'set':
        return answer.optionIds.join(',');
    }
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
    };
    this.records.push(record);
    this.emit({ type: 'attempt', record });
  }
}
