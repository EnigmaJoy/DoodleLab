// Test-only RSA key pair and JWKS fixture.
// Keys are generated fresh per test run using jose. No fixed private key is committed.
// Import buildTestKeys() in a beforeAll block and pass the result to TokenFactory.

import { generateKeyPair, exportJWK } from 'jose'
import type { KeyLike } from 'jose'

export interface TestKeys {
  privateKey: KeyLike
  jwks: { keys: object[] }
  kid: string
}

// Call once in beforeAll. The returned privateKey signs tokens;
// the jwks object serves as the local JWKS fixture for createLocalJWKSet.
export async function buildTestKeys(): Promise<TestKeys> {
  const kid = 'test-rsa-key-1'
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const publicJwk = await exportJWK(publicKey)
  return {
    privateKey,
    jwks: {
      keys: [{ ...publicJwk, kid, use: 'sig', alg: 'RS256' }],
    },
    kid,
  }
}
