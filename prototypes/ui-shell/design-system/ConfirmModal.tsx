// design-system/ConfirmModal.tsx
'use client'

import { useEffect, useId, useRef } from 'react'
import styles from './Modal.module.css'

interface ConfirmModalProps {
  title:        string
  body:         string
  confirmLabel: string
  onConfirm:    () => void
  onClose:      () => void
}

export function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose }: ConfirmModalProps) {
  const dialogRef    = useRef<HTMLDialogElement>(null)
  const confirmRef   = useRef<HTMLButtonElement>(null)
  const onCloseRef   = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useId()
  const bodyId  = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    confirmRef.current?.focus()
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

  function handleScrim(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      className={`${styles.dialog} ${styles.small}`}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      aria-modal="true"
      onClick={handleScrim}
    >
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <p id={bodyId} className={styles.body}>{body}</p>
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn}
                  onClick={() => dialogRef.current?.close()}>
            Annulla
          </button>
          <button ref={confirmRef} type="button" className={styles.primaryBtn}
                  onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
