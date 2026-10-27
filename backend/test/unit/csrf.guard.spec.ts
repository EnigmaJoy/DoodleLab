import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CsrfGuard } from '../../src/auth/guards/csrf.guard'
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator'
import type { RequestWithSession } from '../../src/auth/types/request-with-session'
import type { SessionRecord } from '../../src/auth/types/session-record'

const VALID_TOKEN = 'valid-csrf-token-value'

function makeSession(): SessionRecord {
  return {
    user: { sub: 'u1' }, acr: '2',
    csrfToken:             VALID_TOKEN,
    encryptedRefreshToken: 'nonce:cipher:tag',
    encryptedIdToken:      'nonce:cipher:tag',
    expiresAt:             Date.now() + 60_000,
  }
}

function makeContext(options: {
  method:    string
  headers?:  Record<string, string>
  session?:  SessionRecord
  isPublic?: boolean
}): ExecutionContext {
  const req: Partial<RequestWithSession> = {
    method:  options.method,
    headers: (options.headers ?? {}) as unknown as RequestWithSession['headers'],
    session: options.session,
  }
  const isPublic = options.isPublic ?? false
  return {
    switchToHttp:  () => ({ getRequest: () => req }),
    getHandler:    () => ({}),
    getClass:      () => ({}),
    _reflectorResp: isPublic,
  } as unknown as ExecutionContext
}

function makeReflector(isPublic: boolean): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector
}

describe('CsrfGuard', () => {
  it('@Public() route -- CSRF check is skipped entirely', () => {
    const guard = new CsrfGuard(makeReflector(true))
    const ctx   = makeContext({ method: 'POST', isPublic: true })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('GET request -- CSRF check is skipped', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({ method: 'GET', session: makeSession() })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('HEAD request -- CSRF check is skipped', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({ method: 'HEAD', session: makeSession() })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('valid X-CSRF-Token header matching session.csrfToken -- guard passes', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({
      method:  'POST',
      headers: { 'x-csrf-token': VALID_TOKEN },
      session: makeSession(),
    })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('missing X-CSRF-Token header -- throws ForbiddenException', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({ method: 'POST', session: makeSession() })
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })

  it('mismatched token value -- throws ForbiddenException', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({
      method:  'DELETE',
      headers: { 'x-csrf-token': 'wrong-token' },
      session: makeSession(),
    })
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })
})
