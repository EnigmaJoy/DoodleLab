import {
  Controller, Get, Post, Req, Res, HttpCode, HttpStatus,
  Logger, Inject,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes, createHash } from 'crypto'
import type { Response } from 'express'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AuthenticatedUser } from './types/authenticated-user'
import type { RequestWithSession } from './types/request-with-session'
import { SESSION_STORE } from './types/session-store.interface'
import type { SessionStore } from './types/session-store.interface'
import { OidcClientService } from './oidc/oidc-client.service'
import { PendingAuthStore } from './providers/pending-auth.store'
import { TokenCrypto } from './token/token-crypto'
import type { AuthConfig } from '../config/auth.config'
import { authErrorRedirectUrl } from './auth-error-redirect'
import type { AuthErrorCode } from './auth-error-redirect'

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)
  private readonly crypto: TokenCrypto
  private readonly sessionTtlMs: number
  private readonly frontendAppUrl: string
  private readonly frontendUrl: string

  constructor(
    private readonly oidc:          OidcClientService,
    private readonly pendingAuth:   PendingAuthStore,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    private readonly config:        ConfigService,
  ) {
    const auth = config.get<AuthConfig>('auth')!
    this.crypto         = new TokenCrypto(auth.tokenEncryptionKey)
    this.sessionTtlMs   = (auth.sessionTtlSeconds ?? 1800) * 1000
    this.frontendAppUrl = auth.frontendAppUrl
    this.frontendUrl    = process.env['FRONTEND_URL'] ?? auth.frontendAppUrl.replace('/?view=menu', '')
    this._assertAbsoluteHttpUrl(this.frontendUrl)
  }

  @Public()
  @Get('login')
  async login(@Res() res: Response): Promise<void> {
    await this._initiateFlow('login', res)
  }

  @Public()
  @Get('register')
  async register(@Res() res: Response): Promise<void> {
    await this._initiateFlow('register', res)
  }

  @Public()
  @Get('callback')
  async callback(@Req() req: RequestWithSession, @Res() res: Response): Promise<void> {
    const cookies = req.cookies as Record<string, string>
    const txId    = cookies['auth_tx']
    if (!txId) return this._failRedirect(res, 'failed', 'missing_auth_tx')

    const query = req.query as Record<string, string>
    const state = typeof query['state'] === 'string' ? query['state'] : undefined
    if (query['error']) {
      const cancelled = query['error'] === 'access_denied'
      return this._failRedirect(res, cancelled ? 'cancelled' : 'failed', 'idp_error', txId, state)
    }

    const code = query['code']
    if (!code || !state) return this._failRedirect(res, 'failed', 'missing_code_or_state', txId, state)

    const pending = await this.pendingAuth.consume(txId, state)
    if (!pending) return this._failRedirect(res, 'failed', 'invalid_pending_auth')

    let tokenResult: Awaited<ReturnType<OidcClientService['exchangeCode']>>
    try {
      tokenResult = await this.oidc.exchangeCode({
        code,
        codeVerifier: pending.codeVerifier,
        nonce:        pending.nonce,
      })
    } catch {
      return this._failRedirect(res, 'failed', 'token_exchange')
    }

    const { idTokenClaims, refreshToken, idTokenRaw } = tokenResult
    const acr = idTokenClaims['acr'] as string | undefined
    if (acr !== '2') return this._failRedirect(res, 'failed', 'acr_not_satisfied')

    const sessionId   = randomBytes(32).toString('hex')
    const csrfToken   = randomBytes(32).toString('hex')
    const expiresAt   = Date.now() + this.sessionTtlMs

    const user: AuthenticatedUser = {
      sub:   idTokenClaims['sub']   as string,
      email: idTokenClaims['email'] as string | undefined,
      name:  idTokenClaims['name']  as string | undefined,
      acr,
    }

    await this.sessionStore.set(sessionId, {
      user,
      acr,
      csrfToken,
      encryptedRefreshToken: this.crypto.encrypt(refreshToken),
      encryptedIdToken:      this.crypto.encrypt(idTokenRaw),
      expiresAt,
    })

    res
      .cookie('auth_tx', '', {
        httpOnly: true, sameSite: 'lax', path: '/api/auth', maxAge: 0,
      })
      .cookie('session_id', sessionId, {
        httpOnly: true, sameSite: 'strict', path: '/',
      })
      .cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false, sameSite: 'strict', path: '/',
      })
      .redirect(302, this.frontendAppUrl)
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: RequestWithSession, @Res() res: Response): Promise<void> {
    const session   = req.session!
    const sessionId = req.sessionId!

    let idTokenRaw   = ''
    let refreshToken = ''
    try {
      idTokenRaw   = this.crypto.decrypt(session.encryptedIdToken)
      refreshToken = this.crypto.decrypt(session.encryptedRefreshToken)
    } catch {
      const hash = createHash('sha256').update(sessionId).digest('hex')
      this.logger.warn(`Failed to decrypt tokens for session ${hash}`)
    }

    await this.sessionStore.delete(sessionId)

    if (refreshToken) {
      await this.oidc.revokeToken(refreshToken, 'refresh_token')
    }

    const logoutUrl = this.oidc.buildLogoutUrl(idTokenRaw, this.frontendUrl)

    res
      .cookie('session_id', '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 })
      .cookie('XSRF-TOKEN', '', { httpOnly: false, sameSite: 'strict', path: '/', maxAge: 0 })
      .json({ logoutUrl })
  }

  private _assertAbsoluteHttpUrl(value: string): void {
    let ok = false
    try {
      const u = new URL(value)
      ok = u.protocol === 'http:' || u.protocol === 'https:'
    } catch { /* invalid */ }
    if (!ok) throw new Error('FRONTEND_URL must be an absolute http(s) URL')
  }

  private async _failRedirect(
    res: Response,
    code: AuthErrorCode,
    reason: string,
    txId?: string,
    state?: string,
  ): Promise<void> {
    if (txId && state) {
      try {
        await this.pendingAuth.consume(txId, state)
      } catch {
        this.logger.warn('Auth callback: pending auth consume failed during failure handling')
      }
    }
    this.logger.warn(`Auth callback failed: ${code} (${reason})`)
    res
      .cookie('auth_tx', '', {
        httpOnly: true, sameSite: 'lax', path: '/api/auth', maxAge: 0,
      })
      .redirect(302, authErrorRedirectUrl(this.frontendUrl, code))
  }

  private async _initiateFlow(flow: 'login' | 'register', res: Response): Promise<void> {
    const { id, state, nonce, codeVerifier } = await this.pendingAuth.create(flow)

    const authUrl = this.oidc.buildAuthorizationUrl({ state, nonce, codeVerifier, flow })

    res
      .cookie('auth_tx', id, {
        httpOnly: true, sameSite: 'lax', path: '/api/auth', maxAge: 600_000,
      })
      .redirect(302, authUrl)
  }
}
