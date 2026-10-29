import { describe, expect, it } from 'vitest'
import {
  initialWelcomeState,
  parseAuthError,
  welcomeReducer,
  type WelcomeState,
} from '@/lib/welcome-state'

const scelta: WelcomeState = { kind: 'scelta', notice: null }
const errore: WelcomeState = { kind: 'errore', reason: 'failed' }
const redirecting: WelcomeState = { kind: 'reindirizzamento' }

describe('initialWelcomeState', () => {
  it('null -> scelta without notice', () => {
    expect(initialWelcomeState(null)).toEqual({ kind: 'scelta', notice: null })
  })
  it('cancelled -> scelta with notice (not an error)', () => {
    expect(initialWelcomeState('cancelled')).toEqual({ kind: 'scelta', notice: 'cancelled' })
  })
  it('failed -> errore failed', () => {
    expect(initialWelcomeState('failed')).toEqual({ kind: 'errore', reason: 'failed' })
  })
})

describe('welcomeReducer SIGN_IN', () => {
  const online = { type: 'SIGN_IN', online: true, configured: true } as const
  const offline = { type: 'SIGN_IN', online: false, configured: true } as const

  it('online from scelta or errore -> reindirizzamento', () => {
    expect(welcomeReducer(scelta, online)).toEqual(redirecting)
    expect(welcomeReducer(errore, online)).toEqual(redirecting)
  })
  it('offline -> errore network', () => {
    expect(welcomeReducer(scelta, offline)).toEqual({ kind: 'errore', reason: 'network' })
    expect(welcomeReducer(errore, offline)).toEqual({ kind: 'errore', reason: 'network' })
  })
  it('not configured -> errore unavailable regardless of online', () => {
    const unavailable = { kind: 'errore', reason: 'unavailable' }
    expect(welcomeReducer(scelta, { ...online, configured: false })).toEqual(unavailable)
    expect(welcomeReducer(errore, { ...offline, configured: false })).toEqual(unavailable)
    expect(welcomeReducer(errore, { ...online, configured: false })).toEqual(unavailable)
  })
  it('unavailable takes precedence over offline', () => {
    expect(welcomeReducer(scelta, { type: 'SIGN_IN', online: false, configured: false })).toEqual({
      kind: 'errore',
      reason: 'unavailable',
    })
  })
  it('retry from errore network or unavailable -> reindirizzamento', () => {
    expect(welcomeReducer({ kind: 'errore', reason: 'network' }, online)).toEqual(redirecting)
    expect(welcomeReducer({ kind: 'errore', reason: 'unavailable' }, online)).toEqual(redirecting)
  })
  it('from scelta with cancelled notice -> reindirizzamento', () => {
    expect(welcomeReducer({ kind: 'scelta', notice: 'cancelled' }, online)).toEqual(redirecting)
  })
  it('while reindirizzamento returns the same object', () => {
    expect(welcomeReducer(redirecting, online)).toBe(redirecting)
    expect(welcomeReducer(redirecting, offline)).toBe(redirecting)
    expect(welcomeReducer(redirecting, { ...online, configured: false })).toBe(redirecting)
  })
})

describe('welcomeReducer PAGE_RESTORED', () => {
  it('from reindirizzamento -> scelta without notice', () => {
    expect(welcomeReducer(redirecting, { type: 'PAGE_RESTORED' })).toEqual(scelta)
  })
  it('from other states -> unchanged', () => {
    expect(welcomeReducer(scelta, { type: 'PAGE_RESTORED' })).toBe(scelta)
    expect(welcomeReducer(errore, { type: 'PAGE_RESTORED' })).toBe(errore)
    const cancelled: WelcomeState = { kind: 'scelta', notice: 'cancelled' }
    expect(welcomeReducer(cancelled, { type: 'PAGE_RESTORED' })).toBe(cancelled)
  })
})

describe('parseAuthError', () => {
  it('accepts allowlisted values', () => {
    expect(parseAuthError('cancelled')).toBe('cancelled')
    expect(parseAuthError('failed')).toBe('failed')
  })
  it('rejects everything else', () => {
    for (const v of ['Cancelled', '<script>', '', undefined, ['failed', 'cancelled'], ['failed']]) {
      expect(parseAuthError(v)).toBeNull()
    }
  })
})
