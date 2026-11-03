'use client'

import { SessionProvider } from 'next-auth/react'
import { VaultProvider, AppGate } from '@/lib/vault/vault-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <VaultProvider>
        <AppGate>
          {children}
        </AppGate>
      </VaultProvider>
    </SessionProvider>
  )
}
