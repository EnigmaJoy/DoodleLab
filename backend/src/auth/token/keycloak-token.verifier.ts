import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { FlattenedJWSInput, GetKeyFunction, JWSHeaderParameters } from 'jose'
import type { AuthenticatedUser } from '../types/authenticated-user'

export interface VerifierConfig {
  issuer:   string
  audience: string
}

type JwksProvider = GetKeyFunction<JWSHeaderParameters, FlattenedJWSInput>

// Validates a raw Keycloak access token.
// Used at OIDC callback time (Increment B) to validate before creating a session.
// Also used in unit tests via a local JWKS fixture.
//
// Does NOT check the ACR claim. ACR assurance is the responsibility of SessionGuard,
// which reads the ACR value stored in the session record at session creation time.

export class KeycloakTokenVerifier {
  private readonly jwks: JwksProvider

  constructor(
    private readonly config: VerifierConfig,
    jwksProviderOrUri: JwksProvider | string,
  ) {
    this.jwks = typeof jwksProviderOrUri === 'string'
      ? createRemoteJWKSet(new URL(jwksProviderOrUri))
      : jwksProviderOrUri
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer:   this.config.issuer,
      audience: this.config.audience,
    })

    if (typeof payload['sub'] !== 'string' || !payload['sub']) {
      throw new Error('Token is missing required sub claim')
    }

    return {
      sub:   payload['sub'],
      email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
      name:  typeof payload['name'] === 'string'  ? payload['name']  : undefined,
      acr:   typeof payload['acr']  === 'string'  ? payload['acr']   : undefined,
    }
  }
}
