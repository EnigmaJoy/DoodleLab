// Exports useModalState — the open/close state helper for callers of modal components.
// Focus return is built into native <dialog>: showModal() saves the focused element
// and close() restores it automatically.

import { useState } from 'react'

export interface ModalState {
  isOpen: boolean
  open:   () => void
  close:  () => void
}

export function useModalState(initial = false): ModalState {
  const [isOpen, setIsOpen] = useState(initial)
  return {
    isOpen,
    open:  () => setIsOpen(true),
    close: () => setIsOpen(false),
  }
}
