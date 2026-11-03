'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getVaultService, type VaultState } from '@/lib/vault/vault-service'

// ── Types ─────────────────────────────────────────────────────────────────────

export type VaultContextValue = {
  state:   VaultState
  setup:   (pin: string, masterKeyHex: string, hint?: string) => Promise<void>
  unlock:  (pin: string) => Promise<boolean>
  recover: (code: string) => Promise<boolean>
  lock:    () => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const VaultContext = createContext<VaultContextValue | null>(null)

// ── VaultProvider ─────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }): ReactNode {
  const vaultService = getVaultService()
  const [state, setState] = useState<VaultState>(() => vaultService.getState())

  useEffect(() => {
    const unsubscribe = vaultService.subscribe(() => {
      setState(vaultService.getState())
    })
    return unsubscribe
  }, [vaultService])

  const setup = (pin: string, masterKeyHex: string, hint?: string): Promise<void> =>
    vaultService.setup(pin, masterKeyHex, hint)

  const unlock = (pin: string): Promise<boolean> =>
    vaultService.unlock(pin)

  const recover = (code: string): Promise<boolean> =>
    vaultService.recover(code)

  const lock = (): void =>
    vaultService.lock()

  return (
    <VaultContext.Provider value={{ state, setup, unlock, recover, lock }}>
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

export function AppGate({ children }: { children: ReactNode }): ReactNode {
  const { state } = useVaultContext()
  const router = useRouter()
  const pathname = usePathname()
  const isVaultPage = VAULT_PATHS.has(pathname)

  useEffect(() => {
    // Never redirect when already on a vault page — avoids infinite redirect loops.
    if (isVaultPage) return
    if (state.status === 'uninitialized') router.replace('/setup')
    else if (state.status === 'locked') router.replace('/unlock')
  }, [state.status, router, isVaultPage])

  // /setup and /unlock are always rendered regardless of vault state.
  if (isVaultPage || state.status === 'unlocked') return <>{children}</>
  return null
}
