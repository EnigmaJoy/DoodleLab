// components/WelcomeScreen.tsx
'use client'

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { WELCOME_PATH } from '@/lib/welcome-path'
import {
  initialWelcomeState,
  welcomeReducer,
  type AuthErrorCode,
  type WelcomeState,
} from '@/lib/welcome-state'
import { GoogleSignInButton } from './GoogleSignInButton'
import { AlertIcon, CalendarIcon, LockIcon } from './welcome-icons'

// Sign-in is available only when the environment variable is explicitly set to 'true'.
const AUTH_CONFIGURED = process.env['NEXT_PUBLIC_AUTH_CONFIGURED'] === 'true'

// The intro is gated before first paint by public/welcome-intro.js (html[data-welcome-intro]);
// this component never toggles it, so the base styles are always the final visible state.

const ERROR_COPY: Record<Extract<WelcomeState, { kind: 'errore' }>['reason'], string> = {
  network:     'Non riesco a raggiungere Google in questo momento. Controlla la connessione e riprova.',
  failed:      "Non è stato possibile completare l'accesso. Riprova.",
  unavailable: 'Autenticazione non ancora disponibile.',
}

const FILL_D = WELCOME_PATH.strokes.map(s => s.d).join('')

// SSR has no layout; fall back to useEffect there to avoid the server warning.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

interface WelcomeScreenProps {
  visible:         boolean
  authError:       AuthErrorCode | null
  onLogin:         () => void
  authConfigured?: boolean
}

export function WelcomeScreen({
  visible,
  authError,
  onLogin,
  authConfigured = AUTH_CONFIGURED,
}: WelcomeScreenProps) {
  const [state, dispatch] = useReducer(welcomeReducer, authError, initialWelcomeState)
  const loginCalledRef    = useRef(false)
  const cardRef           = useRef<HTMLDivElement | null>(null)
  const cardInnerRef      = useRef<HTMLDivElement | null>(null)
  // The 200ms content cross-fade runs only after the first state change, so the first paint
  // is already the final visible state. Idempotent ref update: safe under double render.
  const initialKindRef    = useRef(state.kind)
  const swappedRef        = useRef(false)
  // Counts sign-in attempts: keys the role=alert so a repeated failure is announced again.
  const [attempt, setAttempt] = useState(0)
  if (state.kind !== initialKindRef.current) swappedRef.current = true

  // Call the login handler exactly once per entry into the redirect state.
  useEffect(() => {
    if (state.kind !== 'reindirizzamento') {
      loginCalledRef.current = false
      return
    }
    if (loginCalledRef.current) return
    loginCalledRef.current = true
    onLogin()
  }, [state.kind, onLogin])

  // Back/forward cache restore: the page comes back still busy; reset it.
  useEffect(() => {
    function onPageShow(e: Event) {
      if ((e as PageTransitionEvent).persisted) dispatch({ type: 'PAGE_RESTORED' })
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // auth_error is read once (server-side) and removed from the URL, keeping other params.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('auth_error')) return
    url.searchParams.delete('auth_error')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])

  // Smooth card height between states: measure the content and drive height via a CSS var.
  useIsoLayoutEffect(() => {
    const card  = cardRef.current
    const inner = cardInnerRef.current
    if (!card || !inner || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      // Fractional layout height (offsetHeight rounds to an integer).
      card.style.setProperty('--welcome-card-h', `${inner.getBoundingClientRect().height}px`)
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  function handleSignIn() {
    setAttempt(n => n + 1)
    dispatch({ type: 'SIGN_IN', online: navigator.onLine, configured: authConfigured })
  }

  const busy    = state.kind === 'reindirizzamento'
  const isError = state.kind === 'errore'

  return (
    <div
      className="screen welcome-screen"
      data-hidden={!visible || undefined}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
    >
      <main className="welcome-main">
        <h1 className="sr-only">Welcome in Agenda</h1>

        <svg
          className="welcome-handwriting"
          viewBox={WELCOME_PATH.viewBox}
          aria-hidden="true"
          focusable="false"
        >
          <g className="welcome-handwriting-strokes">
            {WELCOME_PATH.strokes.map((s, i) => (
              <path
                key={i}
                d={s.d}
                style={{
                  '--len':   s.length,
                  '--delay': `${s.delayMs}ms`,
                  '--dur':   `${s.durationMs}ms`,
                } as CSSProperties}
              />
            ))}
          </g>
          <g className="welcome-handwriting-fill">
            <path d={FILL_D} />
          </g>
        </svg>

        <div className="welcome-card-wrap">
          <div className="welcome-glow welcome-glow--1" aria-hidden="true" />
          <div className="welcome-glow welcome-glow--2" aria-hidden="true" />
          <div className="welcome-glow welcome-glow--3" aria-hidden="true" />

          <div ref={cardRef} className="welcome-card">
            <div ref={cardInnerRef} className="welcome-card-inner" aria-live="polite">
              <div className="welcome-card-content">
                {/* Only the non-interactive message is keyed (cross-fade on state change).
                    The Google button below stays the same DOM node, so focus survives. */}
                <div
                  key={state.kind}
                  className={`welcome-card-message${swappedRef.current ? ' welcome-card-content--swap' : ''}`}
                >
                  {isError && (
                    <div className="welcome-error-icon" aria-hidden="true">
                      <AlertIcon />
                    </div>
                  )}
                  <h2 className="welcome-card-title">
                    {isError ? 'Accesso non completato' : 'Il tuo spazio per giorni, pensieri e idee.'}
                  </h2>

                  {state.kind === 'errore' ? (
                    <p key={`alert-${attempt}`} role="alert" className="welcome-card-text">
                      {ERROR_COPY[state.reason]}
                    </p>
                  ) : (
                    <p className="welcome-card-text">
                      Accedi per ritrovare Agenda su tutti i tuoi dispositivi.
                    </p>
                  )}
                </div>

                <GoogleSignInButton
                  label={isError ? 'Riprova ad accedere con Google' : 'Accedi con Google'}
                  busy={busy}
                  onClick={handleSignIn}
                />

                {busy && (
                  <div className="welcome-busy">
                    <span className="welcome-spinner" aria-hidden="true" />
                    <p role="status" className="welcome-card-status">
                      Reindirizzamento all&apos;accesso sicuro…
                    </p>
                  </div>
                )}
                {state.kind === 'scelta' && state.notice === 'cancelled' && (
                  <p role="status" className="welcome-card-status">
                    Accesso annullato: puoi riprovare quando vuoi.
                  </p>
                )}

                {/* TODO(D-19): "Usa Agenda senza account, per ora" ghost action goes here,
                    hidden until the guest mode decision D-19 is made. */}

                <ul className="welcome-info">
                  <li className="welcome-info-row">
                    <LockIcon className="welcome-info-icon" />
                    <span>
                      Note, diario ed esercizi restano in Agenda e{' '}
                      <strong>non vengono mai inviati a Google</strong>.
                    </span>
                  </li>
                  <li className="welcome-info-row">
                    <CalendarIcon className="welcome-info-icon" />
                    <span>Il calendario lo colleghi dopo, solo se vuoi.</span>
                  </li>
                </ul>

                {/* TODO(privacy): restore "Continuando accetti l'informativa sulla privacy di
                    Agenda." with a working link once the notice is published (spec section 5). */}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
