'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router                    = useRouter()

  // If already authenticated, redirect to home.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  const containerStyle: React.CSSProperties = {
    minHeight:      '100vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '2rem',
    background:     'linear-gradient(135deg, var(--gradient-start, #581c87), var(--gradient-end, #be123c))',
    color:          'var(--text-primary, #ffffff)',
    fontFamily:     'system-ui, sans-serif',
  }

  const cardStyle: React.CSSProperties = {
    background:     'rgba(255,255,255,0.10)',
    backdropFilter: 'blur(8px)',
    borderRadius:   '1rem',
    border:         '1px solid rgba(255,255,255,0.20)',
    padding:        '2rem',
    width:          '100%',
    maxWidth:       '420px',
    display:        'flex',
    flexDirection:  'column',
    gap:            '1.5rem',
    alignItems:     'center',
  }

  const btnStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    gap:            '0.75rem',
    padding:        '0.75rem 1.5rem',
    borderRadius:   '0.5rem',
    border:         'none',
    background:     'var(--btn-surface, rgba(255,255,255,0.90))',
    color:          'var(--btn-label, #1a1a1a)',
    fontWeight:     700,
    fontSize:       '1rem',
    cursor:         'pointer',
    width:          '100%',
    justifyContent: 'center',
    transition:     'opacity 150ms ease',
  }

  if (status === 'loading') return null

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>agenda</h1>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
          Accedi per aprire il tuo vault personale
        </p>
        <button
          style={btnStyle}
          onClick={() => signIn('google', { callbackUrl: '/' })}
          data-testid="google-signin-btn"
        >
          {/* Google "G" logo */}
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.1 29.5 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"/>
            <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.4 19.1 13 24 13c3.1 0 5.9 1.1 8 3l6-6C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#FBBC05" d="M24 44c5.4 0 10.3-1.8 14-4.9l-6.5-5.4C29.5 35.5 26.9 36 24 36c-5.4 0-10-3.4-11.6-8.1l-7 5.4C8.9 39.9 15.9 44 24 44z"/>
            <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.9 2.5-2.6 4.6-4.9 5.9l6.5 5.4C41.2 36.3 44.5 30.7 44.5 24c0-1.3-.1-2.7-.2-4z"/>
          </svg>
          Accedi con Google
        </button>
      </div>
    </div>
  )
}
