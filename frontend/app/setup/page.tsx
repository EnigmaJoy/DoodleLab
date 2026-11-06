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

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRecoveryCode(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── VaultSetupScreen ──────────────────────────────────────────────────────────

export default function VaultSetupPage() {
  const { setup }     = useVaultContext()
  const router        = useRouter()

  const [step,         setStep]         = useState<1 | 2>(1)
  const [pin,          setPin]          = useState('')
  const [confirmPin,   setConfirmPin]   = useState('')
  const [email,        setEmail]        = useState('')
  const [masterKeyHex, setMasterKeyHex] = useState('')
  const [saved,        setSaved]        = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [showPin,      setShowPin]      = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)

  // ── Step 1 handlers ──────────────────────────────────────────────────────────

  const continueEnabled = pin.length >= 6 && pin.length <= 9 && pin === confirmPin
  const pinMismatch     = confirmPin.length > 0 && pin !== confirmPin

  function handleContinua() {
    if (!continueEnabled) return
    setMasterKeyHex(generateRecoveryCode())
    setStep(2)
  }

  // ── Step 2 handlers ──────────────────────────────────────────────────────────

  function handleCopy() {
    navigator.clipboard.writeText(masterKeyHex).then(() => setCopied(true)).catch(() => undefined)
  }

  async function handleInizia() {
    if (!saved || loading) return
    setLoading(true)
    setError(null)
    try {
      await setup(pin, masterKeyHex, email || undefined)
      router.replace('/?view=menu')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del vault.')
      setLoading(false)
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight:      '100vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '2rem',
    background:     'linear-gradient(135deg, var(--gradient-start, #1E3A8A), var(--gradient-end, #6D28D9))',
    color:          'var(--text-primary, #ffffff)',
    fontFamily:     'var(--font-figtree, system-ui, sans-serif)',
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

  const fieldStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.375rem',
  }

  const labelTextStyle: React.CSSProperties = {
    fontSize:   '0.875rem',
    fontWeight: 600,
    color:      'rgba(255,255,255,0.85)',
  }

  const inputWrapStyle: React.CSSProperties = {
    position: 'relative',
    display:  'flex',
  }

  const inputStyle: React.CSSProperties = {
    flex:         1,
    padding:      '0.625rem 2.75rem 0.625rem 0.75rem',
    borderRadius: '16px',
    border:       '1px solid rgba(255,255,255,0.30)',
    background:   'rgba(255,255,255,0.12)',
    color:        '#ffffff',
    fontSize:     '1rem',
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box',
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

  const mismatchStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color:    '#fca5a5',
  }

  const matchStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color:    '#86efac',
  }

  const labelStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.375rem',
    fontSize:      '0.875rem',
    fontWeight:    600,
    color:         'rgba(255,255,255,0.85)',
  }

  const btnPrimaryStyle: React.CSSProperties = {
    height:       '48px',
    padding:      '0 1.5rem',
    borderRadius: '24px',
    border:       'none',
    background:   'var(--btn-surface, rgba(255,255,255,0.90))',
    color:        'var(--btn-label, #1a1a1a)',
    fontWeight:   700,
    fontSize:     '15px',
    cursor:       'pointer',
    transition:   'opacity 150ms ease',
  }

  const btnDisabledStyle: React.CSSProperties = {
    ...btnPrimaryStyle,
    opacity: 0.5,
    cursor:  'not-allowed',
  }

  const btnSecondaryStyle: React.CSSProperties = {
    ...btnPrimaryStyle,
    background: 'rgba(255,255,255,0.16)',
    color:      '#ffffff',
    border:     'none',
    fontWeight: 600,
  }

  const codeBlockStyle: React.CSSProperties = {
    fontFamily:    'monospace',
    fontSize:      '0.85rem',
    wordBreak:     'break-all',
    background:    'rgba(0,0,0,0.30)',
    padding:       '0.75rem',
    borderRadius:  '0.5rem',
    color:         '#e2e8f0',
    letterSpacing: '0.04em',
  }

  const warningStyle: React.CSSProperties = {
    fontSize:   '0.85rem',
    color:      'rgba(255,255,255,0.80)',
    lineHeight: 1.5,
  }

  const errorStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color:    '#fca5a5',
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
            {/* ── PIN ─────────────────────────────────────────────────────── */}
            <div style={fieldStyle}>
              <label htmlFor="pin-input" style={labelTextStyle}>PIN</label>
              <div style={inputWrapStyle}>
                <input
                  id="pin-input"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="6–9 cifre"
                  inputMode="numeric"
                  style={inputStyle}
                  autoComplete="new-password"
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
                Solo numeri · minimo 6, massimo 9 cifre
              </span>
            </div>

            {/* ── Conferma PIN ─────────────────────────────────────────────── */}
            <div style={fieldStyle}>
              <label htmlFor="confirm-pin-input" style={labelTextStyle}>Conferma PIN</label>
              <div style={inputWrapStyle}>
                <input
                  id="confirm-pin-input"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="Ripeti il PIN"
                  inputMode="numeric"
                  style={inputStyle}
                  autoComplete="new-password"
                  data-testid="confirm-pin-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={eyeBtnStyle}
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Nascondi conferma' : 'Mostra conferma'}
                >
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>
              {pinMismatch && (
                <span style={mismatchStyle}>I PIN non coincidono</span>
              )}
              {confirmPin.length > 0 && !pinMismatch && (
                <span style={matchStyle}>✓ I PIN coincidono</span>
              )}
            </div>

            {/* ── Email ───────────────────────────────────────────────────── */}
            <label style={labelStyle}>
              Email <span style={{ fontWeight: 400, opacity: 0.7 }}>(opzionale)</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="la-tua@email.com"
                style={{ ...inputStyle, padding: '0.625rem 0.75rem' }}
                autoComplete="email"
                data-testid="email-input"
              />
              <span style={hintStyle}>
                Usata come promemoria in caso di recupero futuro, non viene condivisa
              </span>
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
              disabled={copied}
              style={copied ? { ...btnSecondaryStyle, opacity: 0.65, cursor: 'not-allowed' } : btnSecondaryStyle}
              data-testid="copy-btn"
            >
              {copied ? 'Copiato ✓' : 'Copia'}
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
