import type { SessionRecord } from './session-record'

// Abstraction over the session storage backend.
// Increment A uses InMemorySessionStore (always empty; all lookups return undefined).
// Increment B replaces this with a PostgreSQL-backed implementation via the SESSION_STORE token.

export const SESSION_STORE = 'SESSION_STORE'

export interface SessionStore {
  get(sessionId: string): Promise<SessionRecord | undefined>
  set(sessionId: string, record: SessionRecord): Promise<void>
  delete(sessionId: string): Promise<void>
}
