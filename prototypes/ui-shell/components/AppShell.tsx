// components/AppShell.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useVaultContext } from '@/lib/vault/vault-context'
import { WelcomeScreen } from './WelcomeScreen'
import { RadialMenu } from './RadialMenu'

export type AppView = 'WELCOME' | 'MENU_OPEN' | 'MENU_CLOSED'

interface AppShellProps {
  initialView: AppView
}

export function AppShell({ initialView }: AppShellProps) {
  const [view, setView] = useState<AppView>(initialView)
  const router          = useRouter()
  const { logout }      = useVaultContext()

  // prevViewRef distinguishes mount from genuine in-app transitions.
  // - On initial mount: prevView is null -> skip focus assignment.
  // - On Strict Mode double-invoke: prevView === view -> skip.
  // - On genuine transition: prevView !== view -> assign focus.
  const prevViewRef          = useRef<AppView | null>(null)
  const firstItemRef         = useRef<HTMLAnchorElement | null>(null)
  const firstFallbackItemRef = useRef<HTMLAnchorElement | null>(null)
  const centerButtonRef      = useRef<HTMLButtonElement | null>(null)

  // handleStart: the only transition that writes to the URL.
  // router.replace (not push) ensures Browser Back from a section lands at
  // /?view=menu rather than replaying the Welcome screen.
  function handleStart() {
    setView('MENU_OPEN')
    router.replace('/?view=menu')
  }

  // Returns the ref for the first visible menu item based on the active layout.
  // window.matchMedia detects the layout without duplicating React state.
  function getFirstMenuItemRef(): HTMLAnchorElement | null {
    if (typeof window === 'undefined') return firstItemRef.current
    const isFallback = window.matchMedia('(max-width: 500px)').matches
    return isFallback ? firstFallbackItemRef.current : firstItemRef.current
  }

  useEffect(() => {
    const prevView      = prevViewRef.current
    prevViewRef.current = view

    if (prevView === null) return   // initial mount - no focus
    if (prevView === view) return   // Strict Mode double-invoke - no focus

    if (view === 'MENU_OPEN') {
      getFirstMenuItemRef()?.focus()
    } else if (view === 'MENU_CLOSED') {
      centerButtonRef.current?.focus()
    }
  }, [view])

  return (
    <>
      <WelcomeScreen
        visible={view === 'WELCOME'}
        onStart={handleStart}
      />
      <RadialMenu
        visible={view !== 'WELCOME'}
        isOpen={view === 'MENU_OPEN'}
        onOpen={() => setView('MENU_OPEN')}
        onClose={() => setView('MENU_CLOSED')}
        firstItemRef={firstItemRef}
        firstFallbackItemRef={firstFallbackItemRef}
        centerButtonRef={centerButtonRef}
      />
      {view !== 'WELCOME' && (
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
      )}
    </>
  )
}
