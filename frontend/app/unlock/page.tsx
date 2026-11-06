'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useVaultContext } from '@/lib/vault/vault-context'
import { FormModal } from '@/design-system/FormModal'
import styles from './page.module.css'

// ── PinCells ──────────────────────────────────────────────────────────────
// Rendered with key={shakeKey} so incrementing shakeKey re-mounts this
// component and restarts the CSS shake animation on every failed attempt.

interface PinCellsProps {
  digits: string[]
  shaking: boolean
}

function PinCells({ digits, shaking }: PinCellsProps) {
  return (
    <div
      role="img"
      aria-label={`PIN, ${digits.length} cifre inserite`}
      className={[styles.pinRow, shaking ? styles.pinRowShaking : ''].filter(Boolean).join(' ')}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const filled = i < digits.length
        const active = !filled && i === digits.length
        return (
          <div
            key={i}
            className={[
              styles.pinCell,
              filled ? styles.pinCellFilled : '',
              active ? styles.pinCellActive : '',
            ].filter(Boolean).join(' ')}
          >
            {filled && <div className={styles.pinDot} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Keypad ────────────────────────────────────────────────────────────────

type KeypadKey = string | null

const KEYPAD_ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['del', '0', 'ok'],
]

interface KeypadProps {
  onDigit:  (d: string) => void
  onDelete: () => void
  onSubmit: () => void
  disabled:       boolean
  submitEnabled:  boolean
}

function Keypad({ onDigit, onDelete, onSubmit, disabled, submitEnabled }: KeypadProps) {
  return (
    <div className={styles.keypad}>
      {KEYPAD_ROWS.flat().map((key) => {
        if (key === 'del') {
          return (
            <button
              key="del"
              type="button"
              className={styles.keyDel}
              onClick={onDelete}
              disabled={disabled}
              aria-label="Cancella una cifra"
            >
              ⌫
            </button>
          )
        }
        if (key === 'ok') {
          return (
            <button
              key="ok"
              type="button"
              className={styles.keyOk}
              onClick={onSubmit}
              disabled={disabled || !submitEnabled}
              aria-label="Sblocca"
            >
              ✓
            </button>
          )
        }
        return (
          <button
            key={key}
            type="button"
            className={styles.keyDigit}
            onClick={() => onDigit(key!)}
            disabled={disabled}
            aria-label={`Cifra ${key}`}
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}

// ── RecoveryModal ─────────────────────────────────────────────────────────

type RecoveryStep = 'explain' | 'input'

interface RecoveryModalProps {
  onClose:   () => void
  recover:   (code: string) => Promise<boolean>
  onSuccess: () => void
}

function RecoveryModal({ onClose, recover, onSuccess }: RecoveryModalProps) {
  const [step,        setStep]        = useState<RecoveryStep>('explain')
  const [code,        setCode]        = useState('')
  const [formatError, setFormatError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [recovering,  setRecovering]  = useState(false)

  const isValidHex = /^[0-9a-f]{64}$/.test(code)

  function handleCodeInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const raw = e.target.value.replace(/[\s\n]/g, '').toLowerCase()
    setCode(raw)
    setSubmitError(null)
    if (raw.length > 0 && /[^0-9a-f]/.test(raw)) {
      setFormatError('La chiave contiene caratteri non validi: usa solo cifre e lettere da a a f.')
    } else {
      setFormatError(null)
    }
  }

  async function handleRecover() {
    if (!isValidHex || recovering) return
    setRecovering(true)
    setSubmitError(null)
    const ok = await recover(code)
    if (ok) {
      onSuccess()
    } else {
      setRecovering(false)
      setSubmitError('Questa chiave non corrisponde. Controlla di aver copiato tutto il codice.')
    }
  }

  return (
    <FormModal
      title="Hai dimenticato il PIN?"
      confirmLabel={step === 'explain' ? 'Usa la chiave di recupero' : (recovering ? 'Sto verificando...' : 'Recupera')}
      onConfirm={step === 'explain' ? () => setStep('input') : handleRecover}
      confirmDisabled={step === 'input' && (!isValidHex || recovering)}
      onClose={onClose}
      preventScrimClose={step === 'input' && code.length > 0}
    >
      {step === 'explain' && (
        <p style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.5, color: 'rgba(255,255,255,0.88)', margin: 0 }}>
          Le tue note sono protette con il PIN: senza di lui nemmeno Agenda può leggerle.
          Per questo non esiste un &ldquo;reimposta&rdquo; automatico.
          Il codice di recupero che hai salvato durante la configurazione ti permette di accedere.
        </p>
      )}
      {step === 'input' && (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
            Chiave di recupero
            <textarea
              value={code}
              onChange={handleCodeInput}
              disabled={recovering}
              spellCheck={false}
              autoComplete="off"
              data-autofocus
              data-testid="recovery-code-input"
              style={{
                minHeight: '80px',
                borderRadius: '16px',
                padding: '12px 16px',
                border: 'none',
                background: 'rgba(255,255,255,0.14)',
                color: '#ffffff',
                fontFamily: "ui-monospace, 'Courier New', monospace",
                fontSize: '14px',
                resize: 'vertical',
              }}
            />
          </label>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.60)', margin: 0 }}>{code.length} di 64 caratteri</p>
          {formatError && (
            <p role="alert" data-testid="format-error"
               style={{ fontSize: '14px', color: '#FCA5A5', margin: 0 }}>{formatError}</p>
          )}
          {submitError && (
            <p role="alert" data-testid="submit-error"
               style={{ fontSize: '14px', color: '#FCA5A5', margin: 0 }}>{submitError}</p>
          )}
        </>
      )}
    </FormModal>
  )
}

// ── UnlockPage ────────────────────────────────────────────────────────────

export default function UnlockPage() {
  const { unlock, recover } = useVaultContext()
  const router              = useRouter()

  const [digits,    setDigits]    = useState<string[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [shakeKey,  setShakeKey]  = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [success,   setSuccess]   = useState(false)

  const ghostRef = useRef<HTMLButtonElement>(null)

  const submitEnabled = digits.length >= 6

  // ── Auto-submit at max length (9 digits) ────────────────────────────────
  useEffect(() => {
    if (digits.length === 9) handleSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits.length])

  function handleSubmit() {
    if (!submitEnabled || loading) return
    const pin = digits.join('')
    setDigits([])
    setLoading(true)
    unlock(pin).then(ok => {
      if (ok) {
        setSuccess(true)
        router.replace('/?view=menu')
      } else {
        setError('PIN non corretto. Riprova con calma.')
        setShakeKey(k => k + 1)
        setLoading(false)
      }
    })
  }

  // ── Physical keyboard ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (loading || showModal) return
      if (/^[0-9]$/.test(e.key) && digits.length < 9) {
        setError(null)
        setDigits(d => [...d, e.key])
      } else if (e.key === 'Backspace') {
        setDigits(d => d.slice(0, -1))
      } else if (e.key === 'Enter' && submitEnabled) {
        handleSubmit()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, showModal, digits.length, submitEnabled])

  function handleDigit(d: string) {
    if (loading || digits.length >= 9) return
    setError(null)
    setDigits(prev => [...prev, d])
  }

  function handleDelete() {
    if (loading) return
    setDigits(prev => prev.slice(0, -1))
  }

  function handleModalClose() {
    setShowModal(false)
    ghostRef.current?.focus()
  }

  return (
    <div
      className={styles.root}
      style={{
        '--bg-from': 'var(--gradient-start, #581c87)',
        '--bg-to':   'var(--gradient-end, #be123c)',
        '--glow-1':  'var(--gradient-start, #581c87)',
        '--glow-2':  'var(--gradient-end, #be123c)',
        '--glow-3':  'color-mix(in srgb, var(--gradient-start) 60%, var(--gradient-end))',
        '--ink':     '#140820',
      } as React.CSSProperties}
    >
      {/* Decorative glows — behind the card, aria-hidden */}
      <div className={`${styles.glow} ${styles.glow1}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} aria-hidden="true" />

      <h1 className={styles.heading}>Bentornata</h1>

      <section className={styles.card} aria-label="Sblocca Agenda">
        <div className={styles.cardHeading}>
          <h2 className={styles.cardTitle}>Sblocca Agenda</h2>
          <p className={styles.cardSubtitle}>
            {success
              ? 'Fatto, sto aprendo le tue note...'
              : 'Inserisci il tuo PIN.'}
          </p>
        </div>

        <PinCells key={shakeKey} digits={digits} shaking={shakeKey > 0} />

        {error && (
          <p role="alert" className={styles.error} data-testid="pin-error">
            {error}
          </p>
        )}

        <Keypad
            onDigit={handleDigit}
            onDelete={handleDelete}
            onSubmit={handleSubmit}
            disabled={loading}
            submitEnabled={submitEnabled}
          />

        <button
          ref={ghostRef}
          type="button"
          className={styles.ghostBtn}
          onClick={() => setShowModal(true)}
          data-testid="forgot-pin-btn"
        >
          Ho dimenticato il PIN
        </button>
      </section>

      {showModal && (
        <RecoveryModal
          onClose={handleModalClose}
          recover={recover}
          onSuccess={() => router.replace('/?view=menu')}
        />
      )}
    </div>
  )
}
