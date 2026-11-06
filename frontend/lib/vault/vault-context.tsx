'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { getVaultService, type VaultState } from '@/lib/vault/vault-service'

// ── Types ─────────────────────────────────────────────────────────────────────

export type VaultContextValue = {
  state:   VaultState
  setup:   (pin: string, masterKeyHex: string, hint?: string) => Promise<void>
  unlock:  (pin: string) => Promise<boolean>
  recover: (code: string) => Promise<boolean>
  lock:    () => void
  logout:  () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const VaultContext = createContext<VaultContextValue | null>(null)

// ── VaultProvider ─────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }): ReactNode {
  const { data: session } = useSession()
  const userId            = session?.user?.id ?? null

  // Derive the VaultService for the current user (null if not logged in yet).
  const vaultService = userId ? getVaultService(userId) : null

  const [state, setState] = useState<VaultState>(() =>
    vaultService ? vaultService.getState() : { status: 'uninitialized' },
  )

  // Re-subscribe whenever userId changes (login / logout).
  useEffect(() => {
    if (!vaultService) {
      setState({ status: 'uninitialized' })
      return
    }
    // Sync state immediately in case vaultService already has a state.
    setState(vaultService.getState())
    const unsubscribe = vaultService.subscribe(() => {
      setState(vaultService.getState())
    })
    return unsubscribe
  }, [vaultService])

  const setup = useCallback(
    (pin: string, masterKeyHex: string, hint?: string): Promise<void> => {
      if (!vaultService) return Promise.reject(new Error('Not authenticated'))
      return vaultService.setup(pin, masterKeyHex, hint)
    },
    [vaultService],
  )

  const unlock = useCallback(
    (pin: string): Promise<boolean> => {
      if (!vaultService) return Promise.resolve(false)
      return vaultService.unlock(pin)
    },
    [vaultService],
  )

  const recover = useCallback(
    (code: string): Promise<boolean> => {
      if (!vaultService) return Promise.resolve(false)
      return vaultService.recover(code)
    },
    [vaultService],
  )

  const lock = useCallback((): void => {
    vaultService?.lock()
  }, [vaultService])

  const logout = useCallback(async (): Promise<void> => {
    // Flush pending writes without notifying React state — avoids a spurious
    // redirect to /unlock before signOut navigates away to /login.
    const s = vaultService?.getState()
    if (s?.status === 'unlocked') await s.adapter.destroy()
    await signOut({ callbackUrl: '/login' })
  }, [vaultService])

  return (
    <VaultContext.Provider value={{ state, setup, unlock, recover, lock, logout }}>
      {children}
    </VaultContext.Provider>
  )
}

// ── useVaultContext ───────────────────────────────────────────────────────────

export function useVaultContext(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVaultContext must be used inside VaultProvider')
  return ctx
}

// ── AppGate ───────────────────────────────────────────────────────────────────

const VAULT_PATHS = new Set(['/setup', '/unlock'])
const AUTH_PATHS  = new Set(['/login', '/privacy'])

export function AppGate({ children }: { children: ReactNode }): ReactNode {
  const { data: session, status: authStatus } = useSession()
  const { state: vaultState }                 = useVaultContext()
  const router                                = useRouter()
  const pathname                              = usePathname()

  const isVaultPage = VAULT_PATHS.has(pathname)
  const isAuthPage  = AUTH_PATHS.has(pathname)

  useEffect(() => {
    // Still loading session — wait.
    if (authStatus === 'loading') return

    // Not logged in with Google → go to login (unless already there).
    if (!session && !isAuthPage) {
      router.replace('/login')
      return
    }

    // Logged in. Check vault state (skip on vault-setup pages to avoid loops).
    if (session && !isVaultPage && !isAuthPage) {
      if (vaultState.status === 'uninitialized') router.replace('/setup')
      else if (vaultState.status === 'locked')   router.replace('/unlock')
    }
  }, [authStatus, session, vaultState.status, router, isVaultPage, isAuthPage])

  // Show a gradient screen while loading (avoids white flash between transitions).
  if (authStatus === 'loading') return <GateScreen />

  // Always render auth pages and vault pages.
  if (isAuthPage || isVaultPage) return <>{children}</>

  // Render app only when fully authenticated + vault unlocked.
  if (session && vaultState.status === 'unlocked') return <>{children}</>

  // Waiting for redirect (e.g. session loaded but vault still uninitialized/locked).
  return <GateScreen />
}

// ── GateScreen ────────────────────────────────────────────────────────────────
// Blank screen with the app gradient — shown during session/vault loading and
// while redirects are in flight, to avoid a white flash.

function GateScreen() {
  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: 'linear-gradient(135deg, var(--gradient-start, #1E3A8A), var(--gradient-end, #6D28D9))',
    }} />
  )
}
