'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useVaultContext } from '@/lib/vault/vault-context'
import styles from './page.module.css'

// ── PinCells ──────────────────────────────────────────────────────────────
// Rendered with key={shakeKey} so incrementing shakeKey re-mounts this
// component and restarts the CSS shake animation on every failed attempt.

interface PinCellsProps {
  digits: string[]
}

function PinCells({ digits }: PinCellsProps) {
  return (
    <div
      role="img"
      aria-label={`PIN, ${digits.length} cifre su 6 inserite`}
      className={styles.pinRow}
    >
      {Array.from({ length: 6 }, (_, i) => {
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
  [null, '0', 'del'],
]

interface KeypadProps {
  onDigit: (d: string) => void
  onDelete: () => void
  disabled: boolean
}

function Keypad({ onDigit, onDelete, disabled }: KeypadProps) {
  return (
    <div className={styles.keypad}>
      {KEYPAD_ROWS.flat().map((key, idx) => {
        if (key === null) {
          return <div key={idx} aria-hidden="true" />
        }
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
              Cancella
            </button>
          )
        }
        return (
          <button
            key={key}
            type="button"
            className={styles.keyDigit}
            onClick={() => onDigit(key)}
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
  onClose: () => void
  recover: (code: string) => Promise<boolean>
  onSuccess: () => void
}

function RecoveryModal({ onClose, recover, onSuccess }: RecoveryModalProps) {
  const [step,        setStep]        = useState<RecoveryStep>('explain')
  const [code,        setCode]        = useState('')
  const [formatError, setFormatError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [recovering,  setRecovering]  = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const isValidHex = /^[0-9a-f]{64}$/.test(code)

  // Focus the close button on open
  useEffect(() => {
    closeBtnRef.current?.focus()
  }, [])

  // Focus textarea when entering step 2
  useEffect(() => {
    if (step === 'input') {
      textareaRef.current?.focus()
    }
  }, [step])

  // Escape closes the modal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleCodeInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const raw = e.target.value.replace(/[\s\n]/g, '').toLowerCase()
    setCode(raw)
    setSubmitError(null)
    if (raw.length > 0 && /[^0-9a-f]/.test(raw)) {
      setFormatError(
        'La chiave contiene caratteri non validi: usa solo cifre e lettere da a a f.'
      )
    } else {
      setFormatError(null)
    }
  }

  async function handleRecover() {
    if (!isValidHex || recovering) return
    setRecovering(true)
    setSubmitError(null)
    const snapshot = code
    const ok = await recover(snapshot)
    if (ok) {
      onSuccess()
    } else {
      setRecovering(false)
      setSubmitError(
        'Questa chiave non corrisponde. Controlla di aver copiato tutto il codice.'
      )
      textareaRef.current?.focus()
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="modal-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-modal-title"
        className={styles.modal}
      >
        <div className={styles.modalHeader}>
          <h2 id="recovery-modal-title" className={styles.modalTitle}>
            Hai dimenticato il PIN?
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {step === 'explain' && (
          <div className={styles.modalBody}>
            <p className={styles.modalExplain}>
              Le tue note sono protette con il PIN: senza di lui nemmeno Agenda può leggerle.
              Per questo non esiste un &ldquo;reimposta&rdquo; automatico.
            </p>
            <div className={styles.recoveryCta}>
              <button
                type="button"
                className={styles.recoveryPrimaryBtn}
                onClick={() => setStep('input')}
              >
                Usa la chiave di recupero
              </button>
              <p className={styles.recoveryHint}>
                È il codice che hai salvato durante la configurazione.
              </p>
            </div>
          </div>
        )}

        {step === 'input' && (
          <div className={styles.modalBody}>
            <label className={styles.recoveryLabel}>
              Chiave di recupero
              <textarea
                ref={textareaRef}
                className={styles.recoveryTextarea}
                value={code}
                onChange={handleCodeInput}
                disabled={recovering}
                spellCheck={false}
                autoComplete="off"
                data-testid="recovery-code-input"
              />
            </label>

            <p className={styles.recoveryCounter}>{code.length} di 64 caratteri</p>

            {formatError && (
              <p
                className={styles.recoveryFieldError}
                role="alert"
                data-testid="format-error"
              >
                {formatError}
              </p>
            )}

            {submitError && (
              <p
                className={styles.recoveryFieldError}
                role="alert"
                data-testid="submit-error"
              >
                {submitError}
              </p>
            )}

            <div className={styles.recoveryActions}>
              <button
                type="button"
                className={styles.recoverySubmitBtn}
                onClick={handleRecover}
                disabled={!isValidHex || recovering}
                data-testid="recupera-btn"
              >
                {recovering ? 'Sto verificando la chiave...' : 'Recupera'}
              </button>
              <button
                type="button"
                className={styles.recoveryBackBtn}
                onClick={() => { setStep('explain'); setSubmitError(null) }}
                disabled={recovering}
                data-testid="indietro-btn"
              >
                Indietro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
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

  // ── Auto-submit on 6th digit ─────────────────────────────────────────────
  // TODO: add attempt throttling if vaultService.unlock() ever adds it.
  useEffect(() => {
    if (digits.length !== 6) return
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
  }, [digits, unlock, router])

  // ── Physical keyboard ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (loading || showModal) return
      if (/^[0-9]$/.test(e.key) && digits.length < 6) {
        setError(null)
        setDigits(d => [...d, e.key])
      } else if (e.key === 'Backspace') {
        setDigits(d => d.slice(0, -1))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [loading, showModal, digits.length])

  function handleDigit(d: string) {
    if (loading || digits.length >= 6) return
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
              : 'Inserisci il tuo PIN di 6 cifre.'}
          </p>
        </div>

        <PinCells key={shakeKey} digits={digits} />

        {error && (
          <p role="alert" className={styles.error} data-testid="pin-error">
            {error}
          </p>
        )}

        <Keypad onDigit={handleDigit} onDelete={handleDelete} disabled={loading} />

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
