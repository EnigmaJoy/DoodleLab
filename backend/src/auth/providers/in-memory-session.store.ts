import type { SessionRecord } from '../types/session-record'
import type { SessionStore } from '../types/session-store.interface'

// In-memory session store for Increment A.
// Always empty at startup; no OIDC callback populates it yet.
// All authenticated requests return 401 because lookups return undefined.
// Replace with a PostgreSQL-backed implementation in Increment B via the SESSION_STORE token.

export class InMemorySessionStore implements SessionStore {
  private readonly store = new Map<string, SessionRecord>()

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    return this.store.get(sessionId)
  }

  async set(sessionId: string, record: SessionRecord): Promise<void> {
    this.store.set(sessionId, record)
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }
}
