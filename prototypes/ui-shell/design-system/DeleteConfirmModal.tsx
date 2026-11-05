'use client'

import { useEffect, useId, useRef } from 'react'
import { TrashIcon } from '@/components/today/icons'
import styles from './Modal.module.css'

interface DeleteConfirmModalProps {
  title:         string
  chip:          string
  body:          string
  confirmLabel:  string
  onConfirm:     () => void
  onClose:       () => void
  confirmError?: string
}

export function DeleteConfirmModal({ title, chip, body, confirmLabel, onConfirm, onClose, confirmError }: DeleteConfirmModalProps) {
  const dialogRef    = useRef<HTMLDialogElement>(null)
  const cancelRef    = useRef<HTMLButtonElement>(null)
  const onCloseRef   = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useId()
  const bodyId  = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    cancelRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleClose = () => { document.body.style.overflow = prev; onCloseRef.current() }
    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('close', handleClose)
      document.body.style.overflow = prev
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      className={`${styles.dialog} ${styles.small}`}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close() }}
    >
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.deleteContent}>
          <div className={styles.deleteIconWrap} aria-hidden="true">
            <TrashIcon size={22} />
          </div>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <span className={styles.chip}>{chip}</span>
          <p id={bodyId} className={styles.body}>{body}</p>
          {confirmError && <p className={styles.error} role="alert">{confirmError}</p>}
        </div>
        <div className={styles.footer}>
          <button ref={cancelRef} type="button" className={styles.cancelBtn}
                  onClick={() => dialogRef.current?.close()}>
            Annulla
          </button>
          <button type="button" className={styles.dangerBtn} onClick={onConfirm}>
            {confirmError ? 'Riprova' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
