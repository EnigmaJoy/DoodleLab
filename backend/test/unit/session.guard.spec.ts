import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SessionGuard } from '../../src/auth/guards/session.guard'
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator'
import { SKIP_MFA_KEY } from '../../src/auth/decorators/skip-mfa.decorator'
import type { SessionRecord } from '../../src/auth/types/session-record'
import type { SessionStore } from '../../src/auth/types/session-store.interface'

const REQUIRED_ACR = '2'

// --- helpers ---

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    user:      { sub: 'user-abc', acr: REQUIRED_ACR },
    acr:       REQUIRED_ACR,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  }
}

function makeContext(options: {
  cookies?: Record<string, string>
}): ExecutionContext {
  const request = { cookies: options.cookies ?? {}, user: undefined as unknown }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler:   () => ({}),
    getClass:     () => ({}),
    _request:     request,
  } as unknown as ExecutionContext
}

function makeReflector(metadata: Record<string, boolean>): Reflector {
  return {
    getAllAndOverride: (_key: string) => metadata[_key] ?? false,
  } as unknown as Reflector
}

function makeStore(session?: SessionRecord): SessionStore {
  return {
    get:    async (_id: string) => session,
    set:    async () => undefined,
    delete: async () => undefined,
  }
}

// --- tests ---

describe('SessionGuard', () => {
  describe('@Public() routes', () => {
    it('allows requests to @Public() routes without any cookie', async () => {
      const guard = new SessionGuard(
        makeReflector({ [IS_PUBLIC_KEY]: true }),
        makeStore(),
        REQUIRED_ACR,
      )
      const ctx = makeContext({})
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
    })
  })

  describe('missing or invalid session', () => {
    it('throws UnauthorizedException when no session cookie is present', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: {} })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('throws UnauthorizedException when session cookie is present but not in the store', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(undefined),  // store returns undefined
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'unknown-id' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('throws UnauthorizedException when the session is expired', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord({ expiresAt: Date.now() - 1000 })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'expired-id' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('throws UnauthorizedException when the session expires at exactly this millisecond', async () => {
      const now = Date.now()
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord({ expiresAt: now })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'at-boundary' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('MFA assurance', () => {
    it('throws UnauthorizedException when the session ACR is absent', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord({ acr: '' })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'session-1' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('throws UnauthorizedException when the session ACR does not match the required value', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord({ acr: '1' })),  // '1' is basic auth, not TOTP
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'session-2' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('allows a valid session with the correct ACR value', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord()),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'valid-session' } }) as unknown as ExecutionContext & { _request: { user: unknown } }
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      // User is attached to the request
      expect((ctx as unknown as { _request: { user: unknown } })._request.user).toMatchObject({ sub: 'user-abc' })
    })
  })

  describe('@SkipMfa() routes', () => {
    it('allows a valid session without the required ACR on a @SkipMfa() route', async () => {
      const guard = new SessionGuard(
        makeReflector({ [SKIP_MFA_KEY]: true }),
        makeStore(makeRecord({ acr: '1' })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'low-acr-session' } })
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
    })

    it('still throws UnauthorizedException on @SkipMfa() when no cookie is present', async () => {
      const guard = new SessionGuard(
        makeReflector({ [SKIP_MFA_KEY]: true }),
        makeStore(),
        REQUIRED_ACR,
      )
      const ctx = makeContext({})
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('still throws UnauthorizedException on @SkipMfa() when the session is expired', async () => {
      const guard = new SessionGuard(
        makeReflector({ [SKIP_MFA_KEY]: true }),
        makeStore(makeRecord({ expiresAt: Date.now() - 1000 })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'expired' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('error response sanitization', () => {
    it('throws a plain UnauthorizedException without leaking session or token details', async () => {
      const guard = new SessionGuard(makeReflector({}), makeStore(), REQUIRED_ACR)
      const ctx   = makeContext({ cookies: { session_id: 'bad' } })
      let caught: unknown
      try {
        await guard.canActivate(ctx)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(UnauthorizedException)
      const body = (caught as UnauthorizedException).getResponse()
      expect(body).toEqual({ statusCode: 401, message: 'Unauthorized' })
    })
  })
})
