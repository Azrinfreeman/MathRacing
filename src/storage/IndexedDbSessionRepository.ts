import type { AttemptRecord, SessionMeta } from '../game/core/RaceState';
import type { SessionRepository } from './SessionRepository';
import { InMemorySessionRepository, compareAttempts } from './SessionRepository';

const DB_NAME = 'mathracing-evidence';
const DB_VERSION = 1;
const SESSIONS = 'sessions';
const ATTEMPTS = 'attempts';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/** IndexedDB-backed evidence store: sessions plus one row per attempt, indexed by session id. */
export class IndexedDbSessionRepository implements SessionRepository {
  readonly persistent = true;
  private constructor(private readonly db: IDBDatabase) {}

  static open(factory: IDBFactory = indexedDB): Promise<IndexedDbSessionRepository> {
    return new Promise((resolve, reject) => {
      const req = factory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SESSIONS))
          db.createObjectStore(SESSIONS, { keyPath: 'sessionId' });
        if (!db.objectStoreNames.contains(ATTEMPTS)) {
          const store = db.createObjectStore(ATTEMPTS, { keyPath: 'recordId' });
          store.createIndex('bySession', 'sessionId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(new IndexedDbSessionRepository(req.result));
      req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
      req.onblocked = () => reject(new Error('IndexedDB open was blocked'));
    });
  }

  async saveSession(meta: SessionMeta): Promise<void> {
    const tx = this.db.transaction(SESSIONS, 'readwrite');
    tx.objectStore(SESSIONS).put(meta);
    await transactionDone(tx);
  }

  async appendAttempt(record: AttemptRecord): Promise<void> {
    const tx = this.db.transaction(ATTEMPTS, 'readwrite');
    tx.objectStore(ATTEMPTS).put(record);
    await transactionDone(tx);
  }

  async listSessions(): Promise<SessionMeta[]> {
    const all = await request<SessionMeta[]>(
      this.db.transaction(SESSIONS).objectStore(SESSIONS).getAll(),
    );
    return all.sort((a, b) => b.startedAtMs - a.startedAtMs);
  }

  async getSession(sessionId: string): Promise<SessionMeta | undefined> {
    const result = await request<SessionMeta | undefined>(
      this.db.transaction(SESSIONS).objectStore(SESSIONS).get(sessionId),
    );
    return result;
  }

  async getAttempts(sessionId: string): Promise<AttemptRecord[]> {
    const index = this.db.transaction(ATTEMPTS).objectStore(ATTEMPTS).index('bySession');
    const rows = await request<AttemptRecord[]>(index.getAll(sessionId));
    return rows.sort(compareAttempts);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const tx = this.db.transaction([SESSIONS, ATTEMPTS], 'readwrite');
    tx.objectStore(SESSIONS).delete(sessionId);
    const index = tx.objectStore(ATTEMPTS).index('bySession');
    const keys = await request<IDBValidKey[]>(index.getAllKeys(sessionId));
    for (const key of keys) tx.objectStore(ATTEMPTS).delete(key);
    await transactionDone(tx);
  }

  async deleteAll(): Promise<void> {
    const tx = this.db.transaction([SESSIONS, ATTEMPTS], 'readwrite');
    tx.objectStore(SESSIONS).clear();
    tx.objectStore(ATTEMPTS).clear();
    await transactionDone(tx);
  }

  close(): void {
    this.db.close();
  }
}

export type RepositoryChoice = { repository: SessionRepository; warning: string | null };

/**
 * Open the persistent store, or fall back to memory with a clear warning when IndexedDB is unavailable
 * (some private windows, locked-down school profiles). The app tells the teacher rather than hiding it.
 */
export async function createRepository(
  factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
): Promise<RepositoryChoice> {
  if (!factory) {
    return {
      repository: new InMemorySessionRepository(),
      warning: 'IndexedDB is not available in this browser.',
    };
  }
  try {
    return { repository: await IndexedDbSessionRepository.open(factory), warning: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      repository: new InMemorySessionRepository(),
      warning: `Local storage could not be opened (${reason}).`,
    };
  }
}
