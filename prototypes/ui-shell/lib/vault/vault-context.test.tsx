// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

// ── Fake VaultService ─────────────────────────────────────────────────────────

class FakeVaultService {
  private _state: import('./vault-service').VaultState = { status: 'uninitialized' }
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  notify(): void {
    for (const l of this.listeners) l()
  }

  getState(): import('./vault-service').VaultState {
    return this._state
  }

  setState(s: import('./vault-service').VaultState): void {
    this._state = s
    this.notify()
  }

  setup = vi.fn(async (_pin: string, _masterKeyHex: string, _hint?: string) => {
    this._state = { status: 'locked' }   // simplified — real one goes unlocked
    this.notify()
  })

  unlock = vi.fn(async (_pin: string): Promise<boolean> => {
    this._state = { status: 'locked' }
    this.notify()
    return true
  })

  recover = vi.fn(async (_code: string): Promise<boolean> => {
    this._state = { status: 'locked' }
    this.notify()
    return true
  })

  lock = vi.fn((): void => {
    this._state = { status: 'locked' }
    this.notify()
  })
}

let fakeService: FakeVaultService

vi.mock('@/lib/vault/vault-service', () => {
  return {
    getVaultService: () => fakeService,
  }
})

vi.mock('@/lib/vault/argon2-adapter', () => ({
  deriveKey: async (password: string, salt: Uint8Array) => {
    const material = new TextEncoder().encode(
      password + Array.from(salt).join(','),
    )
    const raw = await crypto.subtle.digest('SHA-256', material)
    return crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    )
  },
}))

// Import after mocks are set up
import { VaultProvider, useVaultContext } from './vault-context'

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <VaultProvider>{children}</VaultProvider>
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  fakeService = new FakeVaultService()
  vi.clearAllMocks()
})

describe('VaultProvider', () => {
  it('exposes initial state from service', () => {
    const { result } = renderHook(() => useVaultContext(), { wrapper })
    expect(result.current.state.status).toBe('uninitialized')
  })

  it('state updates when service notifies', async () => {
    const { result } = renderHook(() => useVaultContext(), { wrapper })

    await act(async () => {
      fakeService.setState({ status: 'locked' })
    })

    expect(result.current.state.status).toBe('locked')
  })

  it('setup() calls vaultService.setup() and state updates', async () => {
    const { result } = renderHook(() => useVaultContext(), { wrapper })

    await act(async () => {
      await result.current.setup('1234', 'aabbcc112233aabbcc112233aabbcc112233aabbcc112233')
    })

    expect(fakeService.setup).toHaveBeenCalledWith(
      '1234',
      'aabbcc112233aabbcc112233aabbcc112233aabbcc112233',
      undefined,
    )
    expect(result.current.state.status).toBe('locked')
  })

  it('lock() calls vaultService.lock() and state updates', async () => {
    fakeService.setState({ status: 'locked' })
    const { result } = renderHook(() => useVaultContext(), { wrapper })

    await act(async () => {
      result.current.lock()
    })

    expect(fakeService.lock).toHaveBeenCalled()
    expect(result.current.state.status).toBe('locked')
  })
})

describe('useVaultContext', () => {
  it('throws when called outside VaultProvider', () => {
    // Suppress React's console.error for this expected throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useVaultContext())).toThrow()
    spy.mockRestore()
  })
})
