'use client'

import { useCallback, useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// Durata totale animazione in ms (ultimo elemento finisce a 3.5s)
const ANIM_TOTAL_MS = 3500

export default function LoginPage() {
  const { status } = useSession()
  const router     = useRouter()

  const [animKey,     setAnimKey]     = useState(0)
  const [replayReady, setReplayReady] = useState(false)

  // Se già autenticati, redirect a /
  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  // Abilita il pulsante replay solo dopo che l'animazione è finita
  useEffect(() => {
    setReplayReady(false)
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setReplayReady(true)
      return
    }
    const t = window.setTimeout(() => setReplayReady(true), ANIM_TOTAL_MS)
    return () => window.clearTimeout(t)
  }, [animKey])

  const handleReplay = useCallback(() => setAnimKey(k => k + 1), [])

  if (status === 'loading') return null

  return (
    <div className="login-screen">
      {/* Strati di glow fissi */}
      <div className="login-glow-top"    aria-hidden="true" />
      <div className="login-glow-bottom" aria-hidden="true" />

      {/* Pulsante replay — top right */}
      <button
        className="login-replay-btn"
        type="button"
        onClick={handleReplay}
        disabled={!replayReady}
        aria-label="Rivedi animazione"
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
        </svg>
        Rivedi animazione
      </button>

      <main className="login-main">
        {/* Heading accessibile */}
        <h1 className="sr-only">Welcome in Agenda</h1>

        {/* Animazione Welcome */}
        <div className="welcome-text-wrapper" aria-hidden="true">
          <span key={`stroke-${animKey}`} className="welcome-stroke">Welcome</span>
          <span key={`fill-${animKey}`}   className="welcome-fill">Welcome</span>
        </div>

        {/* Card Google — key forza rimount ad ogni replay */}
        <div key={`card-${animKey}`} className="login-card">
          <p className="login-card-title">
            Il tuo spazio per giorni, pensieri e idee.
          </p>
          <p className="login-card-sub">
            Accedi per ritrovare Agenda su tutti i tuoi dispositivi.
          </p>
          <button
            type="button"
            className="login-google-btn"
            onClick={() => signIn('google', { callbackUrl: '/' })}
            data-testid="google-signin-btn"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.1 29.5 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"/>
              <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.4 19.1 13 24 13c3.1 0 5.9 1.1 8 3l6-6C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
              <path fill="#FBBC05" d="M24 44c5.4 0 10.3-1.8 14-4.9l-6.5-5.4C29.5 35.5 26.9 36 24 36c-5.4 0-10-3.4-11.6-8.1l-7 5.4C8.9 39.9 15.9 44 24 44z"/>
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.9 2.5-2.6 4.6-4.9 5.9l6.5 5.4C41.2 36.3 44.5 30.7 44.5 24c0-1.3-.1-2.7-.2-4z"/>
            </svg>
            Accedi con Google
          </button>
        </div>

        {/* Footer privacy */}
        <p key={`footer-${animKey}`} className="login-privacy">
          Continuando accetti l&apos;
          <a href="#" className="login-privacy-link" onClick={e => e.preventDefault()}>
            informativa sulla privacy
          </a>
          {' '}di Agenda.
        </p>
      </main>
    </div>
  )
}
