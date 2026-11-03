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

const mockPathname = { value: '/' }
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => mockPathname.value),
}))

// Import after mocks are set up
import { VaultProvider, useVaultContext, AppGate } from './vault-context'
import { useRouter } from 'next/navigation'
// mockPathname is declared in the vi.mock factory above; close over it here for test use

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

  it('unlock() delegates to vaultService.unlock() and returns boolean result', async () => {
    fakeService.setState({ status: 'locked' })
    const { result } = renderHook(() => useVaultContext(), { wrapper })

    // Test unlock success (true)
    let unlockResult: boolean
    await act(async () => {
      unlockResult = await result.current.unlock('1234')
    })

    expect(fakeService.unlock).toHaveBeenCalledWith('1234')
    expect(unlockResult).toBe(true)

    // Test unlock failure (false)
    vi.clearAllMocks()
    fakeService.unlock = vi.fn(async (_pin: string): Promise<boolean> => {
      return false
    })

    await act(async () => {
      unlockResult = await result.current.unlock('9999')
    })

    expect(fakeService.unlock).toHaveBeenCalledWith('9999')
    expect(unlockResult).toBe(false)
  })

  it('recover() delegates to vaultService.recover() and returns boolean result', async () => {
    fakeService.setState({ status: 'locked' })
    const { result } = renderHook(() => useVaultContext(), { wrapper })

    // Test recover success (true)
    let recoverResult: boolean
    await act(async () => {
      recoverResult = await result.current.recover('recovery-code-123')
    })

    expect(fakeService.recover).toHaveBeenCalledWith('recovery-code-123')
    expect(recoverResult).toBe(true)

    // Test recover failure (false)
    vi.clearAllMocks()
    fakeService.recover = vi.fn(async (_code: string): Promise<boolean> => {
      return false
    })

    await act(async () => {
      recoverResult = await result.current.recover('invalid-code')
    })

    expect(fakeService.recover).toHaveBeenCalledWith('invalid-code')
    expect(recoverResult).toBe(false)
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

describe('AppGate', () => {
  let mockReplace: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockReplace = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as ReturnType<typeof useRouter>)
  })

  it('renders children when vault state is unlocked', async () => {
    fakeService.setState({
      status: 'unlocked',
      adapter: {} as import('./vault-storage-adapter').VaultStorageAdapter,
    })

    await act(async () => {
      render(
        <VaultProvider>
          <AppGate>
            <span>protected content</span>
          </AppGate>
        </VaultProvider>,
      )
    })

    expect(screen.getByText('protected content')).toBeDefined()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('returns null and redirects to /setup when state is uninitialized', async () => {
    // fakeService default state is uninitialized
    await act(async () => {
      render(
        <VaultProvider>
          <AppGate>
            <span>protected content</span>
          </AppGate>
        </VaultProvider>,
      )
    })

    expect(screen.queryByText('protected content')).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith('/setup')
  })

  it('returns null and redirects to /unlock when state is locked', async () => {
    fakeService.setState({ status: 'locked' })

    await act(async () => {
      render(
        <VaultProvider>
          <AppGate>
            <span>protected content</span>
          </AppGate>
        </VaultProvider>,
      )
    })

    expect(screen.queryByText('protected content')).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith('/unlock')
  })

  it('renders children on /setup and /unlock regardless of vault state', async () => {
    // state is uninitialized — normally would redirect, but not on vault pages
    for (const path of ['/setup', '/unlock']) {
      mockPathname.value = path
      const { unmount } = await act(async () =>
        render(
          <VaultProvider>
            <AppGate>
              <span>vault page content</span>
            </AppGate>
          </VaultProvider>,
        ),
      )
      expect(screen.getByText('vault page content')).toBeDefined()
      expect(mockReplace).not.toHaveBeenCalled()
      unmount()
    }
    mockPathname.value = '/'
  })
})
