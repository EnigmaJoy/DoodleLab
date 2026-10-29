import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'crypto'
import type { AuthConfig } from '../../config/auth.config'

@Injectable()
export class OidcClientService implements OnModuleInit {
  private readonly logger = new Logger(OidcClientService.name)
  // oidcConfig holds the Configuration object for openid-client SDK calls
  // serverMetadata holds the plain AS metadata for manual URL construction
  private oidcConfig!: unknown
  private serverMetadata!: Record<string, unknown>
  private clientId!: string
  private clientSecret!: string
  private redirectUri!: string

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const auth = this.config.get<AuthConfig>('auth')!
    this.clientId     = auth.keycloakClientId
    this.clientSecret = auth.keycloakBffClientSecret
    this.redirectUri  = process.env['KEYCLOAK_REDIRECT_URI']
                        ?? 'http://localhost:3000/api/auth/callback'

    const { discovery, allowInsecureRequests } = await import('openid-client')
    const issuerUrl = new URL(auth.keycloakIssuerUrl)
    const discoveryOptions = issuerUrl.protocol === 'http:'
      ? { execute: [allowInsecureRequests] }
      : undefined
    const configuration = await discovery(
      issuerUrl,
      this.clientId,
      this.clientSecret,
      undefined,
      discoveryOptions,
    )
    this.oidcConfig     = configuration
    this.serverMetadata = (configuration as unknown as { serverMetadata(): Record<string, unknown> }).serverMetadata()
    this.logger.log('OIDC discovery complete')
  }

  buildAuthorizationUrl(params: {
    state:         string
    nonce:         string
    codeVerifier:  string
    flow:          'login' | 'register'
  }): string {
    const challenge = this._buildCodeChallenge(params.codeVerifier)

    const claimsParam = JSON.stringify({
      id_token: { acr: { essential: true, values: ['2'] } },
    })

    const authEndpoint = this.serverMetadata['authorization_endpoint'] as string
    const url = new URL(authEndpoint)
    url.searchParams.set('response_type',         'code')
    url.searchParams.set('client_id',             this.clientId)
    url.searchParams.set('redirect_uri',          this.redirectUri)
    url.searchParams.set('scope',                 'openid email profile')
    url.searchParams.set('state',                 params.state)
    url.searchParams.set('nonce',                 params.nonce)
    url.searchParams.set('code_challenge',        challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('claims',                claimsParam)
    url.searchParams.set('kc_idp_hint',           'google')

    return url.toString()
  }

  async exchangeCode(params: {
    code:          string
    codeVerifier:  string
    nonce:         string
  }): Promise<{ idTokenClaims: Record<string, unknown>; refreshToken: string; idTokenRaw: string }> {
    const { authorizationCodeGrant } = await import('openid-client')

    const tokens = await authorizationCodeGrant(
      this.oidcConfig as unknown as Parameters<typeof authorizationCodeGrant>[0],
      (() => { const u = new URL(this.redirectUri); u.searchParams.set('code', params.code); return u })(),
      {
        pkceCodeVerifier: params.codeVerifier,
        expectedNonce:    params.nonce,
        expectedState:    undefined,
      },
    )

    const idTokenClaims = (tokens as unknown as { claims: () => Record<string, unknown> }).claims()
    const refreshToken  = (tokens as unknown as { refresh_token?: string }).refresh_token ?? ''
    const idTokenRaw    = (tokens as unknown as { id_token?: string }).id_token ?? ''

    return { idTokenClaims, refreshToken, idTokenRaw }
  }

  async revokeToken(token: string, tokenTypeHint: 'refresh_token' | 'access_token'): Promise<void> {
    try {
      const { tokenRevocation } = await import('openid-client')
      await tokenRevocation(
        this.oidcConfig as unknown as Parameters<typeof tokenRevocation>[0],
        { token, token_type_hint: tokenTypeHint } as unknown as Parameters<typeof tokenRevocation>[1],
      )
    } catch (err) {
      this.logger.warn(`Token revocation failed (best-effort): ${(err as Error).message}`)
    }
  }

  buildLogoutUrl(idTokenRaw: string, postLogoutRedirectUri: string): string {
    const endpoint = this.serverMetadata['end_session_endpoint'] as string | undefined
    if (!endpoint) throw new Error('end_session_endpoint not present in OIDC metadata')
    const url = new URL(endpoint)
    url.searchParams.set('id_token_hint',            idTokenRaw)
    url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)
    url.searchParams.set('client_id',                this.clientId)
    return url.toString()
  }

  private _buildCodeChallenge(verifier: string): string {
    return createHash('sha256')
      .update(verifier)
      .digest('base64url')
  }
}
