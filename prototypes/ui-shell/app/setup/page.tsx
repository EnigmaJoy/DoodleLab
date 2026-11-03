'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVaultContext } from '@/lib/vault/vault-context'

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRecoveryCode(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── VaultSetupScreen ──────────────────────────────────────────────────────────

export default function VaultSetupPage() {
  const { setup }     = useVaultContext()
  const router        = useRouter()

  const [step,        setStep]        = useState<1 | 2>(1)
  const [pin,         setPin]         = useState('')
  const [confirmPin,  setConfirmPin]  = useState('')
  const [email,       setEmail]       = useState('')
  const [masterKeyHex, setMasterKeyHex] = useState('')
  const [saved,       setSaved]       = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // ── Step 1 handlers ──────────────────────────────────────────────────────────

  const continueEnabled = pin.length >= 6 && pin === confirmPin

  function handleContinua() {
    if (!continueEnabled) return
    const code = generateRecoveryCode()
    setMasterKeyHex(code)
    setStep(2)
  }

  // ── Step 2 handlers ──────────────────────────────────────────────────────────

  function handleCopy() {
    navigator.clipboard.writeText(masterKeyHex).catch(() => undefined)
  }

  async function handleInizia() {
    if (!saved || loading) return
    setLoading(true)
    setError(null)
    try {
      await setup(pin, masterKeyHex, email || undefined)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del vault.')
      setLoading(false)
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight:       '100vh',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         '2rem',
    background:      'linear-gradient(135deg, var(--gradient-start, #581c87), var(--gradient-end, #be123c))',
    color:           'var(--text-primary, #ffffff)',
    fontFamily:      'system-ui, sans-serif',
  }

  const cardStyle: React.CSSProperties = {
    background:   'rgba(255,255,255,0.10)',
    backdropFilter: 'blur(8px)',
    borderRadius: '1rem',
    border:       '1px solid rgba(255,255,255,0.20)',
    padding:      '2rem',
    width:        '100%',
    maxWidth:     '420px',
    display:      'flex',
    flexDirection: 'column',
    gap:          '1.25rem',
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
    padding:      '0.625rem 0.75rem',
    borderRadius: '0.5rem',
    border:       '1px solid rgba(255,255,255,0.30)',
    background:   'rgba(255,255,255,0.12)',
    color:        '#ffffff',
    fontSize:     '1rem',
    outline:      'none',
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
    background:   'rgba(255,255,255,0.18)',
    color:        '#ffffff',
    border:       '1px solid rgba(255,255,255,0.35)',
    fontWeight:   600,
    fontSize:     '0.875rem',
    padding:      '0.5rem 1rem',
  }

  const codeBlockStyle: React.CSSProperties = {
    fontFamily:   'monospace',
    fontSize:     '0.85rem',
    wordBreak:    'break-all',
    background:   'rgba(0,0,0,0.30)',
    padding:      '0.75rem',
    borderRadius: '0.5rem',
    color:        '#e2e8f0',
    letterSpacing: '0.04em',
  }

  const warningStyle: React.CSSProperties = {
    fontSize:   '0.85rem',
    color:      'rgba(255,255,255,0.80)',
    lineHeight: 1.5,
  }

  const errorStyle: React.CSSProperties = {
    fontSize:   '0.85rem',
    color:      '#fca5a5',
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          {step === 1 ? 'Crea il tuo vault' : 'Codice di recupero'}
        </h1>

        {step === 1 && (
          <>
            <label style={labelStyle}>
              PIN
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Minimo 6 caratteri"
                style={inputStyle}
                autoComplete="new-password"
                data-testid="pin-input"
              />
            </label>

            <label style={labelStyle}>
              Conferma PIN
              <input
                type="password"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                placeholder="Ripeti il PIN"
                style={inputStyle}
                autoComplete="new-password"
                data-testid="confirm-pin-input"
              />
            </label>

            <label style={labelStyle}>
              Email (opzionale)
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="la-tua@email.com"
                style={inputStyle}
                autoComplete="email"
                data-testid="email-input"
              />
            </label>

            <button
              onClick={handleContinua}
              disabled={!continueEnabled}
              style={continueEnabled ? btnPrimaryStyle : btnDisabledStyle}
              data-testid="continua-btn"
            >
              Continua
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p style={warningStyle}>
              Salva questo codice in un posto sicuro. Senza di esso e senza il PIN, i tuoi dati sono irrecuperabili.
            </p>

            <div style={codeBlockStyle} data-testid="recovery-code">
              {masterKeyHex}
            </div>

            <button
              onClick={handleCopy}
              style={btnSecondaryStyle}
              data-testid="copy-btn"
            >
              Copia
            </button>

            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={saved}
                onChange={e => setSaved(e.target.checked)}
                data-testid="saved-checkbox"
              />
              Ho salvato il codice di recupero
            </label>

            {error && <p style={errorStyle}>{error}</p>}

            <button
              onClick={handleInizia}
              disabled={!saved || loading}
              style={!saved || loading ? btnDisabledStyle : btnPrimaryStyle}
              data-testid="inizia-btn"
            >
              {loading ? 'Creazione vault...' : 'Inizia'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
