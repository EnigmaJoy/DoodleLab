'use client'

import { type ReactNode, useEffect, useId, useRef } from 'react'
import { IconButton } from './IconButton'
import { CloseIcon } from '@/components/today/icons'
import styles from './Modal.module.css'

interface ActionItem {
  icon:    ReactNode
  label:   string
  note?:   string
  onClick: () => void
  danger?: boolean
}

interface ActionsModalProps {
  eyebrow?:     string
  title:        string
  meta?:        string
  description?: string
  items:        ActionItem[]
  onClose:      () => void
}

export function ActionsModal({ eyebrow, title, meta, description, items, onClose }: ActionsModalProps) {
  const dialogRef    = useRef<HTMLDialogElement>(null)
  const onCloseRef   = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useId()
  const descId  = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
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
      role="dialog"
      className={`${styles.dialog} ${styles.medium}`}
      aria-labelledby={titleId}
      aria-describedby={descId}
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close() }}
    >
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {meta && <p className={styles.meta}>{meta}</p>}
          </div>
          <IconButton
            label="Chiudi"
            icon={<CloseIcon />}
            onClick={() => dialogRef.current?.close()}
          />
        </div>
        {description && <p id={descId} className={styles.description}>{description}</p>}
        <div className={styles.actionList} role="group" aria-label="Azioni">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              className={item.danger
                ? `${styles.actionItem} ${styles.actionItemDanger}`
                : styles.actionItem}
              onClick={item.onClick}
            >
              <span className={styles.actionIcon} aria-hidden="true">{item.icon}</span>
              {item.note
                ? <span className={styles.actionText}>
                    {item.label}
                    <span className={styles.actionNote}>{item.note}</span>
                  </span>
                : item.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  )
}
