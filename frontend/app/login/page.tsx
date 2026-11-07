'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { status } = useSession()
  const router     = useRouter()

  // Se già autenticati, redirect a /
  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  if (status === 'loading') return null

  return (
    <div className="login-screen">
      {/* Strati di glow fissi */}
      <div className="login-glow-top"    aria-hidden="true" />
      <div className="login-glow-bottom" aria-hidden="true" />

      <main className="login-main">
        {/* Heading accessibile */}
        <h1 className="sr-only">Welcome in Agenda</h1>

        {/* Animazione Welcome */}
        <div className="welcome-text-wrapper" aria-hidden="true">
          <span className="welcome-stroke">Welcome</span>
          <span className="welcome-fill">Welcome</span>
        </div>

        {/* Card Google */}
        <div className="login-card">
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

        {/* Footer privacy
        <p className="login-privacy">
          Continuando accetti l&apos;
          <Link href="/privacy" className="login-privacy-link">
            informativa sulla privacy
          </Link>
          {' '}di Agenda.
        </p>*/}
      </main>
    </div>
  )
}
