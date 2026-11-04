// components/ExitModal.tsx
'use client'

import { useEffect } from 'react'
import styles from './ExitModal.module.css'

interface ExitModalProps {
  isOpen:    boolean
  onClose:   () => void
  onConfirm: () => void
}

export function ExitModal({ isOpen, onClose, onConfirm }: ExitModalProps) {
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-modal-title"
        className={styles.card}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="exit-modal-title" className={styles.title}>Vuoi uscire?</h2>
        <p className={styles.body}>Verrai disconnesso dall&apos;account.</p>
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose}>
            Annulla
          </button>
          <button className={styles.btnConfirm} onClick={onConfirm}>
            Esci
          </button>
        </div>
      </div>
    </div>
  )
}
