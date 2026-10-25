// Builds signed test JWTs using the test private key from buildTestKeys().
// Each named parameter defaults to a valid value; override only what the test needs.

import { SignJWT } from 'jose'
import type { KeyLike } from 'jose'

export interface TokenOptions {
  privateKey: KeyLike
  kid?: string
  iss?: string
  aud?: string | string[]
  sub?: string
  exp?: number   // seconds from now; negative = already expired
  acr?: string
  omitAcr?: boolean
}

const DEFAULT_ISS = 'http://localhost:8080/realms/agenda'
const DEFAULT_AUD = 'agenda-bff'
const DEFAULT_SUB = 'user-test-123'

export async function buildToken(opts: TokenOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const payload: Record<string, unknown> = {}
  if (!opts.omitAcr) {
    payload['acr'] = opts.acr ?? '2'
  }

  let builder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: opts.kid ?? 'test-rsa-key-1' })
    .setIssuer(opts.iss ?? DEFAULT_ISS)
    .setAudience(opts.aud ?? DEFAULT_AUD)
    .setSubject(opts.sub ?? DEFAULT_SUB)
    .setIssuedAt(now)

  const expSeconds = opts.exp ?? 3600
  builder = builder.setExpirationTime(now + expSeconds)

  return builder.sign(opts.privateKey)
}
