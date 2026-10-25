import { createLocalJWKSet } from 'jose'
import { buildTestKeys, TestKeys } from '../fixtures/test-keys.fixture'
import { buildToken } from '../fixtures/token.factory'
import { KeycloakTokenVerifier } from '../../src/auth/token/keycloak-token.verifier'
import type { AuthenticatedUser } from '../../src/auth/types/authenticated-user'

const ISSUER   = 'http://localhost:8080/realms/agenda'
const AUDIENCE = 'agenda-bff'

describe('KeycloakTokenVerifier', () => {
  let keys: TestKeys
  let verifier: KeycloakTokenVerifier

  beforeAll(async () => {
    keys = await buildTestKeys()
    const localJwks = createLocalJWKSet(keys.jwks as Parameters<typeof createLocalJWKSet>[0])
    verifier = new KeycloakTokenVerifier({ issuer: ISSUER, audience: AUDIENCE }, localJwks)
  })

  describe('valid token', () => {
    it('returns AuthenticatedUser for a valid token', async () => {
      const token = await buildToken({ privateKey: keys.privateKey, kid: keys.kid })
      const user: AuthenticatedUser = await verifier.verify(token)
      expect(user.sub).toBe('user-test-123')
      expect(user.acr).toBe('2')
    })

    it('returns AuthenticatedUser even when acr is absent (verifier does not check acr)', async () => {
      const token = await buildToken({ privateKey: keys.privateKey, kid: keys.kid, omitAcr: true })
      const user = await verifier.verify(token)
      expect(user.sub).toBe('user-test-123')
      expect(user.acr).toBeUndefined()
    })
  })

  describe('invalid signature', () => {
    it('rejects a token signed with a different key', async () => {
      const otherKeys = await buildTestKeys()
      const token = await buildToken({ privateKey: otherKeys.privateKey, kid: keys.kid })
      await expect(verifier.verify(token)).rejects.toThrow()
    })

    it('rejects a token with a tampered payload', async () => {
      const token = await buildToken({ privateKey: keys.privateKey, kid: keys.kid })
      // Flip a byte in the payload segment
      const parts = token.split('.')
      const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8')
      const tampered = JSON.parse(payload) as Record<string, unknown>
      tampered['sub'] = 'attacker'
      parts[1] = Buffer.from(JSON.stringify(tampered)).toString('base64url')
      await expect(verifier.verify(parts.join('.'))).rejects.toThrow()
    })
  })

  describe('invalid claims', () => {
    it('rejects a token with the wrong issuer', async () => {
      const token = await buildToken({
        privateKey: keys.privateKey, kid: keys.kid,
        iss: 'http://evil.example.com/realms/fake',
      })
      await expect(verifier.verify(token)).rejects.toThrow()
    })

    it('rejects a token with the wrong audience', async () => {
      const token = await buildToken({
        privateKey: keys.privateKey, kid: keys.kid,
        aud: 'wrong-client',
      })
      await expect(verifier.verify(token)).rejects.toThrow()
    })

    it('rejects an expired token', async () => {
      const token = await buildToken({
        privateKey: keys.privateKey, kid: keys.kid,
        exp: -10,  // expired 10 seconds ago
      })
      await expect(verifier.verify(token)).rejects.toThrow()
    })
  })

  describe('malformed input', () => {
    it('rejects an empty string', async () => {
      await expect(verifier.verify('')).rejects.toThrow()
    })

    it('rejects a non-JWT string', async () => {
      await expect(verifier.verify('not.a.jwt')).rejects.toThrow()
    })
  })
})
