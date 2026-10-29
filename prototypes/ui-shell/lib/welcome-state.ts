export type AuthErrorCode = 'cancelled' | 'failed'

export type WelcomeState =
  | { kind: 'scelta'; notice: 'cancelled' | null }
  | { kind: 'reindirizzamento' }
  | { kind: 'errore'; reason: 'network' | 'failed' | 'unavailable' }

export type WelcomeEvent =
  | { type: 'SIGN_IN'; online: boolean; configured: boolean }
  | { type: 'PAGE_RESTORED' }

export function parseAuthError(v: string | string[] | undefined): AuthErrorCode | null {
  return v === 'cancelled' || v === 'failed' ? v : null
}

export function initialWelcomeState(err: AuthErrorCode | null): WelcomeState {
  if (err === 'failed') return { kind: 'errore', reason: 'failed' }
  return { kind: 'scelta', notice: err === 'cancelled' ? 'cancelled' : null }
}

export function welcomeReducer(s: WelcomeState, e: WelcomeEvent): WelcomeState {
  switch (e.type) {
    case 'SIGN_IN':
      if (s.kind === 'reindirizzamento') return s
      if (!e.configured) return { kind: 'errore', reason: 'unavailable' }
      if (!e.online) return { kind: 'errore', reason: 'network' }
      return { kind: 'reindirizzamento' }
    case 'PAGE_RESTORED':
      return s.kind === 'reindirizzamento' ? { kind: 'scelta', notice: null } : s
    default: {
      const unreachable: never = e
      void unreachable
      return s
    }
  }
}
