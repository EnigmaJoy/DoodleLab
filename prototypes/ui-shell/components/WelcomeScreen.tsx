// components/WelcomeScreen.tsx
'use client'

import { useState, useEffect } from 'react'

// Must match the total CSS animation duration (0.3s delay + 3.6s last keyframe end).
const ANIM_TOTAL_MS = 4000

// Auth is available only when the environment variable is explicitly set to 'true'.
// Both Accedi and Registrati are disabled until a real identity provider is configured.
const AUTH_CONFIGURED = process.env['NEXT_PUBLIC_AUTH_CONFIGURED'] === 'true'

interface WelcomeScreenProps {
  visible:    boolean
  onLogin:    () => void
  onRegister: () => void
}

export function WelcomeScreen({ visible, onLogin, onRegister }: WelcomeScreenProps) {
  const [animKey,         setAnimKey]         = useState(0)
  const [buttonReady,     setButtonReady]     = useState(false)
  const [authUnavailable, setAuthUnavailable] = useState(false)

  useEffect(() => {
    setButtonReady(false)
    setAuthUnavailable(false)

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      setButtonReady(true)
      return
    }

    const t = window.setTimeout(() => setButtonReady(true), ANIM_TOTAL_MS)
    return () => window.clearTimeout(t)
  }, [animKey])

  function handleLogin() {
    if (!AUTH_CONFIGURED) { setAuthUnavailable(true); return }
    onLogin()
  }

  function handleRegister() {
    if (!AUTH_CONFIGURED) { setAuthUnavailable(true); return }
    onRegister()
  }

  return (
    <div
      className="screen welcome-screen"
      data-hidden={!visible || undefined}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
    >
      <main className="welcome-main">
        {/* Accessible heading: screen readers announce "Welcome", visual text is decorative */}
        <h1 className="sr-only">Welcome</h1>

        {/* Tap / click anywhere on the text to replay from the beginning */}
        <button
          className="welcome-replay-btn"
          type="button"
          onClick={() => setAnimKey(k => k + 1)}
          aria-label="Riproduci l'animazione di benvenuto"
        >
          <div className="welcome-text-wrapper" aria-hidden="true">
            <span key={`stroke-${animKey}`} className="welcome-stroke">Welcome</span>
            <span key={`fill-${animKey}`}   className="welcome-fill">Welcome</span>
          </div>
        </button>

        <div className="welcome-actions">
          <button
            key={`login-${animKey}`}
            className={`inizia-button${buttonReady ? ' ready' : ''}`}
            type="button"
            onClick={handleLogin}
            tabIndex={buttonReady ? 0 : -1}
            aria-hidden={buttonReady ? undefined : true}
          >
            Accedi
          </button>

          <button
            key={`register-${animKey}`}
            className={`register-button${buttonReady ? ' ready' : ''}`}
            type="button"
            onClick={handleRegister}
            tabIndex={buttonReady ? 0 : -1}
            aria-hidden={buttonReady ? undefined : true}
          >
            Prima volta qui? Registrati
          </button>

          {authUnavailable && (
            <p role="alert" className="auth-unavailable">
              Autenticazione non ancora disponibile.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
