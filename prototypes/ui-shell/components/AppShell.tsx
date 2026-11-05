// components/AppShell.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useVaultContext } from '@/lib/vault/vault-context'
import { RadialMenu } from './RadialMenu'
import { ExitModal } from './ExitModal'

export type AppView = 'MENU_OPEN' | 'MENU_CLOSED'

interface AppShellProps {
  initialView: AppView
}

export function AppShell({ initialView }: AppShellProps) {
  const [view, setView]               = useState<AppView>(initialView)
  const [exitModalOpen, setExitModal] = useState(false)
  const { logout }                    = useVaultContext()

  const prevViewRef          = useRef<AppView | null>(null)
  const firstItemRef         = useRef<HTMLAnchorElement | null>(null)
  const firstFallbackItemRef = useRef<HTMLAnchorElement | null>(null)
  const centerButtonRef      = useRef<HTMLButtonElement | null>(null)

  function getFirstMenuItemRef(): HTMLAnchorElement | null {
    if (typeof window === 'undefined') return firstItemRef.current
    const isFallback = window.matchMedia('(max-width: 500px)').matches
    return isFallback ? firstFallbackItemRef.current : firstItemRef.current
  }

  useEffect(() => {
    const prevView      = prevViewRef.current
    prevViewRef.current = view

    if (prevView === null) return
    if (prevView === view) return

    if (view === 'MENU_OPEN') {
      getFirstMenuItemRef()?.focus()
    } else if (view === 'MENU_CLOSED') {
      centerButtonRef.current?.focus()
    }
  }, [view])

  return (
    <>
      <RadialMenu
        visible={true}
        isOpen={view === 'MENU_OPEN'}
        onOpen={() => setView('MENU_OPEN')}
        onClose={() => setView('MENU_CLOSED')}
        onExitRequest={() => { setView('MENU_CLOSED'); setExitModal(true) }}
        firstItemRef={firstItemRef}
        firstFallbackItemRef={firstFallbackItemRef}
        centerButtonRef={centerButtonRef}
      />
      <ExitModal
        isOpen={exitModalOpen}
        onClose={() => setExitModal(false)}
        onConfirm={logout}
      />
    </>
  )
}
