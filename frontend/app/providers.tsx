'use client'

import { SessionProvider } from 'next-auth/react'
import { VaultProvider, AppGate } from '@/lib/vault/vault-context'
import { PreferencesProvider } from '@/lib/PreferencesContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <VaultProvider>
        <AppGate>
          <PreferencesProvider>
            {children}
          </PreferencesProvider>
        </AppGate>
      </VaultProvider>
    </SessionProvider>
  )
}
