'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
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
