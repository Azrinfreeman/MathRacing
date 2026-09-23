import type { AttemptRecord, SessionMeta } from '../game/core/RaceState';

/**
 * Local storage of PBD evidence. Nothing here ever leaves the device: there is no server, account or
 * network call in the storage layer. Implementations must not throw synchronously; failures are rejected
 * promises so the app can tell the teacher instead of losing data silently.
 */
export interface SessionRepository {
  /** False when the data lives only in memory (for example IndexedDB is blocked in a private window). */
  readonly persistent: boolean;
  saveSession(meta: SessionMeta): Promise<void>;
  appendAttempt(record: AttemptRecord): Promise<void>;
  listSessions(): Promise<SessionMeta[]>;
  getSession(sessionId: string): Promise<SessionMeta | undefined>;
  getAttempts(sessionId: string): Promise<AttemptRecord[]>;
  deleteSession(sessionId: string): Promise<void>;
  deleteAll(): Promise<void>;
}

/** Chronological order, with the record counter as a tie-break (record ids end in an increasing number). */
export function compareAttempts(a: AttemptRecord, b: AttemptRecord): number {
  return (
    a.timestampMs - b.timestampMs ||
    a.recordId.localeCompare(b.recordId, undefined, { numeric: true })
  );
}

/** Volatile repository: used by tests and as an honest fallback when IndexedDB is unavailable. */
export class InMemorySessionRepository implements SessionRepository {
  readonly persistent = false;
  private readonly sessions = new Map<string, SessionMeta>();
  private attempts: AttemptRecord[] = [];

  saveSession(meta: SessionMeta): Promise<void> {
    this.sessions.set(meta.sessionId, { ...meta });
    return Promise.resolve();
  }

  appendAttempt(record: AttemptRecord): Promise<void> {
    this.attempts.push({ ...record });
    return Promise.resolve();
  }

  listSessions(): Promise<SessionMeta[]> {
    return Promise.resolve(
      [...this.sessions.values()].sort((a, b) => b.startedAtMs - a.startedAtMs),
    );
  }

  getSession(sessionId: string): Promise<SessionMeta | undefined> {
    return Promise.resolve(this.sessions.get(sessionId));
  }

  getAttempts(sessionId: string): Promise<AttemptRecord[]> {
    return Promise.resolve(
      this.attempts
        .filter((a) => a.sessionId === sessionId)
        .map((a) => ({ ...a }))
        .sort(compareAttempts),
    );
  }

  deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.attempts = this.attempts.filter((a) => a.sessionId !== sessionId);
    return Promise.resolve();
  }

  deleteAll(): Promise<void> {
    this.sessions.clear();
    this.attempts = [];
    return Promise.resolve();
  }
}
