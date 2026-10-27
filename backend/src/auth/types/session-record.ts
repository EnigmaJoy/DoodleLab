import type { AuthenticatedUser } from './authenticated-user'

export interface SessionRecord {
  readonly user:                   AuthenticatedUser
  readonly acr:                    string
  readonly csrfToken:              string
  readonly encryptedRefreshToken:  string
  readonly encryptedIdToken:       string
  readonly expiresAt:              number   // milliseconds epoch
}
