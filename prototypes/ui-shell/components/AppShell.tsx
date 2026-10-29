// components/AppShell.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import type { AppView } from '@/lib/types'
import { WelcomeScreen } from './WelcomeScreen'
import { RadialMenu } from './RadialMenu'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { AuthErrorCode } from '@/lib/welcome-state'

interface AppShellProps {
  initialView: AppView
  authError:   AuthErrorCode | null
}

export function AppShell({ initialView, authError }: AppShellProps) {
  const [view, setView] = useState<AppView>(initialView)

  const currentUser = useCurrentUser()
  void currentUser  // prevent unused-variable warning

  // prevViewRef distinguishes mount from genuine in-app transitions.
  // - On initial mount: prevView is null -> skip focus assignment.
  // - On Strict Mode double-invoke: prevView === view -> skip.
  // - On genuine transition: prevView !== view -> assign focus.
  const prevViewRef          = useRef<AppView | null>(null)
  const firstItemRef         = useRef<HTMLAnchorElement | null>(null)
  const firstFallbackItemRef = useRef<HTMLAnchorElement | null>(null)
  const centerButtonRef      = useRef<HTMLButtonElement | null>(null)

  // Increment B: redirect to NestJS /api/auth/login which initiates the Keycloak OIDC flow.
  // On successful authentication, Keycloak redirects back to /api/auth/callback, NestJS
  // creates a session, and the browser is redirected to /?view=menu.
  function handleLogin() {
    const loginUrl = process.env['NEXT_PUBLIC_AUTH_LOGIN_URL']
    if (loginUrl) {
      window.location.href = loginUrl
    }
    // AUTH_CONFIGURED=false: WelcomeScreen shows the unavailable state before calling this.
    // This handler is only reached when AUTH_CONFIGURED=true.
  }

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
      <WelcomeScreen
        visible={view === 'WELCOME'}
        authError={authError}
        onLogin={handleLogin}
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
    </>
  )
}
