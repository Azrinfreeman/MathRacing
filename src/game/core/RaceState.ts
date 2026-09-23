import type { GeneratedQuestion, Language, SubmittedAnswer } from '../../curriculum/schema';

/** The explicit application state machine: every screen the game can be in. */
export type SessionPhase = 'SETUP' | 'READY' | 'RACING' | 'PAUSED' | 'FINISHED' | 'RESULTS';

const TRANSITIONS: Readonly<Record<SessionPhase, readonly SessionPhase[]>> = {
  SETUP: ['READY'],
  READY: ['RACING', 'SETUP'],
  RACING: ['PAUSED', 'FINISHED'],
  PAUSED: ['RACING', 'FINISHED', 'SETUP'],
  FINISHED: ['RESULTS'],
  RESULTS: ['READY', 'SETUP'],
};

export class IllegalTransitionError extends Error {
  readonly from: SessionPhase;
  readonly to: SessionPhase;
  constructor(from: SessionPhase, to: SessionPhase) {
    super(`Illegal state transition ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
  }
}

export type PhaseListener = (to: SessionPhase, from: SessionPhase) => void;

export class SessionStateMachine {
  private current: SessionPhase;
  private readonly listeners = new Set<PhaseListener>();

  constructor(initial: SessionPhase = 'SETUP') {
    this.current = initial;
  }

  get phase(): SessionPhase {
    return this.current;
  }

  can(to: SessionPhase): boolean {
    return TRANSITIONS[this.current].includes(to);
  }

  transition(to: SessionPhase): void {
    if (!this.can(to)) throw new IllegalTransitionError(this.current, to);
    const from = this.current;
    this.current = to;
    for (const listener of [...this.listeners]) listener(to, from);
  }

  onChange(listener: PhaseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export type RaceMode = 'quick' | 'practice';
export const RACE_LENGTHS = [5, 8, 10, 12] as const;
export const DEFAULT_RACE_LENGTH = 8;

export type SupportKind = 'none' | 'visual' | 'simpler';

export type PlayerConfig = {
  id: string;
  /** Display name chosen for this session (nickname or initials; never a surname). */
  name: string;
};

export type RaceConfig = {
  sessionId: string;
  seed: string;
  mode: RaceMode;
  raceLength: number;
  players: readonly PlayerConfig[];
  language: Language;
  hintsEnabled: boolean;
  /** Offer visual support / a simpler related item after `supportAfter` wrong attempts. */
  supportEnabled: boolean;
  hintAfter: number;
  supportAfter: number;
  /**
   * Setback rule (Quick Race only): on the `setbackAfter`-th wrong answer to the SAME question the racer
   * moves back `setbackSteps` (never below the start line), at most once per question. Teacher-switchable.
   */
  setbackEnabled: boolean;
  setbackAfter: number;
  setbackSteps: number;
  /** How long a player's answer stays locked while the success animation resolves. */
  successDelayMs: number;
};

export const DEFAULT_RACE_TIMING = {
  hintAfter: 2,
  supportAfter: 3,
  setbackAfter: 3,
  setbackSteps: 1,
  successDelayMs: 700,
} as const;

export type PlayerPhase = 'answering' | 'resolving' | 'done';

export type PlayerRaceState = {
  readonly id: string;
  readonly name: string;
  progress: number;
  phase: PlayerPhase;
  /**
   * Index of the current question in this player's own sequence. It comes from `itemsDealt`, NOT from
   * progress: progress can go down after a setback, and a question already solved must never be dealt again.
   */
  itemIndex: number;
  /** How many questions have been dealt to this player so far (the next question's index). */
  itemsDealt: number;
  /** True once this question already cost a setback (at most one setback per question). */
  setbackApplied: boolean;
  totalSetbacks: number;
  question: GeneratedQuestion | null;
  attemptsOnItem: number;
  itemShownAtMs: number;
  firstActionAtMs: number | null;
  hintShown: boolean;
  /** Highest support used on the current item: 'simpler' beats 'visual' beats 'none'. */
  supportUsed: SupportKind;
  /** True once the question's visual support picture should be shown on the panel. */
  visualRevealed: boolean;
  /** True once the simpler-item button should be visible for the current item. */
  simplerOffered: boolean;
  simplerRequests: number;
  resolveAtMs: number | null;
  finishedAtMs: number | null;
  totalCorrect: number;
  totalAttempts: number;
  hintCount: number;
  supportCount: number;
};

export type AttemptOutcome = 'correct' | 'incorrect' | 'replaced' | 'unsolved';

/** One local evidence record. Contains only what is needed for PBD evidence; never sent anywhere. */
export type AttemptRecord = {
  recordId: string;
  sessionId: string;
  seed: string;
  playerId: string;
  playerName: string;
  /** Epoch milliseconds when the attempt was made. */
  timestampMs: number;
  /** Time from the item appearing to this attempt, excluding paused time. */
  elapsedMs: number;
  /** Time from the item appearing to the pupil's first touch on it, or null if unknown. */
  firstActionMs: number | null;
  packId: string;
  packVersion: string;
  year: number;
  topicId: string;
  standardKandungan: string;
  standardPembelajaran: string;
  templateId: string;
  difficultyBand: string;
  level: number;
  questionId: string;
  /** JSON of the generation parameters, sufficient (with the session seed) to reproduce the item. */
  parameters: string;
  itemIndex: number;
  attemptNumber: number;
  submittedAnswer: string;
  normalizedAnswer: string;
  correct: boolean;
  hintUsed: boolean;
  supportUsed: SupportKind;
  outcome: AttemptOutcome;
  /** Change in the racer's position caused by this attempt: +1 correct, -1 setback, otherwise 0. */
  stepDelta: number;
  /** The racer's position after this attempt. */
  progressAfter: number;
};

export type SessionMeta = {
  sessionId: string;
  seed: string;
  startedAtMs: number;
  mode: RaceMode;
  year: number;
  packId: string;
  packVersion: string;
  topicIds: string[];
  level: number;
  raceLength: number;
  language: Language;
  playerNames: string[];
  winnerName: string | null;
  finishedAtMs: number | null;
  /** Whether the setback rule was on for this session. */
  setbackEnabled: boolean;
};

export type RejectReason =
  | 'not-racing'
  | 'unknown-player'
  | 'resolving'
  | 'done'
  | 'race-finished'
  | 'incomplete'
  | 'no-question';

export type SubmitResult =
  | { status: 'rejected'; reason: RejectReason }
  | {
      status: 'incorrect';
      attemptNumber: number;
      hint: string | null;
      supportOffered: boolean;
      /** True when this wrong answer moved the racer back a step. */
      setback: boolean;
    }
  | { status: 'correct'; progress: number; finishedRace: boolean; isWinner: boolean };

export type Standing = {
  playerId: string;
  name: string;
  progress: number;
  finishedAtMs: number | null;
  /** 1-based; equal progress with no finish time shares a place. */
  place: number;
};

export type RaceResult = {
  mode: RaceMode;
  /** null in Practice, when the race was ended early, or before anyone finished. */
  winnerId: string | null;
  endedEarly: boolean;
  standings: Standing[];
};

export type RaceEvent =
  | { type: 'started'; atMs: number }
  | { type: 'question'; playerId: string; question: GeneratedQuestion }
  | { type: 'attempt'; record: AttemptRecord }
  | { type: 'progress'; playerId: string; progress: number; target: number }
  | { type: 'setback'; playerId: string; from: number; progress: number }
  | { type: 'hint'; playerId: string; hint: string }
  | { type: 'support'; playerId: string; kind: 'visual' | 'simpler-offered' }
  | { type: 'winner'; playerId: string; atMs: number; revised: boolean }
  | { type: 'player-done'; playerId: string }
  | { type: 'paused'; atMs: number }
  | { type: 'resumed'; atMs: number }
  | { type: 'finished'; result: RaceResult };

export type RaceListener = (event: RaceEvent) => void;

export function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

/** Narrowing helper for submitted answers, used by widgets and tests. */
export function isNumberAnswer(
  a: SubmittedAnswer,
): a is Extract<SubmittedAnswer, { kind: 'number' }> {
  return a.kind === 'number';
}
