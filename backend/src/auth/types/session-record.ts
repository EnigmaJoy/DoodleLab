import type { AuthenticatedUser } from './authenticated-user'

// Server-side session record. Stored in the session store keyed by session ID.
// The session ID (key) is an opaque random value; never stored in the record itself.

export interface SessionRecord {
  /** Verified user identity at session creation time. */
  readonly user: AuthenticatedUser
  /**
   * ACR value from the Keycloak token at session creation time.
   * Copied here so SessionGuard does not re-parse the token on every request.
   */
  readonly acr: string
  /**
   * Unix timestamp (ms) after which this session is considered expired.
   * SessionGuard rejects sessions where expiresAt < Date.now().
   */
  readonly expiresAt: number
}
