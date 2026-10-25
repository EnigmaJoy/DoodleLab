// Shape of the verified caller extracted from a valid Keycloak access token.
// Attached to request.user by SessionGuard after successful session lookup.

export interface AuthenticatedUser {
  /** Stable Keycloak subject identifier. Never a client-supplied value. */
  readonly sub: string
  /** Verified email from the Keycloak token. May be absent for some scopes. */
  readonly email?: string
  /** Display name from the Keycloak token. May be absent. */
  readonly name?: string
  /**
   * Authentication Context Reference from the Keycloak token.
   * Must equal KEYCLOAK_REQUIRED_ACR for full access.
   * Stored in the session record at session creation time; not user-controllable.
   */
  readonly acr?: string
}
