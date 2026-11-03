// components/AppShell.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useVaultContext } from '@/lib/vault/vault-context'
import { RadialMenu } from './RadialMenu'

export type AppView = 'MENU_OPEN' | 'MENU_CLOSED'

interface AppShellProps {
  initialView: AppView
}

export function AppShell({ initialView }: AppShellProps) {
  const [view, setView] = useState<AppView>(initialView)
  const { logout }      = useVaultContext()

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
        firstItemRef={firstItemRef}
        firstFallbackItemRef={firstFallbackItemRef}
        centerButtonRef={centerButtonRef}
      />
      <button
        onClick={logout}
        style={{
          position:     'fixed',
          bottom:       '1.5rem',
          right:        '1.5rem',
          zIndex:       3,
          background:   'rgba(255,255,255,0.12)',
          border:       '1px solid rgba(255,255,255,0.25)',
          borderRadius: '0.5rem',
          color:        'rgba(255,255,255,0.75)',
          fontSize:     '0.8rem',
          padding:      '0.4rem 0.75rem',
          cursor:       'pointer',
        }}
        aria-label="Esci"
      >
        Esci
      </button>
    </>
  )
}
