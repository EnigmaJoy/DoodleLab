// design-system/FormModal.tsx
'use client'

import { type ReactNode, useEffect, useId, useRef } from 'react'
import { IconButton } from './IconButton'
import { CloseIcon } from '@/components/today/icons'
import styles from './Modal.module.css'

interface FormModalProps {
  title:              string
  confirmLabel:       string
  onConfirm:          () => void
  onClose:            () => void
  confirmDisabled?:   boolean
  preventScrimClose?: boolean
  children:           ReactNode
}

export function FormModal({
  title, confirmLabel, onConfirm, onClose, confirmDisabled, preventScrimClose, children,
}: FormModalProps) {
  const dialogRef    = useRef<HTMLDialogElement>(null)
  const onCloseRef   = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
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
    if (e.target === e.currentTarget && !preventScrimClose) dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      className={`${styles.dialog} ${styles.medium}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onClick={handleScrim}
    >
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
          </div>
          <IconButton
            label="Chiudi"
            icon={<CloseIcon />}
            onClick={() => dialogRef.current?.close()}
          />
        </div>
        {children}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn}
                  onClick={() => dialogRef.current?.close()}>
            Annulla
          </button>
          <button type="button" className={styles.primaryBtn}
                  onClick={onConfirm}
                  disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
