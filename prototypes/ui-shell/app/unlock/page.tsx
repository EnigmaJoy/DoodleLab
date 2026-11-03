'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVaultContext } from '@/lib/vault/vault-context'

// ── Eye icon ──────────────────────────────────────────────────────────────────

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

// ── VaultUnlockScreen ─────────────────────────────────────────────────────────

export default function VaultUnlockPage() {
  const { unlock, recover } = useVaultContext()
  const router              = useRouter()

  const [pin,          setPin]          = useState('')
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [showPin,      setShowPin]      = useState(false)

  // ── Unlock handler ────────────────────────────────────────────────────────────

  async function handleSblocca() {
    if (loading) return
    setLoading(true)
    setError(null)
    const ok = await unlock(pin)
    if (ok) {
      router.replace('/?view=menu')
    } else {
      setError('PIN non corretto')
      setLoading(false)
    }
  }

  // ── Recovery handler ──────────────────────────────────────────────────────────

  async function handleRecupera() {
    if (loading) return
    setLoading(true)
    setError(null)
    const ok = await recover(recoveryCode)
    if (ok) {
      router.replace('/?view=menu')
    } else {
      setError('Codice non valido')
      setLoading(false)
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────────

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
    gap:            '1.25rem',
  }

  const labelStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.375rem',
    fontSize:      '0.875rem',
    fontWeight:    600,
    color:         'rgba(255,255,255,0.85)',
  }

  const inputStyle: React.CSSProperties = {
    flex:         1,
    padding:      '0.625rem 2.75rem 0.625rem 0.75rem',
    borderRadius: '0.5rem',
    border:       '1px solid rgba(255,255,255,0.30)',
    background:   'rgba(255,255,255,0.12)',
    color:        '#ffffff',
    fontSize:     '1rem',
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box',
  }

  const inputWrapStyle: React.CSSProperties = {
    position: 'relative',
    display:  'flex',
  }

  const eyeBtnStyle: React.CSSProperties = {
    position:   'absolute',
    right:      '0.625rem',
    top:        '50%',
    transform:  'translateY(-50%)',
    background: 'none',
    border:     'none',
    color:      'rgba(255,255,255,0.60)',
    cursor:     'pointer',
    padding:    '0.25rem',
    display:    'flex',
    alignItems: 'center',
    lineHeight: 1,
  }

  const hintStyle: React.CSSProperties = {
    fontSize:   '0.75rem',
    color:      'rgba(255,255,255,0.55)',
    lineHeight: 1.4,
  }

  const btnPrimaryStyle: React.CSSProperties = {
    padding:      '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border:       'none',
    background:   'var(--btn-surface, rgba(255,255,255,0.90))',
    color:        'var(--btn-label, #1a1a1a)',
    fontWeight:   700,
    fontSize:     '1rem',
    cursor:       'pointer',
    transition:   'opacity 150ms ease',
  }

  const btnDisabledStyle: React.CSSProperties = {
    ...btnPrimaryStyle,
    opacity: 0.45,
    cursor:  'not-allowed',
  }

  const btnSecondaryStyle: React.CSSProperties = {
    ...btnPrimaryStyle,
    background: 'rgba(255,255,255,0.18)',
    color:      '#ffffff',
    border:     '1px solid rgba(255,255,255,0.35)',
    fontWeight: 600,
    fontSize:   '0.875rem',
    padding:    '0.5rem 1rem',
  }

  const toggleLinkStyle: React.CSSProperties = {
    background:  'none',
    border:      'none',
    color:       'rgba(255,255,255,0.70)',
    fontSize:    '0.85rem',
    cursor:      'pointer',
    padding:     0,
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    alignSelf:   'flex-start',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color:    '#fca5a5',
  }

  const dividerStyle: React.CSSProperties = {
    borderTop: '1px solid rgba(255,255,255,0.15)',
    marginTop: '0.25rem',
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Sblocca il vault
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label htmlFor="pin-input" style={labelStyle}>PIN</label>
          <div style={inputWrapStyle}>
            <input
              id="pin-input"
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="PIN"
              style={inputStyle}
              autoComplete="current-password"
              data-testid="pin-input"
            />
            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              style={eyeBtnStyle}
              tabIndex={-1}
              aria-label={showPin ? 'Nascondi PIN' : 'Mostra PIN'}
            >
              <EyeIcon visible={showPin} />
            </button>
          </div>
          <span style={hintStyle}>
            Inserisci il PIN scelto durante la configurazione
          </span>
        </div>

        {error && <p style={errorStyle} data-testid="error-msg">{error}</p>}

        <button
          onClick={handleSblocca}
          disabled={loading}
          style={loading ? btnDisabledStyle : btnPrimaryStyle}
          data-testid="sblocca-btn"
        >
          {loading ? 'Sblocco...' : 'Sblocca'}
        </button>

        <button
          onClick={() => { setShowRecovery(v => !v); setError(null) }}
          style={toggleLinkStyle}
          data-testid="recovery-toggle"
        >
          Ho dimenticato il PIN ▾
        </button>

        {showRecovery && (
          <>
            <div style={dividerStyle} />

            <label style={labelStyle}>
              Codice di recupero
              <input
                type="text"
                value={recoveryCode}
                onChange={e => setRecoveryCode(e.target.value)}
                placeholder="Incolla il tuo codice di recupero (64 caratteri)"
                maxLength={64}
                style={{ ...inputStyle, padding: '0.625rem 0.75rem' }}
                data-testid="recovery-input"
              />
            </label>

            <button
              onClick={handleRecupera}
              disabled={loading}
              style={loading ? btnDisabledStyle : btnSecondaryStyle}
              data-testid="recupera-btn"
            >
              {loading ? 'Verifica...' : 'Recupera accesso'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
