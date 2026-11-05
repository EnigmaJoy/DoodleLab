// components/ExitModal.tsx
'use client'

import { ConfirmModal } from '@/design-system/ConfirmModal'

interface ExitModalProps {
  isOpen:    boolean
  onClose:   () => void
  onConfirm: () => void
}

export function ExitModal({ isOpen, onClose, onConfirm }: ExitModalProps) {
  if (!isOpen) return null
  return (
    <ConfirmModal
      title="Uscire da Agenda?"
      body="Agenda si blocca: per rientrare ti servirà di nuovo il PIN."
      confirmLabel="Esci"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
