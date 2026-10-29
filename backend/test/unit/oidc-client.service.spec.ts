const mockDiscovery            = jest.fn()
const mockCodeGrant            = jest.fn()
const mockRevocation           = jest.fn()
const mockAllowInsecureRequests = jest.fn()

jest.mock('openid-client', () => ({
  discovery:              mockDiscovery,
  authorizationCodeGrant: mockCodeGrant,
  tokenRevocation:        mockRevocation,
  allowInsecureRequests:  mockAllowInsecureRequests,
}), { virtual: true })

import { OidcClientService } from '../../src/auth/oidc/oidc-client.service'
import { ConfigService }     from '@nestjs/config'

const ISSUER  = 'http://localhost:8080/realms/agenda'
const CLIENT  = 'agenda-bff'
const SECRET  = 'bff-secret'

function makeConfig(): ConfigService {
  return {
    get: jest.fn().mockReturnValue({
      keycloakIssuerUrl:       ISSUER,
      keycloakClientId:        CLIENT,
      keycloakBffClientSecret: SECRET,
      keycloakRequiredAcr:    '2',
    }),
  } as unknown as ConfigService
}

function makeConfiguration(overrides: Record<string, string> = {}) {
  const metadata = {
    authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
    end_session_endpoint:   `${ISSUER}/protocol/openid-connect/logout`,
    ...overrides,
  }
  return { serverMetadata: () => metadata }
}

describe('OidcClientService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('onModuleInit calls discovery() with the configured issuer URL', async () => {
    mockDiscovery.mockResolvedValue(makeConfiguration())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()
    expect(mockDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining(ISSUER) }),
      CLIENT,
      SECRET,
      undefined,
      expect.anything(),
    )
  })

  it('buildAuthorizationUrl returns a URL containing state, code_challenge, and nonce', async () => {
    mockDiscovery.mockResolvedValue(makeConfiguration())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    const url = new URL(svc.buildAuthorizationUrl({
      state: 'test-state', nonce: 'test-nonce',
      codeVerifier: 'a'.repeat(64), flow: 'login',
    }))
    expect(url.searchParams.get('state')).toBe('test-state')
    expect(url.searchParams.get('nonce')).toBe('test-nonce')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('buildAuthorizationUrl URL contains the serialised claims parameter', async () => {
    mockDiscovery.mockResolvedValue(makeConfiguration())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    const url    = new URL(svc.buildAuthorizationUrl({
      state: 's', nonce: 'n', codeVerifier: 'v'.repeat(64), flow: 'login',
    }))
    const claims = JSON.parse(url.searchParams.get('claims') ?? '{}') as Record<string, unknown>
    expect(claims).toMatchObject({
      id_token: { acr: { essential: true, values: ['2'] } },
    })
  })

  it('buildAuthorizationUrl sets kc_idp_hint=google for login and register', async () => {
    mockDiscovery.mockResolvedValue(makeConfiguration())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    for (const flow of ['login', 'register'] as const) {
      const url = new URL(svc.buildAuthorizationUrl({
        state: 's', nonce: 'n', codeVerifier: 'v'.repeat(64), flow,
      }))
      expect(url.searchParams.get('kc_idp_hint')).toBe('google')
      expect(url.searchParams.get('scope')).toBe('openid email profile')
      expect(JSON.parse(url.searchParams.get('claims') ?? '{}')).toEqual({
        id_token: { acr: { essential: true, values: ['2'] } },
      })
    }
  })

  it('exchangeCode calls the mocked token endpoint with code and codeVerifier', async () => {
    mockDiscovery.mockResolvedValue(makeConfiguration())
    mockCodeGrant.mockResolvedValue({
      claims:        () => ({ sub: 'u1', acr: '2', nonce: 'n' }),
      refresh_token: 'rt',
      id_token:      'raw-jwt',
    })
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    const result = await svc.exchangeCode({ code: 'code-abc', codeVerifier: 'cv', nonce: 'n' })
    expect(mockCodeGrant).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ href: expect.stringContaining('code=code-abc') }),
      expect.objectContaining({ pkceCodeVerifier: 'cv', expectedNonce: 'n' }),
    )
    expect(result.idTokenClaims['acr']).toBe('2')
    expect(result.refreshToken).toBe('rt')
    expect(result.idTokenRaw).toBe('raw-jwt')
  })

  it('revokeToken does not throw when the revocation endpoint returns a network error', async () => {
    mockDiscovery.mockResolvedValue(makeConfiguration())
    mockRevocation.mockRejectedValue(new Error('network failure'))
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()
    await expect(svc.revokeToken('token', 'refresh_token')).resolves.not.toThrow()
  })

  it('buildLogoutUrl contains id_token_hint and post_logout_redirect_uri', async () => {
    mockDiscovery.mockResolvedValue(makeConfiguration())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    const url = new URL(svc.buildLogoutUrl('raw-id-token', 'http://localhost:3000'))
    expect(url.searchParams.get('id_token_hint')).toBe('raw-id-token')
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000')
    expect(url.searchParams.get('client_id')).toBe(CLIENT)
  })
})
